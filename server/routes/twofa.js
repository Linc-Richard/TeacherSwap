const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

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

router.post('/validate', async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
    const db = await getDb();
    const rows = db.exec(`SELECT twoFactorSecret, backupCodes FROM users WHERE id = '${userId.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' });
    const secret = rows[0].values[0][0];
    const backupStr = rows[0].values[0][1] || '';

    if (secret) {
      const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      if (verified) return res.json({ valid: true });
    }

    const codes = backupStr.split(',').map(c => c.trim());
    if (codes.includes(token)) {
      const remaining = codes.filter(c => c !== token);
      db.run(`UPDATE users SET backupCodes = '${remaining.join(',').replace(/'/g, "''")}' WHERE id = '${userId.replace(/'/g, "''")}'`);
      saveDb();
      return res.json({ valid: true, wasBackupCode: true });
    }

    res.status(401).json({ valid: false, error: 'Invalid code' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT isTwoFactorEnabled FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    const enabled = rows.length && rows[0].values.length ? !!rows[0].values[0][0] : false;
    res.json({ enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
