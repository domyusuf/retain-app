# Retain

A personal expense and monthly budget manager built with React, TypeScript, Vite, and an Express API backed by SQLite.

## Development

Requires Node.js 24 or later and npm. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the API on port 3001. SQLite creates its database in `server/data/retain.db`; database files and environment variables are excluded from Git.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves both the API and the built frontend on port 3001. When running this way, set `APP_ORIGIN=http://127.0.0.1:3001` in `.env`. Production requires an HTTPS origin, Node 24, and a persistent volume for `DATABASE_PATH` so records survive restarts and redeployments.

## Architecture

- React Context owns authentication, the current user, roles, and protected routes.
- Redux owns expense search, filters, sorting, and pagination state.
- The Express API enforces authentication, record ownership, and admin permissions independently of frontend guards.
- SQLite stores users, hashed sessions, categories, expenses, and monthly budgets. Money is stored as integer minor units; the application uses RWF as its single reporting currency.

## Authentication

Accounts use salted scrypt password hashes. Sessions are stored as hashed opaque tokens and delivered through an HTTP-only, SameSite cookie. Session cookies are secure in production. State-changing API requests must send the configured `Origin`. Sign-up always creates a regular user; role promotion is available only through the server-side command:

```sh
npm run admin -w server -- student@example.com
```

The account must already exist. Never use real banking credentials in this student application.

## API

All responses are JSON. Error responses follow `{ "error": { "code": "...", "message": "..." } }`.

| Method | Endpoint            | Purpose                                           |
| ------ | ------------------- | ------------------------------------------------- |
| GET    | `/api/health`       | API and database health                           |
| POST   | `/api/auth/signup`  | Create an account with name, email, password      |
| POST   | `/api/auth/signin`  | Sign in with email and password                   |
| GET    | `/api/auth/me`      | Restore the current session                       |
| POST   | `/api/auth/signout` | Invalidate the current session                    |
| GET    | `/api/categories`   | List expense categories for an authenticated user |

Authentication never returns password hashes or session tokens in JSON. The API accepts only the documented fields and rate limits authentication attempts.
