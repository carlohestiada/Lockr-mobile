# Lockr Mobile - Phase 1 Technical Inspection Report

**Inspection date:** 2026-11-25
**Scope:** Project inspection and environment foundation only
**Status:** Complete; no implementation phase started

## A. Current Project Assessment

### Repository state

- Mobile repository: `D:\Lockr-mobile`
- Mobile Git branch: `main`, tracking `origin/main`
- Mobile worktree: clean before inspection and unchanged after inspection
- Existing web repository: `D:\Lockr`
- Web worktree: already has a modified `config/database.php`
- Web worktree was not changed
- API directory `D:\Lockr-mobile-api` does not exist
- No database file was found in the web project root or its `database` directory

### Directory structure

- Expo Router screens: `src/app`
- Shared React components: `src/components`
- React contexts: `src/contexts`
- Hooks: `src/hooks`
- Theme and constants: `src/theme`, `src/constants`
- Authentication, vault, crypto, database, and API services: `src/services`
- Public/shared types: `src/types`
- Jest tests and mocks: `src/services/__tests__`, `test-mocks`
- Existing technical notes: `docs/mobile-api-integration.md`, `docs/offline-vault-architecture.md`
- Configuration and assets: `app.json`, `eas.json`, `assets`, `tsconfig.json`

### Technologies and versions

- Expo SDK 58
- React 19.3.0
- React Native 0.88.1
- Expo Router 58
- TypeScript 6.0.3
- Jest 30.5.2 with `jest-expo`
- Expo SecureStore, SQLite, Crypto, and Device
- `react-native-argon2` 4.0.0
- React Native Reanimated 4.7.1
- No HTTP client package is present; requests use the React Native `fetch` implementation
- No general state-management package is present; React context is used

### Implemented features

The implementation contains evidence of the following features:

- Expo Router navigation with authentication and vault route guards
- Login, registration, forgot-password, reset-password, account, and legal screens
- Session restoration from Expo SecureStore
- Login, registration, current-user, and logout API calls
- Bearer token handling with 401 cleanup
- Password-reset request and reset submission
- Native-only Expo SQLite local vault database
- AES-256-GCM record encryption through Expo Crypto
- Argon2id-based master-key derivation
- Separate account password and vault master password
- Vault setup, unlock, lock, auto-lock, manual recovery, and recovery-key rotation
- Local credential create, read, update, delete, search, favorites, and folder-name metadata
- Local nonce reservation and nonce migration registry
- Development-only native crypto validation route

### Implemented-but-not-syncing features

- The vault stores encrypted records locally, but has no synchronization implementation
- The local SQLite schema contains sync queue and conflict tables
- No sync API, sync worker, conflict resolution UI, cloud backup, or server credential storage is implemented
- Folder persistence is textual metadata in the encrypted credential payload, not a server folder model
- Preferences are local-only for auto-lock timeout
- Trusted-device enrollment, approval, encrypted relay, and revocation are UI/documentation placeholders only

### Baseline verification

- Jest: 14 suites passed, 89 tests passed
- TypeScript: `npx tsc --noEmit` passed
- Expo lint: passed
- No Android device is documented as available and no iOS build environment is present
- Native crypto behavior is not validated in this environment

### Detected risks and errors

- `EXPO_PUBLIC_API_URL` points at `http://192.168.137.1:8000/api/v1` in `.env.local`
- The configured timeout is blank, so the client defaults to 15 seconds
- HTTP is allowed in development but rejected for production
- Mobile API behavior is coupled to an address and route contract owned by the web repository
- Password recovery is implemented as account recovery only and cannot recover or change the local vault
- SQLite is standard SQLite, not SQLCipher
- Encrypted payloads are protected at the record level, but metadata and record counts remain observable
- A snapshot/backup rollback may reuse nonces because nonce rollback protection is not backed by an independent server or restore ledger
- JavaScript/native key handles and memory cannot be guaranteed to be erased
- App-switcher snapshots and screen capture are not suppressed
- The web reset password implementation's mail delivery may use local logging unless a real mail transport is configured
- Native Argon2 and AES implementations require device validation; Jest mocks do not prove native compatibility
- No network reachability/offline-state API is used beyond fetch failures
- No certificate-pinning strategy is documented
- No mobile API integration tests against a live independent backend exist

## B. Current API Assessment

### Mobile environment

Public build-time configuration:

| Variable | Purpose | Current local state |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | API root ending in `/api/v1` | LAN HTTP URL to port 8000 |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Optional request timeout | Blank; 15-second default |

Values are public. `.env.local` is ignored and must not contain secrets.

### HTTP client behavior

