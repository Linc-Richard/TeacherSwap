# TEACHERSWAP REAL USER AUDIT

Audit of the TeacherSwap registration → login → onboarding → swap → messaging flow from the perspective of a real, brand-new user, after a real tester reported that **users could not register or log in**.

**Date:** 2026-08-15
**Method:** Live HTTP test sequence against `http://localhost:3000` (two fresh real accounts, full lifecycle), `node --check` syntax checks on all modified JS, inline-script syntax checks on all 12 HTML pages, and code review. Real browser/mobile rendering could NOT be executed in this environment (see Mobile section).

---

## SECTION RESULTS (PASS / FAIL)

| Section | Result | Evidence |
|---|---|---|
| Authentication | **PASS** | Register 201 + token, duplicate 409 friendly, login 200, wrong password 401 friendly, unknown email 401 friendly, `/auth/me` 200, bad token 401, re-login after logout 200, change password 200 |
| Registration | **PASS** | Single minimal form (Full Name, Email, Phone optional, Password, Confirm Password, Terms required); Terms/Privacy modal; auto-login token; redirects to onboarding |
| Login | **PASS** | Email + Password; "Forgot password?" now wired (was a dead link); Register link present; friendly errors only (never DB errors/stack traces) |
| Teacher Profile | **PASS** | 5-step onboarding saves each section via `/auth/profile`; fields persist via `/auth/me`; `profile.html` renders real data; static "Jane Mwangi" fallback and fake Certifications removed; verified badge now conditional on `isVerified` |
| School Information | **PASS** | `/schools` 200, `/schools/regions` 200 (31 regions), districts 200; onboarding school autofill + dynamic region/district dropdowns |
| Swap Request | **PASS** | Create 201, self-swap 400 friendly, nonexistent recipient 404 friendly, list shows request, recipient-only accept (sender 403, recipient 200), bogus id 404, `swap_accepted` notification created |
| Matching | **PASS** | Find Match renders only real teachers from `/auth/teachers`; recommendations 200; empty state with actions (Complete profile / Change filters / Create swap request / Try another location) when no matches |
| Messaging | **PASS** | Send 201, self-message 400 friendly, conversations 200, read conversation 200, reply 201, mark-read 200, `message` notification created, `?teacher=<id>` deep link works |
| Notifications | **PASS** | `/notifications` 200; types `swap_request`, `swap_accepted`, `message` created and verified; unread badge + dropdown via `js/notif.js`; mark-read / mark-all wired |
| Database | **PASS** | Clean DB: 9 users (1 admin + 8 seed teachers); all test users removed including dependent rows; schema consistent; no table missing during cleanup |
| Mobile | **FAIL** | Could not be verified — no browser/headless testing available in this environment. Responsive CSS exists (`css/responsive.css`), forms use standard inputs, but Desktop/320px/375px/414px/Tablet layout, tap targets, and no-horizontal-scroll MUST be confirmed by a human or CI browser run before sign-off. |

**HTTP test totals:** 41 checks — 41 PASS, 0 FAIL against the app (the only 4 "failures" were mistakes in my test script using wrong route paths; corrected and re-run as PASS).

---

## PER-PROBLEM SEVERITY BLOCKS

### CRITICAL
*None remaining in the required user flows.* Registration, login, onboarding, swap, and messaging all operate end-to-end for a brand-new real account.

### HIGH

- **H1. Seed teachers look like real verified teachers in live data.**
  - File: `server/db/seed.js:21-30` (invoked automatically by `server/index.js:74-76` when the users table is empty).
  - Location: 8 `@example.com` teachers (`juma`, `amina`, `baraka`, `diana`, `elisha`, `fatuma`, `george`, `hawa`), all `isVerified=1`, shared password `password123`; admin `admin@teacherswap.com / admin123`.
  - Cause: auto-seed on first boot populates the served DB with fabricated-but-verified teachers.
  - How to reproduce: register a new account → Find Match → 8 "@example.com verified" teachers appear as real matches.
  - Fix: gate seeding to dev only (`NODE_ENV !== 'production'`), or remove before launch. Per project instructions demo data was reported, **not deleted** — the DB currently still contains them.

- **H2. Forgot-password leaks the reset token outside production.**
  - File: `server/routes/password.js:25-27`.
  - Location: `/api/auth/password/forgot` returns `resetToken` whenever `NODE_ENV !== 'production'`.
  - Cause: developer convenience that bypasses the "if the email exists" message for any account.
  - How to reproduce: `POST /api/auth/password/forgot {"email":"<any account>"}` → response contains a working `resetToken`.
  - Fix: never return the token in the response; send it via email only. (Already flagged in the earlier audit as M2.)

- **H3. Admin account with known credentials exists in the DB.**
  - File: `server/db/seed.js:17`.
  - Location: `admin@teacherswap.com / admin123`, no 2FA.
  - Cause: seed data.
  - How to reproduce: log in with the known admin credentials.
  - Fix: change/disable or restrict before production.

### MEDIUM

