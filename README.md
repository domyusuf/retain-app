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

`npm start` serves both the API and the built frontend on port 3001. When running this way, set `APP_ORIGIN=http://127.0.0.1:3001` in `.env`. Production requires an HTTPS origin, Node 24, and durable storage: either a hosted Turso database or a persistent volume for `DATABASE_PATH`. The server refuses production startup without an explicitly configured persistence option.

## Features

- Sign up, sign in, restore a session, and sign out with protected account routes.
- Create, view, edit, and delete your own expenses, including category, date, payment method, and optional notes.
- Search expense titles and notes, combine category/payment/date/amount filters, sort by date or amount, and browse paginated results. Redux owns all expense list selection logic.
- Set and update a separate spending budget for each month. See spending, remaining funds, and within/approaching/over-budget status. The approaching threshold is 80%; spending above 100% is over budget.
- View the selected month’s total spending, highest expense, category breakdown, and five most recent expenses. These summaries include the full month and are independent of expense-list filters and pagination.
- Admin accounts can create, edit, and delete shared categories. Deletion atomically moves affected expenses from every owner to the protected Uncategorized category.
- Admin insights show registered users, expense count/value, current-month expense count, all-time category spending, the five most/least-used categories (including unused categories), recent expenses, and recently registered users.
- Use the same workspace on desktop or mobile, with keyboard-accessible dialogs, explicit deletion confirmation, and loading/error/empty states.

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

The account must already exist. Restart or reload the browser after promotion so Context restores the new role. The `/admin` route and navigation are available only to admins; every admin API request independently checks the current database role. Never use real banking credentials in this student application.

## API

All responses are JSON. Error responses follow `{ "error": { "code": "...", "message": "..." } }`.

| Method | Endpoint                       | Purpose                                                    |
| ------ | ------------------------------ | ---------------------------------------------------------- |
| GET    | `/api/health`                  | API and database health                                    |
| POST   | `/api/auth/signup`             | Create an account with name, email, password               |
| POST   | `/api/auth/signin`             | Sign in with email and password                            |
| GET    | `/api/auth/me`                 | Restore the current session                                |
| POST   | `/api/auth/signout`            | Invalidate the current session                             |
| GET    | `/api/categories`              | List expense categories for an authenticated user          |
| GET    | `/api/expenses`                | Filtered, sorted, paginated own expenses                   |
| GET    | `/api/expenses/all`            | All own expenses for Redux selection                       |
| POST   | `/api/expenses`                | Create an expense                                          |
| GET    | `/api/expenses/:id`            | Read an owned expense                                      |
| PUT    | `/api/expenses/:id`            | Replace an owned expense’s editable fields                 |
| DELETE | `/api/expenses/:id`            | Delete an owned expense                                    |
| GET    | `/api/budgets`                 | List own monthly budgets                                   |
| GET    | `/api/budgets/:month`          | Read a budget, or null if unset                            |
| PUT    | `/api/budgets/:month`          | Create or update an own monthly budget                     |
| GET    | `/api/dashboard?month=YYYY-MM` | Full-month own spending summary                            |
| POST   | `/api/admin/categories`        | Create a shared category (admin only)                      |
| PUT    | `/api/admin/categories/:id`    | Update a non-default category (admin only)                 |
| DELETE | `/api/admin/categories/:id`    | Delete and reassign expenses to Uncategorized (admin only) |
| GET    | `/api/admin/insights`          | Platform-wide aggregates and recent activity (admin only)  |

Authentication never returns password hashes or session tokens in JSON. The API accepts only the documented fields and rate limits authentication attempts.

### Expense and budget payloads

Money uses integer `amountMinor` values (RWF × 100), never floating-point currency amounts. For example, RWF 2,500 is `250000`. Dates use `YYYY-MM-DD`; budget months use `YYYY-MM`. Payment methods are `cash`, `mobile_money`, `card`, and `bank_transfer`.

```json
{
  "title": "Lunch",
  "amountMinor": 250000,
  "categoryId": "food",
  "date": "2026-10-17",
  "paymentMethod": "mobile_money",
  "notes": "Optional details"
}
```

