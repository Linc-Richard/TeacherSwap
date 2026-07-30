const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const config = require('../config');

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES = '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function logAudit(userId, action, details, ip) {
  const db = await getDb();
  const { v4: uuid } = require('uuid');
  db.run(
    'INSERT INTO audit_logs (id, userId, action, details, ip) VALUES (?, ?, ?, ?, ?)',
    [uuid(), userId, action, details, ip || '']
  );
}

module.exports = { generateToken, verifyToken, authMiddleware, adminOnly, logAudit, JWT_SECRET };
