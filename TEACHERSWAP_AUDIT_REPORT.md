# TeacherSwap System Test & Security Audit Report

Date: 2026-08-14
Scope: Backend (`server/`), Frontend (`js/`, `*.html`), Config, DB schema/seed.
Mode: Audit only — **no source code was modified**. All test data was removed and the DB restored to its original state (11 seeded users).

---

## 1. Executive Summary

The **backend API is complete and largely functional**: authentication, profiles, schools, swaps, recommendations, messages, notifications, favorites, reviews, meetings, subscriptions/payments, 2FA, and admin analytics all respond correctly, with working authn/authz (401/403) and solid SQL-injection resistance in the login path.

However, two systemic problems dominate the findings:

1. **CRITICAL — The frontend never talks to the backend.** `js/app.js` (the UI's only shared script, ~895 lines) contains **zero** `fetch`/`API.*`/`XMLHttpRequest` calls. The login and registration forms only validate fields and then fake success (toast + redirect). The complete, working `js/api.js` client is loaded on some pages but **never invoked**. `app.js:496-510` (register) and the login handler both simulate success without any network call. The only integration attempt is the Google Sign-In button (`login.html`/`register.html` inline script → `api.request('POST','/auth/google',...)`), which uses a fabricated fake JWT in dev mode and will be rejected by the backend.
   **Net effect: no user can actually register, log in, or use any feature through the UI. The site is a static prototype backed by a real, working API.**

2. **HIGH — Backend registration is broken for the common case.** `POST /api/auth/register` stores an empty string `''` for an omitted `tscNumber` into a `UNIQUE` column, so the second user without a TSC number gets a raw `500 UNIQUE constraint failed: users.tscNumber`. Duplicate TSC numbers also produce a raw 500. (`server/routes/auth.js:15-23`)

Everything else below is medium/low severity.

---

## 2. Environment

- OS: Windows (win32), Node v24.18.0
- Server: Express 4.18, SQLite via `sql.js` (in-memory, persisted via `saveDb()`)
- Server started: `node server/index.js` on `http://localhost:3000`
- Static root: project directory (SPA fallback to `index.html`)
- Test accounts (seed): `admin@teacherswap.com / admin123`, teachers `juma@example.com … hawa@example.com / password123`

## 3. Verified Working (smoke tests, ~70 requests)

| Area | Result |
|---|---|
| Admin / teacher login | 200, JWT issued |
| Wrong password / unknown user | 401 |
| Missing password | 400 |
| Register (with TSC number) | 201 |
| Duplicate email | 409 |
| `/auth/me`, profile update, teacher list/detail | 200 |
| Schools list/map/regions/districts/nearby | 200 |
| Swaps create/list, recommendations + history | 200 |
| Messages, notifications, favorites, meetings | 200 |
| Plans, payment methods, payment history, subscription status | 200 |
| 2FA status + setup (secret + QR) | 200 |
| Admin analytics, admin plans/payments/overview (admin token) | 200 |
| Admin endpoints with teacher token | 403 |
| Invalid/absent token | 401 |
| Login SQLi probe (`' OR '1'='1`) | 401 (escaping effective) |
| Forgot-password on unknown email | generic message (no user enumeration) |
| Sensitive static blocking: `/server/.env`, `/.env`, `…/teacherswap.db`, `/node_modules`, `/server/*` | 404 |
| Security headers (helmet), CORS, rate-limit headers | present |
| SPA fallback, API 404 handler | correct |

## 4. Findings by Severity

### CRITICAL
- **C1. Frontend has zero backend integration.** See Executive Summary. Files: `js/app.js`, `js/api.js`, `login.html`, `register.html`. `api.js` covers every endpoint but nothing calls it except the Google handler.

### HIGH
- **H1. Registration 500 on missing/duplicate TSC number.** `server/routes/auth.js:15-23` uses `tscNumber || ''`; column is `UNIQUE`. Fix: store `NULL` when empty and return a friendly 409 on duplicates.
- **H2. UI is a false front for auth.** Anyone can "log in" or "register" by entering any valid-looking input — the forms fake success and redirect without any credential check (`js/app.js` login handler and `app.js:496-510`).

### MEDIUM
- **M1. Payment receipts are publicly readable.** Files uploaded via `POST /api/payments/submit` land in `uploads/receipts/` and are served at `/uploads/receipts/<uuid>` by `server/index.js:41` with **no auth**. Verified: unauthenticated GET returns 200. Receipts contain phone number, transaction ID, amount. Should be admin-only (or signed/expiring URLs).
- **M2. Forgot-password leaks the reset token.** `server/routes/password.js:25-27` returns `resetToken` in the response whenever `NODE_ENV !== 'production'`. Any deployment not tagged production exposes a working password-reset token for any account. Also no per-route rate limit on `/forgot`.
- **M3. `PUT /api/swaps/:id` always returns `{success:true}`** even when the swap doesn't exist or the caller isn't the recipient (`server/routes/swaps.js:33-43` — the UPDATE targets 0 rows). Verified 200 on a bogus id and on a sender (non-recipient) update. Not exploitable, but misleading and breaks clients.
- **M4. Messages can be sent to non-existent users.** `POST /api/messages` has no receiver existence check — returns 201 and creates a conversation `user:user` for a bogus id (`server/routes/messages.js:9-22`).
- **M5. Self-swap is allowed.** `POST /api/swaps` with `toUserId` = your own id returns 201 (no self-guard in `server/routes/swaps.js:8-20`).
- **M6. Hardcoded JWT fallback secret.** `server/config.js:5`: `JWT_SECRET: process.env.JWT_SECRET || 'teacherswap-secret-key-2026'`. Currently overridden by `.env`, but any deployment without `JWT_SECRET` in env is trivially forgeable (tokens also live 7 days).

### LOW
- **L1. Whole-project static exposure.** `server/index.js:40` serves the entire repo root; `/package.json` (project metadata, scripts, deps), `.gitignore`, `Procfile`, `fly.toml` are downloadable. Minor info disclosure.
- **L2. No `/api/health` endpoint.** Route returns 404.
- **L3. CORS `origin:'*'` + `credentials:true`** (`server/index.js:15`) is invalid per spec — credentialed cross-origin requests effectively won't work, and any origin is allowed.
- **L4. Global rate limit only** (200 req/15 min, `server/index.js:18`). No login brute-force limiter on `/auth/login` (only `/2fa/verify-login` has one).
- **L5. Seed credentials are hardcoded and public** in `server/db/seed.js` (`admin123`, `password123`) and the admin seed account `admin-001` has no 2FA. Fine for demo; must not ship.
- **L6. SQL is built via string interpolation with `'`→`''` escaping** throughout (sql.js `exec`). The login probe passed, and the escaping is correct for these queries, but a single missed escape is an injection. Prefer `db.run` parameter binding (already used in most writes).
- **L7. `/api/auth/teachers/:id` exposes `tscNumber` (PII) to any authenticated user** (`server/routes/auth.js:119-130`).
- **L8. No self-review / reviewer-existence checks** in `POST /api/reviews` (`server/routes/reviews.js:8`); only flag/delete admin path verified. (Static review — not runtime-tested for abuse.)
- **L9. sql.js single-process model**: the DB lives in memory and is written via `saveDb()` per mutation; multiple instances would last-write-wins. Keep it single-process (current Procfile is fine).

## 5. Endpoint Inventory (verified)

| Method | Path | Auth | Result |
|---|---|---|---|
| POST | /api/auth/register | – | 201 (with TSC) / 500 (without or dup TSC) |
| POST | /api/auth/login | – | 200 / 401 / 400 |
| GET | /api/auth/me | user | 200 |
| PUT | /api/auth/profile | user | 200 |
| GET | /api/auth/teachers, /teachers/:id | user | 200 |
| POST | /api/auth/google | – | (not tested; UI-only) |
| POST | /api/auth/password/forgot, reset, verify-email | – | 200 (token leak in non-prod) |
| POST | /api/auth/password/change-password | user | 200 |
| GET/POST/PUT/DELETE | /api/schools* | mixed | 200 |
| GET | /api/schools/map, /regions, /districts | – | 200 |
| POST | /api/swaps | user | 201 (self/allowed) |
| GET/PUT | /api/swaps | user | 200 (PUT never 404s) |
| GET | /api/recommendations/recommendations, /history | user | 200 |
| POST/GET | /api/messages | user | 201/200 (no receiver check) |
| GET | /api/messages/:conversationId | user | 200 (properly scoped) |
| PUT | /api/messages/:id/read | user | 200 |
| GET/PUT | /api/notifications | user | 200 |
| POST/GET/DELETE | /api/favorites | user | 200 |
| POST/GET | /api/reviews | mixed | 200 |
| GET/POST/PUT | /api/meetings | user | 200 |
| GET/POST | /api/plans, /payment-methods | – | 200 |
| POST/GET | /api/payments/submit, /history | user | 201/200 |
| GET | /api/subscription/status | user | 200 |
| POST/GET | /api/2fa/* | user | 200 |
| GET | /api/analytics/* | admin | 200 (403 for user) |
| GET/POST/PUT/DELETE | /api/admin/plans, /admin/payment-methods | admin | 200 (403 for user) |
| GET/PUT | /api/admin/payments*, /admin/payments/overview | admin | 200 (403 for user) |

## 6. Recommendations (priority order)

1. Wire the frontend to `js/api.js` — replace the fake login/register handlers in `js/app.js` with real `API.login`/`API.register` calls, persist `ts-token`, and gate pages on `api.isLoggedIn()`.
2. Fix `tscNumber` handling in `server/routes/auth.js` (NULL when empty; 409 on duplicate) so registration never 500s.
3. Protect `/uploads/receipts` (admin-only middleware) and stop returning `resetToken` outside true production builds.
4. Make `PUT /api/swaps/:id` return 404 on no-op; reject self-swaps and unknown `toUserId` on create; reject messages to unknown receivers.
5. Require `JWT_SECRET` at startup (no silent fallback); consider shorter token TTL.
6. Add a login/forgot rate limiter; add `/api/health`.
7. Restrict static root to `public/` and rotate all seed credentials before any non-demo deploy.

## 7. Cleanup Done

- Stopped test server (restart with `npm start` or `node server/index.js`).
- Deleted uploaded test receipt file(s); `uploads/receipts` is empty.
- Restored `server/db/teacherswap.db` from pre-test backup (verified: 11 users, no test accounts, single admin).

## 8. Repro Commands (quick)

```
# Register 500 (no TSC):        POST /api/auth/register {"email":"x@y.tz","password":"pass123","fullName":"X"}
# Swap update misleading 200:   PUT /api/swaps/does-not-exist {"status":"accepted"}   (as any user)
# Message to bogus user 201:    POST /api/messages {"receiverId":"nope","content":"hi"}
# Receipt public (after submit with receiptData): GET /uploads/receipts/<filename>
# Forgot token leak:            POST /api/auth/password/forgot {"email":"juma@example.com"}  (non-prod)
```