- Base URL is normalized by removing trailing slashes
- Default timeout is 15 seconds; valid override range is 1–120,000 ms
- Timeout uses `AbortController`
- JSON `Accept` and `Content-Type` headers are set
- Authenticated requests use `Authorization: Bearer <token>`
- 401 authenticated responses clear only the token used by the request
- 401 unauthenticated responses are parsed as normal API errors
- 422 validation, 403 forbidden, 429 rate-limited, 5xx, timeout, network, and request errors are classified
- Errors are intentionally split into timeout and network categories
- The client does not add retries, exponential backoff, request IDs, or offline queues

### Authentication flow

1. App starts and reads `lockr.auth-token` from Expo SecureStore
2. A saved token is verified with `GET /auth/me`
3. A verified session is exposed through `AuthContext`
4. Login saves the returned bearer token
5. Logout clears SecureStore before best-effort server token revocation
6. 401 removes the matching saved token and unauthenticates the app
7. Network failures during session restore fail closed to sign-in with retry available
8. Session refresh occurs after at least five minutes in the background

### Current web-backend dependency inventory

The mobile API root is the existing web project's `/api/v1` route:

| Method | Existing endpoint | Authentication | Current contract |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | Throttled 5/minute; `{data: {id, name, email}}`, HTTP 201 |
| POST | `/api/v1/auth/login` | None | Throttled 5/minute; `{data: {token, token_type: "Bearer", user}}` |
| GET | `/api/v1/auth/me` | Sanctum Bearer | `{data: {user: {id, name, email}}}` |
| POST | `/api/v1/auth/logout` | Sanctum Bearer | Deletes current token; `{message}` |
| POST | `/api/v1/auth/forgot-password` | None | Laravel password-reset email |
| POST | `/api/v1/auth/reset-password` | None | Reset account password and revoke API tokens |

The existing web routes also contain credential, folder, vault-lock, and preference endpoints, but the mobile app does not call them:

| Existing web route family | Mobile dependency |
|---|---|
| `/api/credentials` | Not used |
| `/api/folders` | Not used |
| `/api/preferences` | Not used |
| `/api/vault/status`, `/api/vault/unlock`, `/api/vault/lock` | Not used |

### API response and validation conventions

- Success payloads primarily use `data`
- Login and registration use JSON
- Laravel validation uses HTTP 422 and `errors.<field>[]`
- Invalid credentials use HTTP 401
- Rate limits use HTTP 429
- Sanctum tokens expire after 30 days in the current web implementation
- Sanctum stores hashed personal access tokens

### Required changes for independence

- Replace the mobile environment with a dedicated independent API URL
- Create a dedicated `/api/v1` route surface in `D:\Lockr-mobile-api`
- Establish a dedicated PostgreSQL database and credentials
- Duplicate only the mobile-required account contract
- Avoid inherited web sessions, cookies, CSRF assumptions, routes, or database tables
- Decide whether account migration is required before replacing users or auth
- Preserve the existing mobile `data` envelope unless a versioned migration is approved
- Add CORS/security middleware suitable for native mobile clients
- Add explicit request IDs and structured error envelopes
- Add independent password-broker mail configuration
- Add no server dependency on the web application's database
- Add live integration tests against the independent API

## C. Security Assessment

### Token storage

- READY: bearer token stored in Expo SecureStore
- NEEDS MODIFICATION: token key namespace should be environment/application-specific
- NEEDS MODIFICATION: independent API must define token lifetime and revocation policy
- NEEDS MODIFICATION: no server-side refresh-token flow is defined

### Sensitive data handling

- READY: account password is separate from vault master password
- READY: master password, recovery key, and credential plaintext are not API fields
- NEEDS MODIFICATION: production logging and crash reporting must add explicit secret redaction
- NEEDS MODIFICATION: OS backups and app snapshots need documented policy and review

### Local database security

- NEEDS MODIFICATION: standard SQLite provides no full-database encryption
- READY: credential payloads use AES-256-GCM
- NEEDS MODIFICATION: nonce reuse prevention across database restore is not complete
- NEEDS MODIFICATION: SQLCipher or platform-backed database protection should be evaluated rather than assumed

### Encryption implementation

- READY at source level: AES-256-GCM envelope validation and associated data
- READY at source level: Argon2id salt, wrapping, and local metadata
- BLOCKED: native Android and iOS cryptographic validation
- NEEDS MODIFICATION: independent security review and backup/screen-capture threat model

### Environment security

