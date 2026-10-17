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

## Features

- Sign up, sign in, restore a session, and sign out with protected account routes.
- Create, view, edit, and delete your own expenses, including category, date, payment method, and optional notes.
- Search expense titles and notes, combine category/payment/date/amount filters, sort by date or amount, and browse paginated results. Redux owns all expense list selection logic.
- Set and update a separate spending budget for each month. See spending, remaining funds, and within/approaching/over-budget status. The approaching threshold is 80%; spending above 100% is over budget.
- View the selected month’s total spending, highest expense, category breakdown, and five most recent expenses. These summaries include the full month and are independent of expense-list filters and pagination.
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

The account must already exist. Never use real banking credentials in this student application.

## API

All responses are JSON. Error responses follow `{ "error": { "code": "...", "message": "..." } }`.

| Method | Endpoint                       | Purpose                                           |
| ------ | ------------------------------ | ------------------------------------------------- |
| GET    | `/api/health`                  | API and database health                           |
| POST   | `/api/auth/signup`             | Create an account with name, email, password      |
| POST   | `/api/auth/signin`             | Sign in with email and password                   |
| GET    | `/api/auth/me`                 | Restore the current session                       |
| POST   | `/api/auth/signout`            | Invalidate the current session                    |
| GET    | `/api/categories`              | List expense categories for an authenticated user |
| GET    | `/api/expenses`                | Filtered, sorted, paginated own expenses          |
| GET    | `/api/expenses/all`            | All own expenses for Redux selection              |
| POST   | `/api/expenses`                | Create an expense                                 |
| GET    | `/api/expenses/:id`            | Read an owned expense                             |
| PUT    | `/api/expenses/:id`            | Replace an owned expense’s editable fields        |
| DELETE | `/api/expenses/:id`            | Delete an owned expense                           |
| GET    | `/api/budgets`                 | List own monthly budgets                          |
| GET    | `/api/budgets/:month`          | Read a budget, or null if unset                   |
| PUT    | `/api/budgets/:month`          | Create or update an own monthly budget            |
| GET    | `/api/dashboard?month=YYYY-MM` | Full-month own spending summary                   |

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

## Verification

`npm test` runs targeted API and Redux checks for authentication, record ownership, budget isolation, input validation, combined filters, sorting, pagination, stale responses after account changes, and complete monthly summaries. `npm run build` checks the strict TypeScript client and creates the production bundle. `npm run format:check` verifies source formatting.
