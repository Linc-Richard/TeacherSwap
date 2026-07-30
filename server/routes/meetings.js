const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { responderId, swapRequestId, title, date, time, duration, location, videoLink, notes } = req.body;
    if (!responderId || !title || !date || !time) return res.status(400).json({ error: 'responderId, title, date, and time required' });
    const id = uuid();
    db.run(
      'INSERT INTO meetings (id, requesterId, responderId, swapRequestId, title, date, time, duration, location, videoLink, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, responderId, swapRequestId || null, title, date, time, duration || 30, location || '', videoLink || '', notes || '']
    );
    saveDb();
    logAudit(req.user.id, 'MEETING_CREATE', `Meeting with ${responderId}`);
    res.status(201).json({ id, status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM meetings WHERE requesterId = '${req.user.id.replace(/'/g, "''")}' OR responderId = '${req.user.id.replace(/'/g, "''")}' ORDER BY date ASC`);
    if (!rows.length) return res.json({ meetings: [] });
    const cols = rows[0].columns;
    const meetings = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ meetings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { status, date, time, duration, location, videoLink, notes } = req.body;
    if (status && !['accepted', 'rejected', 'cancelled', 'rescheduled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updates = [];
    const values = [];
    if (status) { updates.push('status = ?'); values.push(status); }
    if (date) { updates.push('date = ?'); values.push(date); }
    if (time) { updates.push('time = ?'); values.push(time); }
    if (duration) { updates.push('duration = ?'); values.push(duration); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }
    if (videoLink !== undefined) { updates.push('videoLink = ?'); values.push(videoLink); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    updates.push("updatedAt = datetime('now')");
    values.push(req.params.id);
    db.run(`UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
    logAudit(req.user.id, 'MEETING_UPDATE', `Meeting ${req.params.id} -> ${status || 'updated'}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