- READY: public Expo variables are separate from private web/API environment variables
- READY: `.env.local` is ignored
- NEEDS MODIFICATION: `.env.local` currently contains a LAN IP, and physical-device hosts must never rely on loopback
- READY: no mobile secret should be embedded in `app.json` or `EXPO_PUBLIC_*`
- NEEDS MODIFICATION: separate development, staging, and production EAS/Expo environments should be explicit

### Potential vulnerabilities

- Long-lived bearer token compromise may expose account operations until expiry/revocation
- LAN HTTP is insecure outside a tightly controlled development network
- Plaintext account password exists in JavaScript memory during sign-in
- Local credential plaintext exists in JavaScript memory while the vault is unlocked
- Database metadata and record counts reveal usage patterns
- Screen capture and app-switcher snapshots can capture recovery secrets
- Custom protocol links must enforce strict token and email parsing
- No independent API abuse/rate-limit policy is defined yet

## D. Independent Backend Design

### Proposed Laravel architecture

- Separate Laravel installation at `D:\Lockr-mobile-api`
- Laravel REST API under `/api/v1`
- Sanctum or equivalent token authentication
- PostgreSQL as the only application database
- Dedicated API `.env`
- Dedicated migrations, seeders, factories, policies, form requests, resources, and tests
- Versioned route files and controllers
- Environment-specific CORS and rate limiting
- Queue-backed password-reset mail
- Structured JSON validation and error responses
- No shared database or cross-project configuration reference

### Proposed PostgreSQL tables

Minimum account/auth tables:

| Table | Purpose |
|---|---|
| `users` | Mobile account identity |
| `personal_access_tokens` | Sanctum/Passport-style bearer tokens |
| `password_reset_tokens` | Password reset broker records |
| `sessions` or API-specific login sessions | Optional if required by audit/product rules |

Future vault/sync tables should remain explicitly encrypted and metadata-minimal:

| Table | Purpose |
|---|---|
| `vaults` | Vault ownership, format/version, metadata, revision |
| `vault_records` | Opaque ID, ciphertext envelope, key version, server revision |
| `vault_sync_queue` | Optional durable server-to-device operations |
| `vault_sync_conflicts` | Server conflict records |
| `devices` | Future public-key trusted-device enrollment |
| `device_enrollment_requests` | Future short-lived relay requests |
| `device_recovery_envelopes` | Future ciphertext-only DEK envelopes |

The independent API must not receive or store credential plaintext, vault master passwords, recovery keys, or data-encryption keys.

### Authentication design

- Registration creates an account and returns safe profile fields
- Login validates credentials and returns a bearer token plus profile
- Tokens belong only to the mobile API
- `/auth/me` validates and refreshes profile information
- Logout revokes only the current token
- Password reset uses a dedicated mobile reset contract and mail flow
- Password reset must not affect local vault state
- Device/recovery features require a separate reviewed design and later phase

### API endpoint contracts

All endpoints below are proposed as stable `/api/v1` contracts.

| Method | Endpoint | Request | Success |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password, password_confirmation}` | 201 `{data: {id, name, email}}` |
| POST | `/auth/login` | `{email, password}` | 200 `{data: {token, token_type: "Bearer", user}}` |
| GET | `/auth/me` | Bearer token | 200 `{data: {user}}` |
| POST | `/auth/logout` | Bearer token | 200 `{message}` |
| POST | `/auth/forgot-password` | `{email}` | 202 generic accepted response |
| POST | `/auth/reset-password` | `{email, token, password, password_confirmation}` | 200 `{message}` |

Standard errors should be:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."]
  }
}
```

Status conventions:

- 401 invalid credentials or invalid session
- 403 forbidden
- 422 validation
- 429 rate limited
- 500 server error

### Future vault API contracts

Not implemented in Phase 1. If later approved, contracts should use opaque record IDs and ciphertext envelopes rather than plaintext credentials. Proposed families are:

- `GET /vault/status`
- `PUT /vault/metadata`
- `GET /vault/records`
- `PUT /vault/records/{recordId}`
- `DELETE /vault/records/{recordId}`
- `GET /vault/sync`
- `POST /vault/sync/operations`

Synchronization, conflict resolution, trusted devices, and cloud backup require separate phase definitions and security review.

### Environment separation

| Project | Directory | Database | API exposure |
|---|---|---|---|
| Lockr Web | `D:\Lockr` | Existing web database | Existing web/API routes |
| Lockr Mobile | `D:\Lockr-mobile` | Expo SQLite on device | Public environment only |
| Lockr Mobile API | `D:\Lockr-mobile-api` | Dedicated PostgreSQL database | `/api/v1` only |

Rules:

