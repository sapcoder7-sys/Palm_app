# Palm_app

Palm_app manages payments, employee access, and refund requests from an Expo Android app and a browser dashboard. The active stack is **Node.js and Express 4, PostgreSQL, Neon, JWT, bcryptjs, Zod, Vite 6, React 18, and Expo React Native**. Vite 6.4.5 replaces the requested Vite 5 line because Vite 5 has a high severity advisory; the newer compatible release has no reported dependency advisories. Money amounts are stored in paise. Refund approval records an accounting entry; it does not send money through a bank or payment gateway.

## Folders

| Folder | Purpose |
| --- | --- |
| `server/` | Express API, PostgreSQL schema, admin setup, optional Cloudinary uploads |
| `client/` | Vite + React browser dashboard |
| `expo-app/` | Expo SDK 58 Android app linked to `sapcoder/palmapp` |
| `backend/` | Previous Flask API kept as a migration reference |
| `mobile/` | Previous Flutter app kept as a migration reference |
| `deploy/` | Optional Docker Compose self-hosting configuration |
| `render.yaml` | Render Blueprint for the hosted API and web dashboard |

## Set up the database and admin

Create a PostgreSQL database in Neon, copy its connection string, and save it in `server/.env`. Start from `server/.env.example`; set a random JWT secret with at least 32 characters. Keep this file private and out of Git. `CLOUDINARY_URL` is optional and is needed only for image uploads.

From PowerShell:

```powershell
Copy-Item server/.env.example server/.env
cd server
npm install
npm run init-db
npm run create-admin
```

The admin command asks for a name, email, and password. There are no default users or financial records. For local development, start the API with `npm run dev`; for production, `npm start` initializes the schema and starts the API.

## Start the apps locally

Run the API on port 8000, then in a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The login screen accepts the API address, email, and password. Set `VITE_API_URL=http://localhost:8000` in `client/.env.local` to prefill it. For the Expo app, use `scripts/start-expo.ps1`; on a phone connected to your local network, use the computer's LAN address for the API.

## Deploy on Render

The root `render.yaml` defines one Render web service. It builds the Vite client, serves it from Express, initializes the existing Neon schema, and exposes the browser app and API on the same HTTPS URL.

1. Push this repository to a Git provider account connected to Render. It can be private.
2. In Render, create a **Blueprint** and select this repository. Render reads `render.yaml`.
3. When prompted, provide the Neon PostgreSQL connection string as `DATABASE_URL`. Render generates `JWT_SECRET` privately.
4. Deploy the Blueprint. The service health check is `/health`; the admin account already created in Neon remains available.
5. Copy the resulting `https://…onrender.com` service URL into the Palm APK's server address field.

The Blueprint selects Render's free plan to avoid creating a paid service. Render free web services sleep after 15 minutes without requests and may take about a minute to wake; Render says free instances are for testing and hobby projects, not production. For regular business payment monitoring, choose a paid plan in Render. [Render Blueprint reference](https://render.com/docs/blueprint-spec) · [Render free plan limits](https://render.com/docs/free).

To deploy the browser client separately or use a custom domain, adjust the Blueprint and CORS settings before deployment. Render requires a Git repository for Blueprint deployment; no repository has been connected from this workspace yet.

## Expo APK

The Android APK is built separately through Expo EAS. The mobile application and browser client call the Express API; keep all database URLs, JWT secrets, and Cloudinary credentials on the server. Expo project: [sapcoder/palmapp](https://expo.dev/accounts/sapcoder/projects/palmapp).

## Access and financial records

- Admins can see all payments and manage employee accounts; employees see their own payment and refund records.
- Paid and pending totals, refunds, net collections, and transaction counts are calculated from PostgreSQL.
- Refunds are partial and require admin review. Pending refunds reserve the available refund balance.
- Payment and refund requests use unique idempotency keys to prevent duplicate records.
- Session tokens expire after 12 hours and are revocable on sign-out or account deactivation.
- Use HTTPS for deployed connections. Never put server secrets in the mobile app or browser bundle.
