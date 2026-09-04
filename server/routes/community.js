const express = require('express');
const { getDb } = require('../db/database');

const router = express.Router();

// Public community activity feed built from existing data
router.get('/activity', async (req, res) => {
  try {
    const db = await getDb();
    const run = (sql) => {
      const rows = db.exec(sql);
      if (!rows.length) return [];
      const cols = rows[0].columns;
      return rows[0].values.map(v => {
        const o = {};
        cols.forEach((c, i) => o[c] = v[i]);
        return o;
      });
    };
    const teachers = run(
      "SELECT id, fullName, username, subjects, region, schoolName, avatar, createdAt FROM users WHERE role = 'teacher' ORDER BY createdAt DESC LIMIT 8"
    );
    const swaps = run(
      "SELECT sr.status, sr.createdAt, u1.fullName AS fromName, u2.fullName AS toName FROM swap_requests sr JOIN users u1 ON u1.id = sr.fromUserId JOIN users u2 ON u2.id = sr.toUserId ORDER BY sr.createdAt DESC LIMIT 8"
    );
    const reviews = run(
      "SELECT r.rating, r.feedback, r.createdAt, u1.fullName AS fromName, u2.fullName AS toName FROM reviews r JOIN users u1 ON u1.id = r.fromUserId JOIN users u2 ON u2.id = r.toUserId ORDER BY r.createdAt DESC LIMIT 8"
    );
    res.json({ teachers, swaps, reviews });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;