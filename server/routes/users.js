const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

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
