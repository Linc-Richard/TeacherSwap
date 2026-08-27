# TeacherSwap Frontend

TeacherSwap is a platform for teachers in Tanzania to find and connect with swap partners at other schools. This repository contains the **complete, responsive frontend** — a plain static multi-page web app (HTML/CSS/JavaScript) with **no build step**.

> The backend API (Express + SQLite) is **not** included in this repository. See [Connecting the backend](#connecting-the-backend) to point the frontend at a running backend for full login/auth/data features.

## Project Structure

```
TeacherSwap/
├── frontend/                 ← The entire app (all HTML, CSS, JS, images)
│   ├── index.html            ← Landing page
│   ├── login.html
│   ├── register.html
│   ├── onboarding.html
│   ├── dashboard.html
│   ├── find-match.html       ← "Find your match" page
│   ├── messages.html
│   ├── profile.html
│   ├── settings.html
│   ├── community.html
│   ├── school-map.html
│   ├── payment.html
│   ├── css/                  ← style.css, responsive.css, app-redesign.css
│   ├── js/                   ← api.js, app.js, avatar.js, i18n.js, ...
│   └── images/
├── scripts/check-frontend.js ← Optional frontend health check
├── package.json              ← Frontend scripts (static serving + checks)
└── README.md
```

## Quick Start (run the frontend)

The frontend is static — it needs only any static file server. From the repo root:

```cmd
npm start
```

or

```cmd
npx serve frontend -l 3000
```

Then open `http://localhost:3000/` in your browser.

> No `npm install` is required for the frontend itself — it ships zero runtime dependencies.

## Connecting the backend

Login, registration, and all data features require the TeacherSwap **backend API** running (e.g. Express on `http://localhost:5000`). When it runs, the frontend reaches the API at:

- Same origin (backend serves the frontend too): `<origin>/api` — auto-detected.
- Frontend hosted elsewhere (e.g. GitHub Pages): set the API base per page via the `<meta name="api-base-url">` tag in each HTML `<head>`:

```html
<meta name="api-base-url" content="https://your-backend.example.com/api">
```

Resolution order in `frontend/js/api.js`:

1. `<meta name="api-base-url" content="...">`
2. `window.__TS_API_BASE`
3. Auto-detect: same-origin `/api`, or `http://localhost:5000/api` for static/`file://` hosts.

Copy `frontend/.env.example` to `frontend/.env` and fill in your values as a convenient reference (the static app does not read `.env` at runtime — it reads the meta tag / global).

## Responsive design

The layout adapts automatically to phones, tablets, laptops, and desktops via `frontend/css/responsive.css` and `frontend/css/app-redesign.css` (breakpoints at ~1023px, 640px, 420px). Key responsive behaviors:

- **Mobile:** hamburger sidebar + sticky bottom nav; stacked cards; full-width forms.
- **Tablet:** two-column cards; condensed navbar.
- **Desktop:** full purple sidebar + top navbar, multi-column dashboard.

## Frontend checks

```cmd
npm run check
```

Validates that every JS file parses and that every HTML page references only existing local assets (CSS/JS/images).

## Note on the backend

This repo intentionally **excludes** the `server/` backend, database files, `.env` secrets, and deploy config (e.g. `Procfile`, `fly.toml`) to keep it a clean frontend deliverable. Those assets remain in the original project and are ignored by `.gitignore`.
