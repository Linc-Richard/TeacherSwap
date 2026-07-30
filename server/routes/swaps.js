const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { toUserId, message } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });
    const id = uuid();
    db.run('INSERT INTO swap_requests (id, fromUserId, toUserId, message) VALUES (?, ?, ?, ?)',
      [id, req.user.id, toUserId, message || '']);
    saveDb();
    logAudit(req.user.id, 'SWAP_REQUEST', `Sent swap request to ${toUserId}`);
    res.status(201).json({ id, status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT s.*, u1.fullName as fromName, u2.fullName as toName FROM swap_requests s LEFT JOIN users u1 ON s.fromUserId = u1.id LEFT JOIN users u2 ON s.toUserId = u2.id WHERE s.fromUserId = '${req.user.id.replace(/'/g, "''")}' OR s.toUserId = '${req.user.id.replace(/'/g, "''")}' ORDER BY s.createdAt DESC`);
    if (!rows.length) return res.json({ requests: [] });
    const cols = rows[0].columns;
    const requests = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ requests });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { status } = req.body;
    if (!['accepted', 'declined', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.run(`UPDATE swap_requests SET status = ?, updatedAt = datetime('now') WHERE id = ? AND toUserId = ?`, [status, req.params.id, req.user.id]);
    saveDb();
    logAudit(req.user.id, 'SWAP_UPDATE', `Swap ${req.params.id} -> ${status}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
