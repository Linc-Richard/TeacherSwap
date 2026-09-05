require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSchema } = require('./db/schema');
const { getDb } = require('./db/database');
const { verifyToken } = require('./middleware/auth');
const config = require('./config');

const app = express();
const PORT = config.PORT;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// CORS: allow the local frontend (same-origin/dev) and the deployed GitHub
// Pages frontend. No wildcard — credentials/authentication require explicit
// origins to be safe. Requests without an Origin (same-origin server-side)
// are allowed.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  /^https:\/\/linc-richard\.github\.io(:\d+)?$/
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.some((o) => (o instanceof RegExp ? o.test(origin) : o === origin))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Block access to sensitive server files (env, database, source, config, logs)
const SENSITIVE_STATIC_PATTERNS = [
  /^\/server(\/|$)/i,
  /^\/node_modules(\/|$)/i,
  /\.env(\.|$)/i,
  /\.db(-wal|-shm)?$/i,
  /\.log$/i
];
app.use((req, res, next) => {
  const p = req.path;
  const segments = p.split('/').filter(Boolean);
  const hiddenSegment = segments.some(seg => seg.length > 1 && seg.startsWith('.'));
  if (hiddenSegment || SENSITIVE_STATIC_PATTERNS.some(re => re.test(p))) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// Uploaded files (payment receipts) contain sensitive data (phone, trx ID, amount).
// MUST be guarded BEFORE the root static handler, which would otherwise serve them publicly.
// Profile avatars are deliberately public so member pages can render them.
app.use('/uploads/avatars', express.static(path.join(__dirname, '..', 'uploads', 'avatars')));
app.use('/uploads', (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Admin access required' });
  }
});

// Static files (note: express.static(root) would expose uploads/; the /uploads guard above intercepts first)
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TeacherSwap API is running', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/google'));
app.use('/api/auth/password', require('./routes/password'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/swaps', require('./routes/swaps'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/2fa', require('./routes/twofa'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api', require('./routes/payments'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/community', require('./routes/community'));

// API 404 handler (must come before the SPA fallback)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

async function start() {
  await initSchema();
  const db = await getDb();
  const userRows = db.exec('SELECT COUNT(*) FROM users');
  const userCount = userRows.length && userRows[0].values.length ? userRows[0].values[0][0] : 0;
  if (userCount === 0) {
    require('./db/seed');
  }
  app.listen(PORT, () => {
    console.log(`TeacherSwap API listening on port ${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, '..')}`);
  });
}

start().catch(console.error);
