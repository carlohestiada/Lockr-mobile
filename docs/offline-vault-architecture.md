# Lockr Mobile offline vault architecture

## Scope and implementation status

This design targets native iOS and Android. The Laravel service is not given
vault passwords or encryption keys and is not able to decrypt vault contents.
Web is not an offline-vault platform; it must not fall back to browser storage
for secrets.

The mobile app now has versioned cryptographic primitives for local use:
Argon2id key derivation, AES-256-GCM authenticated encryption, validated
ciphertext envelopes, DEK wrap/unwrap helpers, and a SQLite write API that
accepts only encrypted envelopes. The existing SQLite schema remains at version
1. These primitives are not yet a complete vault: the unlock service remains
fail-closed, KDF metadata and wrapped keys are not persisted, and there is no
vault initialization, credential CRUD/search, sync, conflict resolution, or
trusted-device recovery. Do not claim that a vault is initialized, unlocked, or
zero-knowledge protected.

Account authentication is connected to the Laravel API. The account password
and master password are separate; only account credentials are sent to Laravel.
Account recovery must not reset a master password, decrypt a vault, replace
vault keys, or delete local encrypted data.

## Cryptographic libraries and platform support

- `expo` is `58.0.25`, React Native is `0.88.1`, `expo-crypto` is `58.0.8`,
  and `expo-dev-client` is `58.0.20`. `expo-crypto` provides native AES-GCM,
  AES key objects, and
  asynchronous secure random bytes on Android and iOS. The selected API supports
  256-bit keys, 12-byte GCM nonces, 16-byte tags, and Additional Authenticated
  Data (AAD). Expo documents it as available on Android and iOS and included in
  Expo Go.
- `react-native-argon2` is `4.0.0`. Its package source wraps Argon2Swift 1.x on
  iOS and argon2kt 1.6.0 on Android. It is a legacy React Native `ReactPackage`
  / `NativeModule`, not an Expo module or Expo Go dependency. It is discovered
  through React Native autolinking; inspection found no package config plugin
  or extra app-config native setting required. The package README's published
  compatibility table only lists React Native 0.60-0.63 for earlier package
  releases; it does not certify package 4.0.0 with React Native 0.88, Expo SDK
  58, or the New Architecture. Its Android Gradle file also retains an older
  Android Gradle Plugin declaration, a dynamic `com.facebook.react:react-native:+`
  dependency, and a JCenter repository. These are build-compatibility risks to
  resolve only against actual build failures; this implementation does not
  patch the dependency speculatively.
- Expo Autolinking resolution was run on Android and iOS and found the
  `RNArgon2Package` Android source and `RNArgon2.podspec` iOS source. This only
  confirms discovery metadata; it is not evidence that either native project
  compiles or that the module runs correctly.
- `expo-dev-client` is already installed. `eas.json` contains an internal
  development profile. A custom build is required to exercise Argon2; do not
  use Expo Go for this validation.
- SecureStore continues to hold only the account authentication token. It is not
  used for the master password, KDF output, or vault DEK. SecureStore protects
  small device-bound values but does not by itself establish zero knowledge,
  key backup, or recoverability.

No fallback KDF or plaintext mode is implemented. If native Argon2id is absent
or fails, key derivation rejects. Argon2 parameters must not be reduced at
runtime to make a slow device pass.

The Jest service tests use Node's AES-GCM implementation and a deterministic
Argon2 test double. They verify service wiring, envelope checks, and failure
handling only; they do not validate Expo's native AES implementation or Argon2
output. A dev-only route at `/native-crypto-validation` exercises Expo Crypto
and `react-native-argon2` directly in a custom native build. It reports test
names, pass/fail, per-test elapsed time, runtime device/OS metadata, and maximum
observed JavaScript timer delay; it never reports passwords, keys, plaintext,
or native exception details.

The native route includes the NIST AES-256-GCM known-answer vector with an all
zero 256-bit key, 96-bit nonce, and 16-byte plaintext (ciphertext
`cea7403d4d606b6e074ec5d3baf39d18`, tag
`d0d1c8a799996bf0265b98b5d48ab919`), plus native negative-AAD/key/ciphertext/tag
checks. Its Argon2id production-parameter vector uses password
`Lockr-native-argon2-kat-v1`, salt bytes `00` through `0f`, v=19, m=65,536 KiB,
t=3, p=1, and 32-byte output. Expected output
`69af934f8d8586b234d2f5076eedeb918f1aef67b5780d43169d2898e7bfd737` was
generated independently with `hash-wasm` 4.13.0's Argon2id WebAssembly
implementation. The native runner also checks changed passwords/salts,
unsupported parameters, fresh nonces, random salt/key generation, and repeated
AES operations.

