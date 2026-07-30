const express = require('express');
const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db/database');
const { generateToken, authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

// Request password reset
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const db = await getDb();
    const rows = db.exec(`SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    const userId = rows[0].values[0][0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    db.run('INSERT INTO password_reset_tokens (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)',
      [uuid(), userId, token, expiresAt]);
    saveDb();
    logAudit(userId, 'PASSWORD_RESET_REQUEST', 'Password reset requested');
    res.json({ success: true, message: 'If the email exists, a reset link has been sent', resetToken: token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset password with token
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const db = await getDb();
    const now = new Date().toISOString();
    const rows = db.exec(`SELECT * FROM password_reset_tokens WHERE token = '${token.replace(/'/g, "''")}' AND isUsed = 0 AND expiresAt > '${now}'`);
    if (!rows.length || !rows[0].values.length) return res.status(400).json({ error: 'Invalid or expired token' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const reset = {}; cols.forEach((c, i) => reset[c] = vals[i]);
    const hashed = await bcrypt.hash(newPassword, 10);
    db.run(`UPDATE users SET password = '${hashed.replace(/'/g, "''")}', updatedAt = datetime('now') WHERE id = '${reset.userId.replace(/'/g, "''")}'`);
    db.run(`UPDATE password_reset_tokens SET isUsed = 1 WHERE id = '${reset.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(reset.userId, 'PASSWORD_RESET', 'Password reset completed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const db = await getDb();
    const rows = db.exec(`SELECT id FROM users WHERE emailVerificationToken = '${token.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(400).json({ error: 'Invalid token' });
    const userId = rows[0].values[0][0];
    db.run(`UPDATE users SET isVerified = 1, emailVerificationToken = NULL WHERE id = '${userId.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change password (authenticated)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const db = await getDb();
    const rows = db.exec(`SELECT password FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, rows[0].values[0][0]);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    db.run(`UPDATE users SET password = '${hashed.replace(/'/g, "''")}', updatedAt = datetime('now') WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'PASSWORD_CHANGE', 'Password changed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
