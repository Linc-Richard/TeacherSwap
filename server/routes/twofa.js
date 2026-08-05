const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, generateToken, logAudit } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const verifyLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts, try again later' } });

router.post('/setup', authMiddleware, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: 'TeacherSwap (' + req.user.email + ')' });
    const db = await getDb();
    db.run(`UPDATE users SET twoFactorSecret = '${secret.base32.replace(/'/g, "''")}' WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    const qrUrl = await qrcode.toDataURL(secret.otpauth_url);
    const backupCodes = Array.from({ length: 8 }, () => Math.random().toString(36).substr(2, 10).toUpperCase());
    db.run(`UPDATE users SET backupCodes = '${backupCodes.join(',').replace(/'/g, "''")}' WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ secret: secret.base32, qrUrl, backupCodes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const db = await getDb();
    const rows = db.exec(`SELECT twoFactorSecret FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' });
    const secret = rows[0].values[0][0];
    if (!secret) return res.status(400).json({ error: '2FA not set up' });
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });
    if (!verified) return res.status(401).json({ error: 'Invalid token' });
    db.run(`UPDATE users SET isTwoFactorEnabled = 1 WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, '2FA_ENABLE', 'Two-factor authentication enabled');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/disable', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE users SET isTwoFactorEnabled = 0, twoFactorSecret = NULL, backupCodes = NULL WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, '2FA_DISABLE', 'Two-factor authentication disabled');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Complete 2FA login: validate TOTP/backup code from a short-lived temp token
router.post('/verify-login', verifyLoginLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired login session' });
    }
    if (decoded.purpose !== '2fa') return res.status(401).json({ error: 'Invalid login session' });

    const db = await getDb();
    const rows = db.exec(`SELECT id, email, fullName, role, twoFactorSecret, backupCodes FROM users WHERE id = '${decoded.id.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' });

    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const user = {};
    cols.forEach((c, i) => user[c] = vals[i]);

    if (user.twoFactorSecret) {
      const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: String(code).trim(), window: 1 });
      if (verified) return complete2FALogin(res, db, user, false);
    }

    const codes = (user.backupCodes || '').split(',').map(c => c.trim()).filter(Boolean);
    if (codes.includes(String(code).trim())) {
      const remaining = codes.filter(c => c !== String(code).trim());
      db.run(`UPDATE users SET backupCodes = '${remaining.join(',').replace(/'/g, "''")}', lastLoginAt = datetime('now') WHERE id = '${user.id.replace(/'/g, "''")}'`);
      saveDb();
      logAudit(user.id, 'LOGIN', 'User logged in via 2FA backup code', req.ip);
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ token, user: publicUser(user), wasBackupCode: true });
    }

    res.status(401).json({ valid: false, error: 'Invalid code' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function complete2FALogin(res, db, user, wasBackupCode) {
  db.run(`UPDATE users SET lastLoginAt = datetime('now') WHERE id = '${user.id.replace(/'/g, "''")}'`);
  saveDb();
  logAudit(user.id, 'LOGIN', 'User logged in via 2FA', undefined);
  const token = generateToken({ id: user.id, email: user.email, role: user.role });
  return res.json({ token, user: publicUser(user), wasBackupCode });
}

function publicUser(u) {
  return {
    id: u.id, email: u.email, fullName: u.fullName, role: u.role,
    phone: u.phone, avatar: u.avatar, region: u.region, district: u.district,
    schoolName: u.schoolName, subjects: u.subjects, teachingLevel: u.teachingLevel,
    experience: u.experience, tscNumber: u.tscNumber, isVerified: !!u.isVerified,
    gender: u.gender, preferredRegion: u.preferredRegion, preferredDistrict: u.preferredDistrict,
    swapType: u.swapType, isTwoFactorEnabled: true
  };
}

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT isTwoFactorEnabled FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    const enabled = rows.length && rows[0].values.length ? !!rows[0].values[0][0] : false;
    res.json({ enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