**Native build/test status (2026-11-14): not run.** This Windows environment has
no `ANDROID_HOME` or `ANDROID_SDK_ROOT`, no `adb` or emulator, and only Java
8.0.491; it cannot compile/install an Android development build or measure
Argon2 on a device. No Android device model, Android version, KDF duration,
process-memory profile, or actual native KAT result is available yet. iOS
compatibility is also **not verified**: Expo Crypto officially lists iOS
support, and the Argon2 package contains a CocoaPod/Swift implementation, but
there is no Xcode environment here and no iOS native build/test has run. Do not
report either platform's package compatibility as proven from source inspection
alone.

The required Android JavaScript export was attempted twice but did not
complete: Windows Application Control blocked the installed `hermesc.exe`
binary (`spawn UNKNOWN`). Running the compiler directly confirmed the same
policy block. No attempt was made to bypass this policy. `expo-doctor` passed
20/20 checks, which is not a native compilation test. The existing mocked Jest
suite passed 11/11; it does not execute the dev-only native validation route.

The moderate `minimatch` advisory GHSA-g3hv-75wg-m249 (globparts amplification
denial of service; affected versions are below 11.0.1) was initially reachable
through Expo's `@expo/fingerprint` production dependency. `package.json` now
overrides only that dependency to `minimatch@^11.0.1`; the lockfile resolves
`11.0.8`, and `npm audit --omit=dev` reports no production vulnerabilities.
The override avoids the audit tool's incompatible Expo 52 downgrade.

The full `npm audit` still reports development-tool dependency findings:
vulnerable `minimatch` copies remain in Jest/TypeScript-ESLint tooling, along
with reported Jest/glob and `deepmerge` advisories (25 moderate and 1 low
findings in the full tree at validation time). These packages are not part of
the production dependency audit, but the development tree is not fully
remediated; update the affected tooling in a dedicated compatibility-checked
change rather than applying broad major-version overrides. This does not
establish exposure in the installed mobile runtime.

`react-native-argon2@4.0.0` remains a native compatibility risk, not a confirmed
cryptographic defect: its support for React Native 0.88 / Expo SDK 58 has not
been verified by an Android or iOS build. No speculative native changes were
made because the required Android toolchain/device and macOS/Xcode environment
are unavailable here.

### Running native validation

For a local Android build on Windows, install JDK 17 and Android Studio, including
Android SDK Platform 36, Build Tools, and Platform Tools. Set `JAVA_HOME` to
JDK 17 and `ANDROID_HOME` to the SDK path, enable USB debugging, and confirm
`adb devices` lists an authorized device. From the project root:

```powershell
npx.cmd expo run:android --device
npx.cmd expo start --dev-client
```

The first command generates CNG native project files, compiles, and installs the
development client. Start or reconnect the dev server, then open
`lockrmobile://native-crypto-validation` on the device and tap **Run native
tests**. Save the displayed runtime/device details, each Argon2 duration, timer
delay, and pass/fail results. Use Android Studio Profiler to record app-process
memory during repeated KDF runs; `Device.totalMemory` in the screen is total
device RAM, not application memory. Repeat the test on minimum-supported device
hardware and a supported emulator, and inspect Android Studio/Logcat for crashes
without collecting credentials or key material.

Cloud alternative, after Expo account login and project/package identity
configuration:

```powershell
npx.cmd eas-cli@latest build --platform android --profile development
npx.cmd expo start --dev-client
```

Install the internal APK on the device, open the same validation route, and
record the runtime results. Do not use Expo Go.

For iOS, on a Mac with Xcode and CocoaPods available, build/install using
`npx expo run:ios --device` or create an iOS development build with
`npx eas-cli@latest build --platform ios --profile development`. Run the same
route and verify all native AES tests and the Argon2id known-answer result on an
actual iOS device. Record the model, OS version, KDF timing, and memory
observations before marking iOS supported.

## KDF configuration

Configuration version 1 uses Argon2id (Argon2 version `0x13`) with a newly
generated 16-byte random salt per vault, 65,536 KiB memory, 3 iterations,
parallelism 1, and a 32-byte output. The salt is encoded as Base64 in the
configuration; the native wrapper receives its hexadecimal representation.
Configuration validation rejects unknown versions and parameter changes rather
than silently accepting attacker-controlled work factors. Future parameter
changes require a new KDF configuration version and a migration/re-derivation
plan.

The resulting key is key-encryption material (KEK), not the vault data
encryption key (DEK). A separate random 256-bit DEK is generated and may be
wrapped/unwrapped by the key service. Neither key is stored yet. The master
password is not stored or sent to the backend.

## AES-GCM and envelope format

Record encryption uses Expo Crypto's native AES-256-GCM implementation. Every
encrypt call obtains a fresh 96-bit nonce from Expo Crypto's native CSPRNG and
uses a 128-bit authentication tag. GCM nonces are random; collisions are
cryptographically improbable but not prevented by a persistent uniqueness
registry. Do not restore or clone state in a way that causes nonce reuse with
the same DEK. This nonce lifecycle still requires review against the final
backup/restore and key-rotation design.

AAD is required by the encryption API and is not stored in the ciphertext
envelope. Callers must supply stable context (for example record identity,
schema version, and key version) consistently at encrypt and decrypt time.
Wrong AAD, wrong keys, and any ciphertext/tag modification fail authentication;
decryption returns no plaintext on failure.

