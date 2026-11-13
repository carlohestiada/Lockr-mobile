# Lockr Mobile offline vault architecture

## Scope and implementation status

This design targets native iOS and Android. The Laravel service remains separate
and is treated as unable to decrypt vault contents. Web is not an offline-vault
platform; it must not fall back to browser storage for secrets.

The app currently has only fail-closed authentication and vault-unlock
placeholders, plus a SQLite schema initializer. It does **not** implement
encryption, password verification, vault CRUD/search, sync, conflict resolution,
trusted-device recovery, or offline unlock. The database schema is a storage
boundary scaffold, not evidence that data written to it is encrypted. Do not
persist actual credentials until the cryptographic implementation and its tests
have been selected and reviewed.

## Trust boundaries and key hierarchy

Keep account authentication separate from vault unlock:

- Account authentication establishes a server session used for sync. A future
  protocol must not send the master password as an API credential. Network
  availability alone is not proof of authentication.
- Local vault unlock verifies the master password against the initialized local
  vault and must work without network access. The master password never leaves
  the device, is never logged, and is never persisted.
- Generate an independent random vault data-encryption key (DEK). A versioned,
  memory-hard password KDF (Argon2id is a candidate) derives a wrapping key from
  the master password and a unique random salt. Use that wrapping key to
  authenticated-encrypt the DEK. Store only KDF identifiers/parameters, salt,
  and the authenticated wrapped DEK. Final KDF parameters and the Expo-compatible
  implementation require platform benchmarking, test vectors, and independent
  cryptographic review before use.
- Use a maintained, reviewed AES-256-GCM implementation for record encryption.
  Generate a unique nonce for every encryption under a given key; authenticate
  stable record identity, schema version, and key version as associated data.
  Reject invalid tags, unknown versions, and malformed envelopes. Never roll
  nonces back with restored database snapshots.
- Expo SecureStore is for small protected device key material and session
  secrets, not bulk vault data or the master password. Do not store a raw DEK
  there as a shortcut around the password wrapping design. Define accessibility,
  biometric, reinstall, backup, and device-revocation behavior before storing
  device-specific wrapping material.

The intended local flow is: open an existing vault database; derive the wrapping
key locally; authenticate and unwrap the DEK; decrypt records only while the
vault is unlocked. No network request is required for this flow. A missing,
uninitialized, corrupt, or unsupported vault fails closed and cannot be reported
as unlocked.

## Local persistence and offline operations

`src/services/vault-database.ts` initializes SQLite tables for opaque encrypted
record payloads, queued changes, and unresolved conflicts. It has no write or
read API yet. Do not add plaintext credential columns, plaintext full-text
indexes, or logs of record contents. Search and organization should decrypt
records in memory only while unlocked; clear that data and any in-memory search
index when the vault locks. Use random opaque record identifiers to reduce
metadata exposure.

Once encryption is implemented and reviewed, offline create/update operations
must encrypt before entering SQLite. Deletes become tombstones and remain queued
until acknowledged. Each queued change carries an idempotency identifier and
the server revision on which the edit was based. Keep the queue payload encrypted.
Never silently discard a queued operation.

The schema currently uses standard SQLite, not SQLCipher. Its guarantee depends
on all vault payloads being encrypted before persistence. Metadata such as
record identifiers, revision values, queue timing, and operation types may still
leak usage patterns; evaluate whether to minimize or encrypt more of that
metadata.

## Synchronization and conflicts

When connectivity returns, a sync worker may attempt synchronization only after
checking both actual API reachability and valid account authentication. Network
state is a UX hint, not an authentication signal. Failed authentication pauses
sync and prompts for reauthentication; it does not prevent local unlock.

The server API must support conditional writes (for example, compare-and-swap
against the submitted base revision) and return the current revision when a
write is stale. Never overwrite a newer server revision with an offline edit.
Preserve both encrypted versions in a conflict record and require an explicit
resolution. A merge creates a new encrypted record and queued operation based on
the latest server revision. Retain delete tombstones until server acknowledgement
and define retention/compaction rules.

Derive user-visible status from separate facts:

- **Offline**: no usable connection/API reachability.
- **Sync Pending**: queued operations remain, including while online or syncing.
- **Online**: API is reachable and there are no pending operations.

Do not show Online merely because the device reports a network interface.

## Trusted-device recovery and revocation

For the selected trusted-device recovery model, a new device must not receive the
master password or an unwrapped DEK from the service. A proposed protocol is
explicit approval on an already trusted device and end-to-end wrapping of the
DEK to a short-lived public key generated by the new device; the service relays
only ciphertext. The peer key agreement/wrapping protocol, device identity,
user confirmation, expiry, replay resistance, and cancellation behavior must be
selected and independently reviewed before implementation.

Revocation prevents future authentication and sync. It cannot guarantee erasure
of data already copied to a device that remains offline. State this limitation
to users. If every trusted device is lost, recovery is impossible unless a
separate user-held recovery secret is deliberately designed; the service must
not silently reset the vault key.

## Device lifecycle, backup, and migration

Lock on explicit user action and configured inactivity/background transitions.
Clear plaintext records, search indexes, and key handles from memory on lock as
far as the runtime permits. Exclude sensitive app-switcher previews, clipboard
contents, analytics, crash reports, debug output, and cloud backups. Define
secure export separately.

Version the envelope, KDF parameters, key hierarchy, and database schema.
Migrations must preserve authenticated ciphertext and fail closed on unknown
versions. SecureStore has platform-specific uninstall/backup behavior, so it
must not be treated as the only copy of irreplaceable vault data.

## Safe implementation gates

Before enabling real vault persistence or offline unlock:

1. Select and audit maintained native-compatible AES-GCM and password-KDF
   libraries; document versions, parameter migration, nonce generation, and
   test vectors.
2. Implement and test key generation, password wrapping/unwrapping, tamper
   rejection, wrong-password rejection, nonce uniqueness handling, and key
   rotation on supported physical devices.
3. Implement an encrypted-record repository, in-memory-only search, locking,
   SQLite transactions, and deletion tombstones.
4. Specify and test Laravel conditional revision semantics, encrypted sync
   payloads, idempotency, conflicts, revocation, and trusted-device recovery.
5. Test airplane-mode unlock, queued offline edits, reconnect/retry behavior,
   stale-write conflicts, app restarts, backup/restore, and revoked devices.

Until then, the current unlock and account-authentication services intentionally
throw unavailable errors. The SQLite initializer only creates empty tables and
does not imply an initialized or encrypted vault.
