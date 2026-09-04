const express = require('express');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs = require('fs');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

const AVATARS_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

// Upload (or replace) the authenticated user's avatar from a base64 data URL
router.post('/me/avatar', authMiddleware, async (req, res) => {
  try {
    const { avatarData } = req.body;
    if (!avatarData || typeof avatarData !== 'string') {
      return res.status(400).json({ error: 'avatarData (base64 data URL) required' });
    }
    const m = avatarData.match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: 'Invalid image data' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 2MB)' });

    const filename = `avatar_${uuid()}.${ext}`;
    fs.writeFileSync(path.join(AVATARS_DIR, filename), buffer);
    const avatarPath = `/uploads/avatars/${filename}`;

    const db = await getDb();
    const rows = db.exec(`SELECT avatar FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    if (rows.length && rows[0].values.length) {
      const old = rows[0].values[0][0];
      if (old && old.indexOf('/uploads/avatars/') === 0) {
        const oldFile = path.join(AVATARS_DIR, path.basename(old));
        try { if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile); } catch (e) {}
      }
    }
    db.run(`UPDATE users SET avatar = '${avatarPath.replace(/'/g, "''")}' WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'AVATAR_UPLOAD', 'Updated avatar');
    res.json({ avatar: avatarPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Permanently delete the authenticated user's account and related data
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const me = req.user.id.replace(/'/g, "''");
    db.run(`DELETE FROM blocked_users WHERE blockerId = '${me}' OR blockedId = '${me}'`);
    db.run(`DELETE FROM reports WHERE reporterId = '${me}' OR reportedUserId = '${me}'`);
    db.run(`DELETE FROM users WHERE id = '${me}'`);
    saveDb();
    logAudit(me, 'ACCOUNT_DELETE', 'User deleted their account');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete account' }); }
});

// Block a user
router.post('/:id/block', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const blockedId = req.params.id.replace(/'/g, "''");
    if (blockedId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    const user = db.exec(`SELECT id FROM users WHERE id = '${blockedId}'`);
    if (!user.length || !user[0].values.length) return res.status(404).json({ error: 'User not found' });
    const existing = db.exec(`SELECT id FROM blocked_users WHERE blockerId = '${req.user.id}' AND blockedId = '${blockedId}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Already blocked' });
    db.run('INSERT INTO blocked_users (id, blockerId, blockedId) VALUES (?, ?, ?)', [uuid(), req.user.id, blockedId]);
    saveDb();
    logAudit(req.user.id, 'USER_BLOCK', `Blocked user ${blockedId}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to block user' }); }
});

// Unblock a user
router.delete('/:id/block', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const blockedId = req.params.id.replace(/'/g, "''");
    db.run(`DELETE FROM blocked_users WHERE blockerId = '${req.user.id}' AND blockedId = '${blockedId}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to unblock user' }); }
});

// Get blocked users
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT u.id, u.fullName, u.username, u.avatar FROM blocked_users b JOIN users u ON b.blockedId = u.id WHERE b.blockerId = '${req.user.id}'`);
    if (!rows.length) return res.json({ blocked: [] });
    const cols = rows[0].columns;
    const blocked = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ blocked });
  } catch (err) { res.status(500).json({ error: 'Failed to load blocked users' }); }
});

// Report a user
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { reportedUserId, conversationId, reason } = req.body;
    if (!reportedUserId || !reason) return res.status(400).json({ error: 'reportedUserId and reason required' });
    if (reportedUserId === req.user.id) return res.status(400).json({ error: 'Cannot report yourself' });
    const user = db.exec(`SELECT id FROM users WHERE id = '${reportedUserId.replace(/'/g, "''")}'`);
    if (!user.length || !user[0].values.length) return res.status(404).json({ error: 'User not found' });
    const id = uuid();
    db.run('INSERT INTO reports (id, reporterId, reportedUserId, conversationId, reason) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, reportedUserId, conversationId || '', reason]);
    saveDb();
    logAudit(req.user.id, 'USER_REPORT', `Reported user ${reportedUserId}: ${reason.substring(0, 100)}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to submit report' }); }
});

module.exports = router;
