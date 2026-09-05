const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length < 16) {
  throw new Error('JWT_SECRET environment variable is required (min 16 chars). Set it in the .env file. Refusing to start with a hardcoded fallback.');
}

module.exports = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000',
  // Frontend origin used by Google OAuth callback redirects. Empty when the
  // backend also serves the frontend (dev): the callback stays same-origin and
  // uses relative /login.html. Set to the deployed frontend origin in
  // production (e.g. https://linc-richard.github.io/TeacherSwap).
  FRONTEND_URL: (process.env.FRONTEND_URL || '').replace(/\/+$/, ''),
  JWT_SECRET: jwtSecret,
  PORT: process.env.PORT || 3000
};
