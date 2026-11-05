# LifeExp

A minimal app that gamifies music practice. After logging in, the dashboard shows
a per-project XP bar and level for every Toggl Track project.

This is **stage 1**: read-only time tracking from Toggl.

## How it works

- Each Toggl project becomes a skill with its own level.
- **1 minute = 10 XP**, so `XP = floor(seconds / 6)`.
- Reaching level `L+1` requires `100 + (L - 1) * 50` XP.
- Toggl data is cached in SQLite, synced at most once every 10 minutes.
- The Toggl token is used only on the server and never reaches the browser.

## Requirements

- Node.js 22.17+ (tested on Node 24)
- A Toggl Track account and API token

## Setup

```sh
npm install
cp .env.example .env
```

Fill in `.env` using `.env.example` as a template. At minimum set
`SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `TOGGL_API_TOKEN`.

Create the account, verify Toggl access, and start the dev server:

```sh
npm run db:seed
npm run toggl:probe
npm run dev
```

Open <http://localhost:5173/login>.

## Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Development server                       |
| `npm run build`       | Production build (adapter-node)          |
| `npm start`           | Run the production build on `ORIGIN`     |
| `npm run check`       | TypeScript and Svelte diagnostics        |
| `npm test`            | Unit tests                               |
| `npm run db:seed`     | Create or update the account from `.env` |
| `npm run toggl:probe` | Toggl API diagnostics                    |

For production, set `ORIGIN` and `COOKIE_SECURE=true` in `.env`, then run
`npm run build`. `ORIGIN` is baked into the build, so rebuild after changing the
public URL.

## Security

- Passwords are hashed with argon2id.
- The session is an HMAC-SHA256 signed, `HttpOnly`, `SameSite=Strict` cookie.
- Three failed logins from one IP trigger a 15-minute block (in-memory, reset on
  restart).
- `.env` and `data/` are gitignored.

## Toggl limits

- Free plan: 30 requests/hour.
- `/me/time_entries` covers roughly the last 3 months (max 1000 entries).
- Reports API ranges are limited to 365 days and are split into chunks.
- The app tries the Reports API first, then falls back to `/me/time_entries` for
  the last 90 days with a warning in the UI.

## Tests

```sh
npm test
```