Envelope version 1 is JSON with exactly these fields:

```json
{
  "formatVersion": 1,
  "algorithm": "AES-256-GCM",
  "keyVersion": 1,
  "nonce": "<Base64 12-byte nonce>",
  "authenticationTag": "<Base64 16-byte tag>",
  "ciphertext": "<Base64 ciphertext>"
}
```

Parsing validates the format and algorithm versions, positive key version,
canonical Base64, nonce/tag lengths, and rejects unexpected fields. No
credential plaintext or sensitive account fields belong in envelope metadata.
Format upgrades must use a new version and fail closed for unknown versions.

## Key lifecycle and persistence boundary

Keep these values distinct:

1. Laravel account token: SecureStore only; not a vault key.
2. Master password: user input only; never stored or sent to Laravel.
3. Derived KEK: Argon2id output, transient and used to wrap the DEK.
4. Random DEK: encrypts vault records; its lifecycle is separate from the KEK.
5. Device-protected material: not currently used for vault keys. Any future
   SecureStore value must be narrowly scoped and reviewed for accessibility,
   backup, reinstall, biometric-change, revocation, and recovery behavior.

The encryption and key services hold transient key objects in memory. Temporary
byte copies are cleared with `fill(0)` after use where possible. JavaScript
strings, runtime copies, native key handles, garbage-collected memory, and crash
dumps cannot be guaranteed to be securely erased.

`vault_records.encrypted_payload` persists a serialized envelope returned by
the encryption service through a parameterized SQLite write. TypeScript brands
envelopes returned directly by encryption so the write API rejects arbitrary
record objects. Runtime validation checks parsed envelope shape and encoding,
not whether an arbitrary serialized payload was genuinely encrypted;
production callers must never reserialize untrusted input as a new record. No
plaintext credential repository or CRUD API is introduced. The existing SQLite
schema is not migrated, reset, or recreated. The wrapped DEK and KDF
configuration do not yet have a metadata persistence location, so the new key
helpers do not initialize a durable vault.

## Account recovery

The mobile app uses the Laravel account-recovery endpoint. It must use HTTPS in
production, short-lived single-use reset tokens, and generic accepted responses
for known and unknown addresses. Never log reset tokens or persist them in
ordinary app storage. Account recovery only restores the account session; it
cannot reset or decrypt a local vault.

Vault recovery requires its own reviewed key protocol. Until then, preserve
existing encrypted vault data and do not imply that changing an account password
restores vault access.

## Trust boundaries and key hierarchy

Keep account authentication separate from vault unlock:

- Account authentication establishes a server session used for sync. The
  account password is the only password sent to Laravel; the master password
  must never be used as an API credential. Network availability alone is not
  proof of authentication.
- Local vault unlock verifies the master password against the initialized local
  vault and must work without network access. The master password never leaves
  the device, is never logged, and is never persisted.
- Generate an independent random vault data-encryption key (DEK). Argon2id
  configuration version 1 derives a wrapping key from the master password and
  a unique random salt. The key service can wrap and unwrap the DEK, but KDF
  metadata and wrapped-key persistence, key verification, and unlock remain
  unimplemented.
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
record payloads, queued changes, and unresolved conflicts. Its write API accepts
only validated encrypted envelopes; read, CRUD, and sync APIs are not
implemented. Do not add plaintext credential columns, plaintext full-text
indexes, or logs of record contents. Search and organization should decrypt
records in memory only while unlocked; clear that data and any in-memory search
index when the vault locks. Use random opaque record identifiers to reduce
metadata exposure.

Offline create/update operations must encrypt before entering SQLite. Deletes
become tombstones and remain queued
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

## Remaining security review gates

Before enabling vault initialization, real credentials, or offline unlock:

1. Build and exercise Argon2id on supported iOS and Android development builds;
   verify native known-answer vectors and benchmark the configured cost on
   minimum-supported devices.
2. Independently review KDF parameters, key import/zeroization behavior, nonce
   collision and rollback handling, AAD construction, envelope parsing, and
   downgrade/migration behavior.
3. Persist and atomically migrate KDF metadata and the wrapped DEK without
   storing master passwords or unwrapped DEKs; test wrong-password and corrupted
   key metadata behavior.
4. Implement vault lock/unlock lifecycle, memory clearing, encrypted CRUD,
   transaction/tombstone semantics, and encrypted sync only after review.
5. Specify and test Laravel conditional revision semantics, encrypted sync
   payloads, idempotency, conflicts, revocation, and trusted-device recovery.
6. Test airplane-mode unlock, queued offline edits, reconnect/retry behavior,
   stale-write conflicts, app restarts, backup/restore, and revoked devices.

The current unlock service intentionally throws an unavailable error. The
SQLite initializer creates tables, and the encrypted-record writer accepts only
validated ciphertext envelopes; neither implies an initialized or unlocked
vault.
Do not describe the system as zero-knowledge until the complete client/server
design has been reviewed.
