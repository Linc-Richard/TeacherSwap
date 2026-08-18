const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Search teachers by username, name, subject, region, district
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const q = (req.query.q || '').trim();
    const conditions = ["role = 'teacher'", "id != '" + req.user.id.replace(/'/g, "''") + "'"];

    if (q) {
      const safe = q.replace(/'/g, "''").toLowerCase();
      conditions.push(`(
        LOWER(username) LIKE '%${safe}%'
        OR LOWER(fullName) LIKE '%${safe}%'
        OR LOWER(subjects) LIKE '%${safe}%'
        OR LOWER(region) LIKE '%${safe}%'
        OR LOWER(district) LIKE '%${safe}%'
        OR LOWER(schoolName) LIKE '%${safe}%'
      )`);
    }

    const sql = `SELECT id, fullName, username, email, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, isVerified, avatar, bio
      FROM users WHERE ${conditions.join(' AND ')}
      ORDER BY isVerified DESC, fullName ASC
      LIMIT 50`;

    const rows = db.exec(sql);
    if (!rows.length) return res.json({ teachers: [] });
    const cols = rows[0].columns;
    const teachers = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ teachers });
  } catch (err) { res.status(500).json({ error: 'Failed to search teachers' }); }
});

// Get teacher by username
router.get('/by-username/:username', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const uname = req.params.username.replace(/'/g, "''").toLowerCase();
    const rows = db.exec(`SELECT id, fullName, username, email, phone, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, isVerified, avatar, bio, createdAt
      FROM users WHERE LOWER(username) = '${uname}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Teacher not found' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const teacher = {};
    cols.forEach((c, i) => teacher[c] = vals[i]);
    res.json({ teacher });
  } catch (err) { res.status(500).json({ error: 'Failed to load teacher' }); }
});

module.exports = router;
