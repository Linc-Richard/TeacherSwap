require('dotenv').config();

module.exports = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  JWT_SECRET: process.env.JWT_SECRET || 'teacherswap-secret-key-2026',
  PORT: process.env.PORT || 3000
};