- **M1. Community page is 100% static demo content.**
  - File: `community.html:67-209`.
  - Location: fake posts, authors (Jane Mwangi, Peter Kilonzo, Amina Hassan, Sarah Mwita), like/comment counts, trending tags, popular-teachers list, fake events, and fake "Shared to Facebook/…" toasts (`community.html:216-249`).
  - Cause: page was never wired to an API.
  - How to reproduce: open Community while logged in.
  - Fix: wire to a real posts API, or remove/disable the page until implemented. Not required for the core swap flow.

- **M2. Settings page previously showed static "Jane Mwangi" profile.**
  - File: `settings.html:76-90` (now wired to real profile data via `api.getProfile()`), `js/app.js:562-566`.
  - Location: Delete Account and Export buttons only show fake success toasts; Edit/Change buttons in Settings are non-functional.
  - Cause: UI shells without backend wiring.
  - How to reproduce: click Delete Account in Settings → "Account deletion requested" toast, nothing happens.
  - Fix: wire delete/export to real endpoints or hide the buttons.

- **M3. Marketing page uses fabricated stats and endorsements.**
  - File: `index.html:7,83,91-109,180-227,322-416`.
  - Location: "5,000+ Teachers", "98% Satisfaction", 5 invented testimonials, "Trusted by TSC/MoEVT/NECTA/TETA/TTU" with no evidence.
  - Cause: static landing page content.
  - How to reproduce: open the site home page.
  - Fix: replace with real numbers/endorsements or generic copy before public launch.

- **M4. Demo Google login exists in development.**
  - File: `js/google-auth.js:15-17,60-75`.
  - Location: on `localhost` the "Sign in with Google" button becomes "Sign in with Google (Dev Mode)" and mints a `demo.user@gmail.com / Demo User` session; in production the fallback now shows a "temporarily unavailable" message instead (fixed this session).
  - Cause: dev convenience path.
  - How to reproduce: open login/register on localhost.
  - Fix: acceptable for local dev only; never enable the fallback in production (already addressed).

- **M5. School regions/districts are hardcoded reference data, not DB-driven.**
  - File: `server/routes/schools.js:31-37,42-62`.
  - Location: `/schools/regions` and `/schools/districts` return static arrays.
  - Cause: no schools reference table used for regions.
  - How to reproduce: `GET /api/schools/regions`.
  - Fix: move to a reference table so admins can edit. Not user-blocking.

### LOW

- **L1. Dead multi-step registration helpers remain.**
  - File: `js/app.js` (`window.currentStep`, `window.validateStep`, `window.fireConfetti`).
  - Location: legacy code from the old 4-step register form, now unused.
  - Cause: register was simplified to a single form.
  - How to reproduce: not visible to users.
  - Fix: remove dead code.

- **L2. Community post references an external placeholder image.**
  - File: `community.html:129` (`https://images.unsplash.com/...` in `data-src`).
  - Location: one community post.
  - Fix: remove once community is wired/removed.

- **L3. Seed payment data points to a real-looking phone number.**
  - File: `server/db/seed.js:223-232`.
  - Location: seeded payment methods (`0682987984`).
  - Fix: clear before production.

---

## DEMO / FAKE DATA STATUS

Per project instructions, demo/fake data was **located and reported, not deleted**, and **no demo data is required for a real user to register, log in, onboard, swap, or message**. Locations: `community.html` (full page), `settings.html` (resolved this session), `index.html` (marketing), `server/db/seed.js` (seed users/schools/swaps/reviews), `js/app.js` (fake toasts), `js/google-auth.js` (localhost dev mode). All user-facing pages that were wired to the API now render only real data with neutral placeholders, not fake content.

---

## THE 8 QUESTIONS

1. **Can a brand-new user register?** **YES.** Verified: `POST /api/auth/register` returns 201 + auto-login token; duplicate email returns friendly 409 "Email already registered". Single minimal form with Terms required, redirects to onboarding.
2. **Can they log in?** **YES.** Verified: correct credentials 200; wrong password and unknown email return friendly 401 "Invalid credentials". Forgot-password flow wired.
3. **Can they complete their profile?** **YES.** Verified: all 5 onboarding steps persist through `/auth/profile` and are returned by `/auth/me`; "Save & Continue Later" works; profile-completion banner prompts incomplete users.
4. **Can they create a swap request?** **YES.** Verified: 201 with request id; self-swap and missing recipient rejected with friendly errors; request appears in the recipient's list.
5. **Can they find real matches?** **YES.** Verified: Find Match renders only real teacher accounts from `/auth/teachers`; empty state with actionable buttons when none match; recommendations endpoint returns 200.
6. **Can they communicate?** **YES.** Verified: message send 201, reply 201, conversations list, read history, mark-read, and message notifications all work.
7. **Is fake/demo data required to register/login/use the app?** **NO.** The full core flow works with only a real account and the live API. Demo data exists (seed teachers, community page, marketing stats) but is never required for the core flow.
8. **Ready for another real tester?** **YES — with conditions.** Core flows are verified end-to-end at the API level and all inline/JS syntax is valid. Before sign-off a human must run a **browser + mobile pass** (Desktop, 320px, 375px, 414px, Tablet: forms fit, buttons work, inputs accessible, errors visible, no horizontal scroll), and address HIGH items H1–H3 (seed users, reset-token leak, admin credentials) before any public launch.
