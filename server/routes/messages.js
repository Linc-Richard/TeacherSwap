const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit, verifyToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// SSE connections store: userId -> Set of res objects
const sseClients = new Map();

function pushToUser(userId, event, data) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch(e) { clients.delete(res); }
  }
}

// SSE stream endpoint (must be before /:conversationId)
router.get('/stream', authMiddleware, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('event: connected\ndata: {}\n\n');

  const userId = req.user.id;
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);

  const heartbeat = setInterval(() => { try { res.write(':heartbeat\n\n'); } catch(e) {} }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = sseClients.get(userId);
    if (set) { set.delete(res); if (set.size === 0) sseClients.delete(userId); }
  });
});

// Send a message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: 'receiverId and content required' });
    if (receiverId === req.user.id) return res.status(400).json({ error: 'You cannot send a message to yourself' });
    const recv = db.exec(`SELECT id, fullName FROM users WHERE id = '${receiverId.replace(/'/g, "''")}'`);
    if (!recv.length || !recv[0].values.length) return res.status(404).json({ error: 'Recipient not found' });

    // Check if blocked
    const blocked = db.exec(`SELECT id FROM blocked_users WHERE (blockerId = '${req.user.id}' AND blockedId = '${receiverId}') OR (blockerId = '${receiverId}' AND blockedId = '${req.user.id}') LIMIT 1`);
    if (blocked.length && blocked[0].values.length) return res.status(403).json({ error: 'You cannot message this user' });

    const sender = db.exec(`SELECT fullName FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    const senderName = (sender.length && sender[0].values.length) ? sender[0].values[0][0] : 'A teacher';
    const conversationId = [req.user.id, receiverId].sort().join(':');
    const id = uuid();
    const safeContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    db.run('INSERT INTO messages (id, conversationId, senderId, receiverId, content) VALUES (?, ?, ?, ?, ?)',
      [id, conversationId, req.user.id, receiverId, safeContent]);
    saveDb();
    logAudit(req.user.id, 'MESSAGE_SEND', 'Message sent');
    await createNotification(receiverId, 'message', 'New Message', `${senderName}: ${safeContent.substring(0, 80)}`, '/messages.html', req.user.id);

    // Real-time push to recipient via SSE
    pushToUser(receiverId, 'new_message', {
      id, conversationId, senderId: req.user.id, senderName,
      content: safeContent, createdAt: new Date().toISOString()
    });
    pushToUser(receiverId, 'conversation_update', {
      conversationId, lastMessage: safeContent, lastMessageAt: new Date().toISOString(),
      otherUserId: req.user.id, otherName: senderName
    });

    res.status(201).json({ id, conversationId, createdAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: 'Failed to send message' }); }
});

// Start or get a conversation with a user
router.post('/conversation', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    const user = db.exec(`SELECT id, fullName, username, avatar FROM users WHERE id = '${userId.replace(/'/g, "''")}'`);
    if (!user.length || !user[0].values.length) return res.status(404).json({ error: 'User not found' });

    const blocked = db.exec(`SELECT id FROM blocked_users WHERE (blockerId = '${req.user.id}' AND blockedId = '${userId}') OR (blockerId = '${userId}' AND blockedId = '${req.user.id}') LIMIT 1`);
    if (blocked.length && blocked[0].values.length) return res.status(403).json({ error: 'Cannot start conversation with this user' });

    const conversationId = [req.user.id, userId].sort().join(':');
    res.json({ conversationId });
  } catch (err) { res.status(500).json({ error: 'Failed to start conversation' }); }
});

// List conversations for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const me = req.user.id;
    const rows = db.exec(`
      SELECT m.conversationId, m.content as lastMessage, m.createdAt as lastMessageAt,
             u.id as otherUserId, u.fullName as otherName, u.username as otherUsername, u.avatar as otherAvatar,
             (SELECT COUNT(*) FROM messages WHERE conversationId = m.conversationId AND receiverId = '${me}' AND isRead = 0) as unreadCount
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.senderId = '${me}' THEN m.receiverId ELSE m.senderId END
      WHERE m.id IN (
        SELECT MAX(m2.id) FROM messages m2 WHERE m2.conversationId IN (
          SELECT DISTINCT m3.conversationId FROM messages m3 WHERE m3.senderId = '${me}' OR m3.receiverId = '${me}'
        ) GROUP BY m2.conversationId
      )
      AND NOT EXISTS (SELECT 1 FROM blocked_users WHERE (blockerId = '${me}' AND blockedId = u.id) OR (blockerId = u.id AND blockedId = '${me}'))
      ORDER BY m.createdAt DESC
    `);
    if (!rows.length) return res.json({ conversations: [] });
    const cols = rows[0].columns;
    const conversations = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ conversations });
  } catch (err) { res.status(500).json({ error: 'Failed to load conversations' }); }
});

// Get messages in a conversation
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const me = req.user.id;
    const convId = req.params.conversationId.replace(/'/g, "''");
    const rows = db.exec(`
      SELECT m.*, u.fullName as senderName, u.username as senderUsername, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.conversationId = '${convId}'
        AND (m.senderId = '${me}' OR m.receiverId = '${me}')
      ORDER BY m.createdAt ASC
    `);
    if (!rows.length) return res.json({ messages: [] });
    const cols = rows[0].columns;
    const messages = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ messages });
  } catch (err) { res.status(500).json({ error: 'Failed to load messages' }); }
});

// Mark conversation as read
router.put('/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const me = req.user.id;
    const convId = req.params.conversationId.replace(/'/g, "''");
    db.run(`UPDATE messages SET isRead = 1, readAt = datetime('now') WHERE conversationId = '${convId}' AND receiverId = '${me}' AND isRead = 0`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to mark as read' }); }
});

// Mark single message as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE messages SET isRead = 1, readAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}' AND receiverId = '${req.user.id.replace(/'/g, "''")}'`);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to mark as read' }); }
});

module.exports = router;
module.exports.pushToUser = pushToUser;
