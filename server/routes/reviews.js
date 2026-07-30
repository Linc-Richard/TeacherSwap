const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { toUserId, swapRequestId, rating, feedback, isAnonymous } = req.body;
    if (!toUserId || !swapRequestId || !rating) return res.status(400).json({ error: 'toUserId, swapRequestId, and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const existing = db.exec(`SELECT id FROM reviews WHERE fromUserId = '${req.user.id}' AND toUserId = '${toUserId}' AND swapRequestId = '${swapRequestId}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Already reviewed' });

    const id = uuid();
    db.run('INSERT INTO reviews (id, fromUserId, toUserId, swapRequestId, rating, feedback, isAnonymous) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, toUserId, swapRequestId, rating, feedback || '', isAnonymous ? 1 : 0]);
    saveDb();
    res.status(201).json({ id, rating });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT r.*, u.fullName as reviewerName, u.avatar as reviewerAvatar FROM reviews r JOIN users u ON r.fromUserId = u.id WHERE r.toUserId = '${req.params.userId.replace(/'/g, "''")}' AND r.isFlagged = 0 ORDER BY r.createdAt DESC`);
    if (!rows.length) return res.json({ reviews: [], average: 0, total: 0 });
    const cols = rows[0].columns;
    const reviews = rows[0].values.map(v => {
      const o = {};
      cols.forEach((c, i) => {
        if (c === 'fromUserId' || c === 'swapRequestId') return;
        o[c] = v[i];
      });
      return o;
    });
    const total = reviews.length;
    const average = reviews.reduce((s, r) => s + r.rating, 0) / total;
    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++; });
    res.json({ reviews, average: Math.round(average * 10) / 10, total, distribution });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/flag', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE reviews SET isFlagged = 1 WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM reviews WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
