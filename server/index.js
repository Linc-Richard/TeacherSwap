require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSchema } = require('./db/schema');
const { getDb } = require('./db/database');
const config = require('./config');

const app = express();
const PORT = config.PORT;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
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

// Static files
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TeacherSwap API is running', timestamp: new Date().toISOString() });
});

// API Health
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
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));

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
    console.log(`TeacherSwap API running at http://localhost:${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, '..')}`);
  });
}

start().catch(console.error);
