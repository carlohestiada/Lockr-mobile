# Lockr Mobile offline vault

## Status and scope

The mobile app now implements local vault setup, password-based unlock,
foreground/background and inactivity locking, manual recovery, encrypted
credential CRUD, and in-memory search. The account password remains separate
from the vault master password. These changes do not add a sync API or modify
Laravel.

This is not a claim of a completed independent security review or verified
production cryptography. `react-native-argon2` and Expo Crypto must still pass
the native validation route on supported Android and iOS devices. Trusted-device
recovery is intentionally unavailable until its crypto and Phase 2D relay API
are specified and reviewed.

## Key hierarchy and formats

- Account access token: SecureStore; not used as a vault key.
- Master password: user input only; never persisted or sent to Laravel.
- Wrapping key: Argon2id v1 using a 16-byte random salt, 65,536 KiB memory,
  3 iterations, parallelism 1, and a 32-byte output.
- Data encryption key (DEK): independent random 256-bit AES key for record
  encryption.
- Manual recovery key: independent 32-byte CSPRNG output, canonically encoded
  as Base64, used as an AES-256 key to wrap the same DEK. The raw key is shown
  once during setup/rotation and is not persisted.

Argon2id parameters and AES-256-GCM are unchanged. Metadata format v1 retains
the original `lockr:vault:<vaultId>` master-wrap AAD for compatibility with the
first uncommitted implementation. Metadata without explicit AAD/revision fields
and without recovery metadata is normalized as that first version; manual
recovery can then be added without changing record ciphertext. New metadata uses AAD version 2:
`lockr:vault:v2:<vaultId>:master-dek-wrap`. Recovery wrapping uses
`lockr:vault:v2:<vaultId>:recovery:<recoveryKeyId>`. Record AAD binds the
vault ID, record ID, record schema version, and DEK key version:
`lockr:vault:v2:<vaultId>:record:<recordId>:schema:1:key:<keyVersion>`.
Unknown formats, malformed metadata, invalid envelope fields, wrong AAD, and
authentication failures fail closed.

AES-GCM uses 12-byte random nonces and 16-byte tags. Before encrypting a record,
the app reserves its nonce in `vault_nonce_registry`, which has a unique key on
DEK version and nonce. A failed encryption may consume a nonce; it is never
reused. The v1-to-v2 migration validates existing encrypted envelopes, rejects
duplicate nonces for a key version, and registers their nonces without deleting
or rewriting records. This prevents reuse within the current database state;
restoring an old database snapshot can roll back that registry. There is no
database restore/import feature yet, and restoring a database with the same DEK
must not be supported until nonce rollback is addressed.

## Persistence and local operations

SQLite schema version 2 is a forward migration. It preserves the existing
`vault_records`, metadata, sync queue, and conflict tables. It adds nonce
reservations and local security preferences, adds a metadata revision column
when upgrading an existing schema, and does not reset or delete user data.
Metadata replacement uses an exclusive SQLite transaction and a revision
compare-and-swap so interrupted password/recovery operations leave either the
old or new complete wrap, not a partial state.

Credential payloads include titles, usernames, passwords, URLs, notes, folder
names, favorites, and custom fields. The complete payload is AES-256-GCM
encrypted before it is written to SQLite. Search operates only on decrypted
values in the unlocked process; no plaintext search index or sensitive fields
are persisted. Search results and form/list state are cleared on lock on a
best-effort basis.

The app locks on any transition out of the foreground and after a configurable
1, 5, 15, or 30 minutes without UI interaction (5 minutes by default). Each
protected service checks that its session is still active. Lock revokes the
session handle and clears registered view caches. JavaScript strings, native
key handles, runtime copies, garbage-collected memory, and crash dumps cannot
be guaranteed to be securely erased; `fill(0)` is not a guarantee of
zeroization.

The database is standard SQLite, not SQLCipher. Sensitive record content is
encrypted, but opaque record IDs, key versions, local revisions, timestamps,
and record counts remain observable in app-private storage. Backups and device
compromise are outside the current protection boundary.

## Recovery

Vault setup requires confirmation of both master password and recovery key.
Recovery unwraps the DEK locally, requires a new confirmed master password,
derives a fresh Argon2id salt/wrapping key, and atomically replaces only the
master-key wrap. It does not re-encrypt credentials. Recovery-key rotation
prepares a new independent key and wrap, displays the key, requires re-entry,
then atomically replaces the recovery wrap. Until confirmation commits, the old
key remains valid. No recovery secret or plaintext vault field is sent to the
backend.

An interrupted metadata update leaves the prior metadata intact; tests cover
failed commits. The recovery key is not recoverable if lost. The UI does not
copy the key automatically. Platform app-switcher snapshots/screen capture are
not currently suppressed, so do not display or enter recovery secrets where
screen capture is untrusted.

## Trusted-device recovery and Phase 2D handoff

Trusted-device recovery is **not implemented**. The mobile UI explicitly shows
the feature as disabled and does not generate device keys, enroll devices,
approve requests, transfer DEKs, or claim to revoke devices.

Phase 2D must agree and document these API behaviors before the mobile flow is
enabled:

1. Authenticated device registration with opaque device ID, key type/version,
   public key, and user-verifiable key fingerprint. The server stores public
   keys only.
2. Short-lived, single-use enrollment request IDs and ephemeral recipient
   public keys; explicit approval on an already trusted device, displaying the
   requesting device and expiry to the user.
3. End-to-end encrypted DEK envelope to the new device using an established,
   independently reviewed standard implementation (for example an approved
   HPKE profile), with protocol/suite version, vault ID, request ID, recipient
   key ID, and expiry authenticated as context. The backend may relay the
   envelope only; it must never accept a plaintext DEK or master password.
4. Replay-resistant, single-consumption approval/claim endpoints, cancellation
   and expiration semantics, and server-enforced device revocation for future
   enrollment/authentication/sync.
5. Responses that contain no credential plaintext, DEKs, private keys, or
   master passwords, and do not log encrypted envelopes alongside account
   identifiers unnecessarily.

The mobile client must use a reviewed native-backed or otherwise approved
implementation and platform-protected private-key storage. Do not construct a
custom ECDH/HKDF/AES protocol or implement direct DEK transfer in the API
client. Revocation cannot erase data already copied onto a device that remains
offline.

No Phase 2D sync endpoint, sync worker, queue processing, conflict resolution,
or server vault storage is implemented in this phase.

## Native validation and known limitations

The development-only `/native-crypto-validation` route checks native
AES-256-GCM against a NIST known-answer vector, authentication failures, nonce
length, and the Argon2id production-parameter vector. Jest uses a Node AES-GCM
test implementation and deterministic Argon2 test double; Jest results do not
prove native behavior or the compatibility of `react-native-argon2` with Expo
SDK 58 / React Native 0.88.

The current environment has no connected Android device (`adb devices` is
empty), Java 8 rather than the documented JDK 17 toolchain, and no Xcode
environment. Native Android/iOS builds and device runs have not been performed.
The user requested no APK rebuild absent explicit approval, so none was
attempted. Before release, run the native route on minimum-supported Android
and iOS devices, record Argon2 timing and memory behavior, review backups and
screen capture behavior, and obtain an independent cryptographic/security
review.

## Related flows

Phase 2A account authentication and Phase 2B password recovery remain separate
from local vault keys. Account password reset cannot recover or change the
vault. The existing auth and recovery tests are part of the mobile regression
suite. No Laravel file is changed by the vault implementation.
