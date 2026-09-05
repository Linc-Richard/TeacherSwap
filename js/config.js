// TeacherSwap frontend configuration.
//
// This file is the single place to configure the backend API base URL when
// the frontend is hosted separately from the backend (e.g. GitHub Pages
// frontend + Railway backend).
//
// Development (backend serves frontend): the frontend uses the same origin as
// the page (e.g. http://localhost:3000/api) — js/api.js preserves that
// behavior automatically, so this file does NOT need to change for local dev.
//
// Production (GitHub Pages frontend + Railway backend): apiBase points at the
// deployed Railway backend. The frontend then calls this exact base URL for
// register, login, and Google login.
window.TEACHERSWAP_CONFIG = window.TEACHERSWAP_CONFIG || {
  apiBase: 'https://web-production-cd114.up.railway.app/api'
};