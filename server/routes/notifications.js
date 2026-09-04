const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// List notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM notifications WHERE userId = '${req.user.id.replace(/'/g, "''")}' ORDER BY createdAt DESC LIMIT 50`);
    if (!rows.length) return res.json({ notifications: [], unreadCount: 0 });
    const cols = rows[0].columns;
    const notifications = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark single notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}' AND userId = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE userId = '${req.user.id.replace(/'/g, "''")}' AND isRead = 0`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create notification (internal helper)
async function createNotification(userId, type, title, body, link, relatedUserId) {
  const db = await getDb();
  const id = uuid();
  db.run('INSERT INTO notifications (id, userId, type, title, body, link, relatedUserId) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, type, title, body || '', link || '', relatedUserId || null]);
  saveDb();
}

module.exports = router;
module.exports.createNotification = createNotification;
