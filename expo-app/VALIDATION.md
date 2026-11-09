# Validation — 7 November 2026

- TypeScript: passed.
- ESLint: passed across `src` using the project's flat config. The `expo lint` wrapper stalled on this Windows host; direct ESLint completed successfully.
- Jest: 6 tests passed (server URL validation, payment precision, request authentication, session expiry, network failure, invalid responses).
- Expo Doctor: 20 of 20 checks passed on SDK 58.
- Android production Hermes export: passed (1,250 modules).
- Legacy Flask backend: 14 PostgreSQL/domain tests passed before the Express migration. The new Node API has not been run against a Neon database yet.
- Express server and admin/database scripts: Node syntax check passed.
- Vite browser client: production build passed with Vite 6.4.4. Client dependency audit: 0 vulnerabilities. Server audit: 0 vulnerabilities after a compatible nodemon update.

## Dependency audit

The app was upgraded from Expo SDK 57 to 58 to address the router URL-decoder advisory. The production dependency audit now reports **0 high**, **0 critical**, and **5 moderate** upstream advisories. The package manager's automated fix would change supported framework dependencies, so it has not been applied blindly.

## Deployment boundary

The app is linked to `@sapcoder/palmapp` (Expo project ID `3b376bb6-6c6f-4afd-990b-9546989022da`). Expo build `49b8132c-825f-46bd-b089-ab8484e5202c` finished successfully. Its 93,637,579-byte APK is at the workspace root. Android `apksigner` verified its v2 signature with one signer. SHA-256: `16E14605F4068D3CFDAC466D27BE91E53134071D39D84DDD5B537F8BD8F7BDF7`. Installation on a physical Android device has not been verified. The new Express backend and Vite client have not been deployed. The owner still needs a Neon project and an internet server/domain, then must set server secrets and create the first admin account.
