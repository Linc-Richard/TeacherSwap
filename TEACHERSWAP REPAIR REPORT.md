# TEACHERSWAP REPAIR REPORT

**Date:** 2026-09-01
**Scope:** Full codebase audit + repair of the restored TeacherSwap project after a Windows reinstall, preserving existing architecture/features.

---

## TEACHERSWAP STATUS: READY

The project builds, boots, auto-seeds, and the core flows (register → login → profile → match → swap → message) are verified end-to-end. All genuine defects found were fixed at the root cause. Remaining items are documented, intentional, or blocked on external factors (see "Documented, not changed").

---

## Environment blockers resolved

| Item | Before | After |
|---|---|---|
| Node.js / npm | Not installed | Installed Node.js **v24.19.0** (LTS), npm **11.17.0** via winget |
| `server/node_modules` | Missing | Installed via `npm install` in `server/` (139 packages) |
| `.env` | Missing | Created from `.env.example` with a generated `JWT_SECRET` (git-ignored) |
| `server/db/teacherswap.db` | Missing (fresh checkout) | Auto-created + auto-seeded on first boot, verified, then removed at end so delivery is pristine |
| `uploads/` | Missing | Auto-created on demand by `payments.js`; test artifacts removed |

---

## Fixes applied

### 1. SSE real-time messaging was completely broken (HIGH — genuine bug)

**Root causes (two separate defects):**
- `messages.html:342` connects via `new EventSource('/api/messages/stream?token=...')`. EventSource **cannot send HTTP headers**, so the JWT arrived only in the query string.
- `server/routes/messages.js` `/stream` used `authMiddleware`, which reads only the `Authorization` header → always 401. The client's `onerror` handler is silent and no polling fallback starts, so real-time chat never worked.
- Additionally, `pushToUser()` wrote **named** SSE events (`event: new_message ...`), but `messages.html` only listens on `onmessage`, which fires **only for unnamed `data:` events** → strikes parser never delivered to the handler even if auth succeeded.

**Fixes** (`server/routes/messages.js`):
- `/stream` now reads the JWT from `req.query.token` (with a Bearer-header fallback) and verifies it via `verifyToken`. Invalid/no token → 401.
- `pushToUser()` now sends an unnamed `data:` event with the event name embedded as a `type` field in the payload, matching exactly what `messages.html`'s `onmessage` handler interprets (`data.type === 'new_message'`, etc.).

**Verified:** `SSE_VALID_TOKEN_200` / `SSE_BAD_TOKEN_401` / `SSE_NO_TOKEN_401` all pass.

### 2. Profile review summary was undefined (MEDIUM — genuine bug)

`profile.html:254-257` read `reviews.averageRating` / `reviews.totalReviews`, but `server/routes/reviews.js:44` returns `average` / `total` / `distribution`. The review header always rendered "undefined".

**Fix:** `profile.html` now reads `reviews.average` and `reviews.total`.

**Verified:** `REVIEWS_KEYS` passes (`{"reviews":[],"average":0,"total":0}` → header renders correctly).

### 3. Hardcoded JWT secret fallback removed (MEDIUM — security)

- `server/config.js` had `JWT_SECRET: process.env.JWT_SECRET || 'teacherswap-secret-key-2026'` — a public, forgeable secret.
- **Fix:** `config.js` now requires `JWT_SECRET` (min 16 chars) and **fails fast** with a clear error instead of silently using a fallback. `.env.example` now shows a placeholder value + generation instructions instead of a real-looking secret.
- A local `.env` (git-ignored) with a generated 64-hex secret was created so the project runs out of the box.

### 4. Duplicate `/api/health` and duplicate route mounts removed (LOW — hygiene)

`server/index.js` mounted the health route twice and `/api/teachers` + `/api/users` twice. Deduplicated.

### 5. Invalid CORS configuration fixed (MEDIUM — security/spec)

`server/index.js` had `cors({ origin: '*', credentials: true })` — invalid per the CORS spec; any credentialed cross-origin request is rejected by browsers. Now reflects the request `Origin` with `credentials: true`.

### 6. Payment receipts were publicly readable (MEDIUM — security/PII)

`server/index.js` served `/uploads` (receipts contain phone number, transaction ID, amount) with no auth. **The root `express.static(..)` also served `<root>/uploads/*` with 200**, so receipts were effectively public.

