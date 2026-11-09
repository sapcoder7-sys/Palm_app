# Palm API

Express 4 server using PostgreSQL (`pg`), Neon connection strings, JWT, bcryptjs, Zod validation, Helmet, CORS, and optional Cloudinary image uploads.

1. Copy `.env.example` to `.env` and set `DATABASE_URL` plus a private `JWT_SECRET` of at least 32 characters.
2. Run `npm install` and `npm run init-db`.
3. Run `npm run create-admin` to make the first administrator.
4. Use `npm run dev` while developing or `npm start` for schema initialization followed by the API server.

The API listens on `PORT` (8000 by default). Admin passwords require at least 12 characters. Do not expose PostgreSQL credentials to the browser or mobile app.

## API routes

`POST /auth/login`, `POST /auth/logout`, `GET /health`, `GET /dashboard`, `GET|POST /payments`, `POST /payments/:id/paid`, `GET|POST /refunds`, `POST /refunds/:id/review`, `GET|POST /employees`, `PATCH /employees/:id`, `GET /reports/payments.csv`, `GET /audit`, and admin-only `POST /uploads/image`.

Successful sign-in returns a 12-hour JWT and a public user record. Protected endpoints require `Authorization: Bearer <token>`.
