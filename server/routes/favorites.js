const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

// Add favorite
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    if (targetUserId === req.user.id) return res.status(400).json({ error: 'Cannot favorite yourself' });
    const existing = db.exec(`SELECT id FROM favorites WHERE userId = '${req.user.id.replace(/'/g, "''")}' AND targetUserId = '${targetUserId.replace(/'/g, "''")}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Already in favorites' });
    const id = uuid();
    db.run('INSERT INTO favorites (id, userId, targetUserId) VALUES (?, ?, ?)', [id, req.user.id, targetUserId]);
    saveDb();
    logAudit(req.user.id, 'FAVORITE_ADD', 'Added teacher to favorites');
    res.status(201).json({ id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT f.id as favoriteId, f.createdAt as favoritedAt, u.* FROM favorites f JOIN users u ON f.targetUserId = u.id WHERE f.userId = '${req.user.id.replace(/'/g, "''")}' ORDER BY f.createdAt DESC`);
    if (!rows.length) return res.json({ favorites: [] });
    const cols = rows[0].columns;
    const favorites = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ favorites });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check if favorited
router.get('/check/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT id FROM favorites WHERE userId = '${req.user.id.replace(/'/g, "''")}' AND targetUserId = '${req.params.targetUserId.replace(/'/g, "''")}'`);
    res.json({ favorited: rows.length > 0 && rows[0].values.length > 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remove favorite
router.delete('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM favorites WHERE userId = '${req.user.id.replace(/'/g, "''")}' AND targetUserId = '${req.params.targetUserId.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'FAVORITE_REMOVE', 'Removed teacher from favorites');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
