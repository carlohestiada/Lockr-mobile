# Mobile authentication API

The mobile app uses Laravel's versioned JSON API. Set `EXPO_PUBLIC_API_URL` to the API root ending in `/api/v1`; it is public configuration, not a credential. Production URLs must use HTTPS.

## Endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | Create an account and issue a mobile token |
| POST | `/api/v1/auth/login` | None | Authenticate account credentials and issue a mobile token |
| POST | `/api/v1/auth/logout` | Bearer token | Revoke the current mobile token |
| GET | `/api/v1/auth/me` | Bearer token | Return the safe account profile |
| POST | `/api/v1/auth/forgot-password` | None | Request Laravel's generic password-reset email |
| POST | `/api/v1/auth/reset-password` | None | Reset only the Laravel account password |

Successful login and registration return `{ "data": { "token", "token_type": "Bearer", "user" } }`. Authenticated responses contain only `id`, `name`, and `email`. Validation errors use HTTP 422; invalid credentials and invalid sessions use HTTP 401; rate limits use HTTP 429.

Registration and password reset require a 14-character minimum, mixed case, numbers, symbols, and confirmation. Sanctum stores only a hash of each personal access token. Mobile tokens expire after 30 days and are stored on-device in Expo SecureStore; logout removes only the account-authentication token. A password reset revokes the user's API tokens.

Account credentials are separate from the vault master password. Only the account password is sent to Laravel. Account password reset and account logout do not unlock, reset, or delete local vault data. Local vault unlocking remains a separate, fail-closed foundation.

The recovery endpoint always returns the same accepted response for syntactically valid known and unknown emails, and never returns a reset token. Configure a real Laravel mail transport before relying on email delivery; the default local `log` mailer does not deliver email.

## Local Android development

From `C:\Projects\lockr-mobile`, copy the template and edit `.env.local` with the Windows computer's current LAN IPv4 address:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Set the value to `http://<windows-lan-ip>:8000/api/v1` (replace the placeholder with the host's address; do not use `127.0.0.1` on a physical phone). Keep `.env.local` out of source control. The phone and computer must be on the same network.

From `C:\Projects\lockr-react`, apply the additive Sanctum migration to the configured development database, then listen on the LAN:

```powershell
php artisan migrate
php artisan serve --host=0.0.0.0 --port=8000
```

Run a queue worker in a second Laravel terminal so reset notifications are processed asynchronously:

```powershell
php artisan queue:work
```

Allow inbound TCP port 8000 for the development server in Windows Firewall. Do not expose this development server to the public internet. The mobile app uses the configured URL as-is and rejects non-HTTPS API URLs in production builds.

## Tests

Run Laravel tests from the Laravel project root:

```powershell
php artisan test
```

Run mobile checks from the mobile project root:

```powershell
npx eslint src/app/index.tsx src/app/create-account.tsx src/app/account.tsx src/app/forgot-password.tsx src/services/auth-service.ts src/services/registration-service.ts src/services/recovery-service.ts src/services/api src/services/registration-validation.ts src/components/auth/password-strength-indicator.tsx src/types
npx tsc --noEmit
npx expo-doctor
npx expo export --platform android
```
