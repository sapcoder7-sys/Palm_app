# Palm — Expo + React Native

Primary mobile app for https://expo.dev/accounts/sapcoder/projects/palmapp. It connects to the Express API in `../server` and PostgreSQL.

## Preview

From the repository root, run `scripts/start-expo.ps1`, or run `npm install` and `npx expo start` here with Node.js installed. Open the QR code in Expo Go. This project uses Expo SDK 58.

Sign in with the HTTPS API address and account created by the server administrator. Development allows HTTP for local testing; release builds require HTTPS. On a phone, use the computer's LAN IP rather than localhost. Expo does not host the API or PostgreSQL database.

## Build an Android APK

```sh
npx eas-cli@latest login
npx eas-cli@latest project:init --account sapcoder --non-interactive
npx eas-cli@latest build --platform android --profile preview
```

The preview profile produces a standalone APK. Do not put server secrets in app configuration or source control.

The mobile app includes admin/employee login, dashboard, payment search and entry, mark-paid workflow, partial refund requests and admin review, employee account management, activity history, and sign-out. Backend permissions are enforced by the API.