Expense create/update responses use `{ "expense": { ... } }`; the server assigns the owner from the authenticated session and rejects extra ownership fields. Unknown and other users’ expense IDs both return 404. A budget PUT accepts `{ "amountMinor": 15000000 }` and returns `{ "budget": { ... } }`.

The paginated expense endpoint accepts `query`, `categoryId`, `paymentMethod`, `startDate`, `endDate`, `month`, `minAmountMinor`, `maxAmountMinor`, `sort`, `page`, and `pageSize`. Sort values are `date_desc`, `date_asc`, `amount_desc`, and `amount_asc`. Page size defaults to 10 and is capped at 100. Response fields are `expenses`, `total`, `page`, `pageSize`, and `totalPages`. The frontend fetches the authenticated user’s complete expense collection so its memoized Redux selectors can perform all interactive searching, filtering, sorting, and pagination locally.

Dashboard responses include `spentMinor`, `budget`, `remainingMinor`, `budgetStatus`, `expenseCount`, `highestExpense`, `byCategory`, and `recentExpenses`. An unset budget yields null remaining funds; overspending yields a negative remaining amount. Calendar months use the recorded expense date rather than an ISO timestamp conversion.

### Category and insights payloads

Category create/update accepts `{ "name": "Travel", "color": "#386b53" }` and returns `{ "category": { "id", "name", "color", "isDefault" } }`. Names must be unique, ignoring case. Delete returns `reassignedCount` and `defaultCategoryId`; deleting or editing the protected default returns 409. User records, amounts, and budgets are preserved.

Insights return `userCount`, `expenseCount`, `expenseValueMinor`, `currentMonthExpenseCount`, `month`, `byCategory`, `mostUsed`, `leastUsed`, `recentExpenses`, and `recentUsers`. Category usage is ranked by expense count with alphabetical tie-breaking. Recent lists include at most ten records. The current reporting month follows Kigali time (UTC+02:00); expense dates determine monthly inclusion. Only public profile fields are returned for recent users.

## Deployment

Public deployment is pending hosting-account setup; a live URL will be added after verification.

The included `render.yaml` configures a free Node web service that serves both the production React build and REST API from one HTTPS origin. Durable data lives in a separate Turso SQLite database, so Render restarts or redeployments do not erase records.

1. Create a Turso **Free** account and a database. Copy its `libsql://` URL and generate a database authentication token.
2. In Render, create a Blueprint from this repository and select the **Free** service plan. Supply `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as secret environment variables. Never put the token in Git or any `VITE_` variable.
3. Render runs `npm ci --include=dev && npm run build`, then `npm start`. `NODE_ENV=production` and `TRUST_PROXY=1` are declared in the Blueprint. The server uses Render's `RENDER_EXTERNAL_URL` for same-origin checks. For a custom domain, set `APP_ORIGIN` to its full HTTPS origin.
4. Open the service URL, create an account, record an expense and budget, then redeploy and confirm those records and session still exist. Confirm `/api/health` returns `{ "status": "ok" }`.
5. To promote an existing account, run the admin command locally with the production database URL/token in your ignored `.env`. Stop the development server first and restore the local `.env` afterwards. Do not grant admin roles through public signup.

Render Free services can sleep after inactivity, causing a slower first request. Turso Free usage limits apply. The local SQLite database is for development only on this hosting configuration; no demo users or financial records are seeded into production.

Alternatively, use a host with a real persistent volume: set `DATABASE_PATH` to the mounted path, `PERSISTENT_DATABASE=1`, and `APP_ORIGIN` to the HTTPS origin. An ephemeral local file is insufficient.

## Verification

`npm test` runs targeted API and Redux checks for authentication, record ownership, budget isolation, input validation, combined filters, sorting, pagination, stale responses after account changes, complete monthly summaries, admin authorization, category reassignment, and platform insights. `npm run build` checks the strict TypeScript client and creates the production bundle. `npm run format:check` verifies source formatting.

To run the server checks against the SQLite-compatible hosting driver locally, use `DATABASE_DRIVER=libsql npm test -w server`. Actual remote persistence must also be verified after deployment.
