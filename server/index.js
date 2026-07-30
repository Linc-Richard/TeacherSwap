require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSchema } = require('./db/schema');
const config = require('./config');

const app = express();
const PORT = config.PORT;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/google'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/swaps', require('./routes/swaps'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/2fa', require('./routes/twofa'));
app.use('/api/recommendations', require('./routes/recommendations'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

async function start() {
  await initSchema();
  app.listen(PORT, () => {
    console.log(`TeacherSwap API running at http://localhost:${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, '..')}`);
  });
}

start().catch(console.error);