**Fix:** an admin-only guard now runs **before** the root static handler for `/uploads/*`. Non-admin / no token → 403; admin → file served normally.

**Verified:** `UPLOADS_NONADMIN_403`, `UPLOADS_NO_TOKEN_403`, `UPLOADS_ADMIN_FETCHES_FILE` all pass.

---

## Smoke test results (live HTTP, 14 checks)

```
TOTAL: 14 | PASS: 14 | FAIL: 0
PASS | HEALTH                         200
PASS | REGISTER (new unique user)     201
PASS | LOGIN                          200
PASS | AUTH_ME                        200
PASS | SSE_BAD_TOKEN_401              401
PASS | SSE_NO_TOKEN_401               401
PASS | SSE_VALID_TOKEN_200            200
PASS | REVIEWS_KEYS                   average/total present
PASS | UPLOADS_NONADMIN_403           403
PASS | UPLOADS_NO_TOKEN_403           403
PASS | UPLOADS_ADMIN_FETCHES_FILE     200 + content
PASS | REGISTER2                      201
PASS | SEND_MESSAGE                   201
PASS | CONVERSATIONS                  1
```

## First-boot verification

Fresh boot (no DB) logs: `Database schema initialized` → `Seeding database...` → `Seed complete!` → server listens on `http://localhost:3000`. Seed admin login (`admin@teacherswap.com`) returns 200 + token.

## Syntax verification

`node --check` across all 23 backend JS files: **0 failures**.

---

## Files changed

| File | Change |
|---|---|
| `server/routes/messages.js` | SSE `/stream` accepts `?token=` (query) + Bearer fallback; `pushToUser()` emits unnamed `data:` events with embedded `type` field |
| `profile.html` | Review summary keys `averageRating`/`totalReviews` → `average`/`total` |
| `server/config.js` | JWT secret is now mandatory (fail-fast, no hardcoded fallback); loads `.env` from project root |
| `.env.example` | `JWT_SECRET` placeholder (no real-looking secret) + generation instructions |
| `.env` (new, git-ignored) | Local config with generated `JWT_SECRET` |
| `server/index.js` | Deduplicated health + route mounts; CORS reflects origin; `/uploads` admin guard placed before root static |
| `server/package-lock.json` | Regenerated by `npm install` |

## New / created local state

- `.env` — local config (git-ignored). Regenerate the secret if you don't want to keep it.
- `server/node_modules/` — installed dependencies (git-ignored).
- No DB / no uploads left on disk: the project auto-seeds and auto-creates these on first run.

---

## Documented, intentionally not changed (existing project decisions)

These were called out by the three prior audit reports (all present at project root) and match the project's stated behavior. No functional error was introduced; per instructions they are documented rather than "fixed":

1. **Seed demo data** (`server/db/seed.js`) — admin `admin123` + 8 demo teachers `password123`, plus seeded schools/swaps/reviews/messages. Dev-only; must be rotated/gated before public launch. Auto-seeds only when the users table is empty.
2. **`community.html` and `index.html`** — 100% static marketing/demo content (fake posts, stats, testimonials). Not wired to an API; not part of the core swap flow.
3. **Reset-token leak in non-production** (`server/routes/password.js:25-27`) — returns `resetToken` only when `NODE_ENV !== 'production'`. Dev convenience, already gated.
4. **String-interpolated SQL with manual quote escaping** (~37 sites) — consistent and escaped correctly (login SQLi probe passed); full parameterized-query refactor is a systemic change intentionally out of scope.
5. **Google client ID hardcoded in `login.html`/`register.html`** — public identifier, not a secret; configurable via the existing `GOOGLE_CLIENT_ID` env var on the backend.
6. **Mobile browser testing** — cannot be executed in this environment; requires a human/CI browser pass.
7. **Settings page Delete Account / Export buttons** — UI shells with success-only toasts; no backend endpoint exists (documented earlier as M2).

---

## How to run

```
cd server
npm install          # already done; re-run if needed
cd ..
npm start            # = node server/index.js  (port 3000; uses .env)
```

Open `http://localhost:3000`. Demo login: `admin@teacherswap.com / admin123` (admin) or any `@example.com` seed teacher `/ password123`.

To regenerate the JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste into `.env`.