- No shared PostgreSQL/MySQL credentials or database names
- No mobile `.env` values are secret
- API secrets remain in server-only environment variables
- Development, staging, and production use separate databases and hosts
- No accidental migration or artisan command targets the web database
- HTTPS is mandatory outside development
- Backups are per-project and encrypted at rest

## E. Implementation Readiness

| Item | Classification | Evidence |
|---|---|---|
| Mobile project structure | READY | Source, routes, services, tests, and configs are present |
| Expo SDK/package versions | READY | Package manifest and lockfile inspected |
| Mobile navigation and route guards | READY | Expo Router layout guards implemented |
| HTTP client and timeout handling | READY | `api-client.ts` and `api-config.ts` implemented |
| Account sign-in | NEEDS MODIFICATION | Ready for independent API contract but coupled to web route shape |
| Account registration | NEEDS MODIFICATION | Implemented; independent backend migration required |
| Account password recovery | NEEDS MODIFICATION | Implemented against web routes; mail and API ownership must move |
| Secure account token storage | READY | Expo SecureStore implementation |
| Local vault CRUD | READY | Implemented and covered by unit tests |
| Local vault encryption | NEEDS MODIFICATION | Native validation and security review required |
| Standard SQLite storage | NEEDS MODIFICATION | Evaluate additional database protection |
| Sync queue/conflict schema | NOT IMPLEMENTED | Tables exist, but no sync behavior exists |
| Folder server API | NOT IMPLEMENTED | Text-only local folder names; no independent endpoint |
| Preferences server API | NOT IMPLEMENTED | Only local auto-lock setting exists |
| Credential cloud API | NOT IMPLEMENTED | No independent vault API |
| Cloud backup/restore | NOT IMPLEMENTED | Explicitly out of scope |
| Trusted-device recovery | BLOCKED | UI says unavailable; reviewed protocol and API are required |
| Independent Laravel API | NOT IMPLEMENTED | `D:\Lockr-mobile-api` does not exist |
| Independent PostgreSQL database | NOT IMPLEMENTED | No mobile API database or project exists |
| Separate mobile API environment | NOT IMPLEMENTED | Mobile still points to web backend |
| Native crypto validation | BLOCKED | No Android device/iOS environment |
| Existing web backend protection | READY | No web files or database changed |

## F. Phase 1 Completion Checklist

- [x] Inspected the mobile repository structure
- [x] Inspected Expo, React Native, TypeScript, and package versions
- [x] Inspected navigation and authentication screens
- [x] Inspected API client, environment, and response handling
- [x] Inspected SecureStore token storage
- [x] Inspected SQLite and encrypted vault implementation
- [x] Inspected tests and ran baseline mobile checks
- [x] Identified web-backend endpoint dependencies
- [x] Documented existing API contracts
- [x] Inspected web database/migration configuration without exposing secrets
- [x] Inspected Git status in both repositories
- [x] Verified the mobile worktree remained unchanged
- [x] Verified the web worktree was not modified
- [x] Confirmed `D:\Lockr-mobile-api` does not exist
- [x] Documented independent backend architecture
- [x] Documented PostgreSQL entities and API contracts
- [x] Documented environment separation
- [x] Documented security risks and limitations
- [x] Documented backup and rollback strategy

## G. Backup and Rollback Strategy

Before subsequent work:

1. Create a Git bundle or commit-point tag for `D:\Lockr-mobile` and `D:\Lockr`
2. Preserve the mobile `.env.local` separately in an encrypted or access-controlled location
3. Export or archive the web database through its existing approved process
4. Archive `D:\Lockr` database migrations and `config/database.php`
5. Record the SHA-1/SHA-256 hashes of the app database schema and package lockfiles
6. Do not copy production web credentials into any mobile or API environment

Rollback:

- Source changes revert only to a known Git commit or patch created before edits
- Do not reset or discard existing web uncommitted changes
- Do not run migrations that could alter the web database
- The independent API should begin with clean migrations and a separate database
- Any future account migration requires a tested reversible plan and explicit approval

## H. Next Phase Recommendation

Recommended next phase: establish the independent Laravel/PostgreSQL API foundation.

It should include only:

- Create `D:\Lockr-mobile-api`
- Install Laravel and configure PostgreSQL
- Set separate development and production environment templates
- Implement `/api/v1/auth/register`, `/login`, `/me`, `/logout`, forgot-password, and reset-password
- Implement independent migrations and Sanctum tokens
- Implement validation, throttling, mail, and tests
- Verify CORS/native connectivity
- Update the mobile environment and endpoints only after the independent API contract passes tests

Do not start sync, local vault server storage, trusted-device recovery, cloud backup, or credential CRUD in that next phase unless explicitly expanded by approval.
