const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, adminOnly, logAudit } = require('../middleware/auth');

const router = express.Router();

// Submit a report
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { reportedUserId, conversationId, reason } = req.body;
    if (!reportedUserId || !reason) return res.status(400).json({ error: 'reportedUserId and reason required' });
    if (reportedUserId === req.user.id) return res.status(400).json({ error: 'Cannot report yourself' });
    const user = db.exec(`SELECT id FROM users WHERE id = '${reportedUserId.replace(/'/g, "''")}'`);
    if (!user.length || !user[0].values.length) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO reports (id, reporterId, reportedUserId, conversationId, reason) VALUES (?, ?, ?, ?, ?)',
      [uuid(), req.user.id, reportedUserId, conversationId || '', reason]);
    saveDb();
    logAudit(req.user.id, 'USER_REPORT', `Reported user ${reportedUserId}`);
    res.status(201).json({ success: true, message: 'Report submitted. Our team will review it.' });
  } catch (err) { res.status(500).json({ error: 'Failed to submit report' }); }
});

// Admin: list reports
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`
      SELECT r.*, u1.fullName as reporterName, u2.fullName as reportedName
      FROM reports r
      JOIN users u1 ON r.reporterId = u1.id
      JOIN users u2 ON r.reportedUserId = u2.id
      ORDER BY r.createdAt DESC
    `);
    if (!rows.length) return res.json({ reports: [] });
    const cols = rows[0].columns;
    const reports = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ reports });
  } catch (err) { res.status(500).json({ error: 'Failed to load reports' }); }
});

module.exports = router;
