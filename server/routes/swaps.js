const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { pushToUser } = require('./messages');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { toUserId, message, fromSchoolId, toSchoolId, reason } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });
    if (toUserId === req.user.id) return res.status(400).json({ error: 'You cannot send a swap request to yourself' });

    const recv = db.exec(`SELECT fullName FROM users WHERE id = '${toUserId.replace(/'/g, "''")}'`);
    if (!recv.length || !recv[0].values.length) return res.status(404).json({ error: 'Recipient teacher not found' });
    const recipientName = recv[0].values[0][0];

    const sender = db.exec(`SELECT fullName FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    const senderName = (sender.length && sender[0].values.length) ? sender[0].values[0][0] : 'A teacher';

    const id = uuid();
    db.run('INSERT INTO swap_requests (id, fromUserId, toUserId, message, reason, fromSchoolId, toSchoolId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, toUserId, message || '', reason || '', fromSchoolId || null, toSchoolId || null]);
    saveDb();
    logAudit(req.user.id, 'SWAP_REQUEST', `Sent swap request to ${toUserId}`);
    await createNotification(toUserId, 'swap_request', 'New Swap Request', `${senderName} has sent you a swap request.`, '/dashboard.html', req.user.id);
    pushToUser(toUserId, 'swap_request', { id, fromName: senderName, fromUserId: req.user.id, message, status: 'pending' });
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
    const found = db.exec(`SELECT id, fromUserId, toUserId FROM swap_requests WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    if (!found.length || !found[0].values.length) return res.status(404).json({ error: 'Swap request not found' });
    if (found[0].values[0][2] !== req.user.id) return res.status(403).json({ error: 'Only the recipient can update this swap request' });
    db.run(`UPDATE swap_requests SET status = ?, updatedAt = datetime('now') WHERE id = ?`, [status, req.params.id]);
    saveDb();
    logAudit(req.user.id, 'SWAP_UPDATE', `Swap ${req.params.id} -> ${status}`);
    const senderId = found[0].values[0][1];
    if (senderId && status === 'accepted') {
      await createNotification(senderId, 'swap_accepted', 'Swap Request Accepted', 'Your swap request has been accepted. Start messaging!', '/messages.html', req.user.id);
      pushToUser(senderId, 'swap_accepted', { swapId: req.params.id, acceptedBy: req.user.id });
    }
    if (senderId && status === 'declined') {
      pushToUser(senderId, 'swap_declined', { swapId: req.params.id, declinedBy: req.user.id });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
