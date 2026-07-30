const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

// Send a message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: 'receiverId and content required' });
    const conversationId = [req.user.id, receiverId].sort().join(':');
    const id = uuid();
    db.run('INSERT INTO messages (id, conversationId, senderId, receiverId, content) VALUES (?, ?, ?, ?, ?)',
      [id, conversationId, req.user.id, receiverId, content]);
    saveDb();
    logAudit(req.user.id, 'MESSAGE_SEND', 'Message sent');
    res.status(201).json({ id, conversationId, createdAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List conversations for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`
      SELECT m.conversationId, m.content as lastMessage, m.createdAt as lastMessageAt,
             u.id as otherUserId, u.fullName as otherName, u.avatar as otherAvatar,
             (SELECT COUNT(*) FROM messages WHERE conversationId = m.conversationId AND receiverId = '${req.user.id.replace(/'/g, "''")}' AND isRead = 0) as unreadCount
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.senderId = '${req.user.id.replace(/'/g, "''")}' THEN m.receiverId ELSE m.senderId END
      WHERE m.id IN (
        SELECT MAX(m2.id) FROM messages m2 WHERE m2.conversationId IN (
          SELECT DISTINCT m3.conversationId FROM messages m3 WHERE m3.senderId = '${req.user.id.replace(/'/g, "''")}' OR m3.receiverId = '${req.user.id.replace(/'/g, "''")}'
        ) GROUP BY m2.conversationId
      )
      ORDER BY m.createdAt DESC
    `);
    if (!rows.length) return res.json({ conversations: [] });
    const cols = rows[0].columns;
    const conversations = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ conversations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get messages in a conversation
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.conversationId = '${req.params.conversationId.replace(/'/g, "''")}'
        AND (m.senderId = '${req.user.id.replace(/'/g, "''")}' OR m.receiverId = '${req.user.id.replace(/'/g, "''")}')
      ORDER BY m.createdAt ASC
    `);
    if (!rows.length) return res.json({ messages: [] });
    const cols = rows[0].columns;
    const messages = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark message as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE messages SET isRead = 1, readAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}' AND receiverId = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
