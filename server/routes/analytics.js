const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const getVal = (sql) => { const r = db.exec(sql); return (r.length && r[0].values.length) ? r[0].values[0][0] : 0; };

    const totalTeachers = getVal("SELECT COUNT(*) FROM users WHERE role = 'teacher'");
    const verifiedTeachers = getVal("SELECT COUNT(*) FROM users WHERE isVerified = 1");
    const totalSwaps = getVal('SELECT COUNT(*) FROM swap_requests');
    const completedSwaps = getVal("SELECT COUNT(*) FROM swap_requests WHERE status = 'completed'");
    const pendingSwaps = getVal("SELECT COUNT(*) FROM swap_requests WHERE status = 'pending'");
    const totalReviews = getVal('SELECT COUNT(*) FROM reviews');
    const totalSchools = getVal('SELECT COUNT(*) FROM schools');
    const flaggedReviews = getVal('SELECT COUNT(*) FROM reviews WHERE isFlagged = 1');
    const activeUsers = getVal("SELECT COUNT(DISTINCT userId) FROM audit_logs WHERE createdAt > datetime('now', '-7 days')");

    res.json({
      totalTeachers, verifiedTeachers, totalSwaps, completedSwaps, pendingSwaps,
      totalReviews, totalSchools, flaggedReviews, activeUsers
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/charts', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const getRows = (sql) => { const r = db.exec(sql); if (!r.length) return []; const cols = r[0].columns; return r[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; }); };

    const regionDist = getRows("SELECT region, COUNT(*) as count FROM users WHERE region != '' GROUP BY region ORDER BY count DESC LIMIT 10");
    const subjectDist = getRows("SELECT subjects, COUNT(*) as count FROM users WHERE subjects != '' GROUP BY subjects ORDER BY count DESC LIMIT 10");
    const recentRegistrations = getRows("SELECT date(createdAt) as date, COUNT(*) as count FROM users GROUP BY date(createdAt) ORDER BY date DESC LIMIT 14");

    res.json({ regionDist, subjectDist, recentRegistrations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recent', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const getRows = (sql) => { const r = db.exec(sql); if (!r.length) return []; const cols = r[0].columns; return r[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; }); };

    const recentUsers = getRows("SELECT id, fullName, email, role, createdAt FROM users ORDER BY createdAt DESC LIMIT 10");
    const recentSwaps = getRows("SELECT s.*, u1.fullName as fromName, u2.fullName as toName FROM swap_requests s JOIN users u1 ON s.fromUserId = u1.id JOIN users u2 ON s.toUserId = u2.id ORDER BY s.createdAt DESC LIMIT 10");
    const recentReviews = getRows("SELECT r.*, u1.fullName as fromName, u2.fullName as toName FROM reviews r JOIN users u1 ON r.fromUserId = u1.id JOIN users u2 ON r.toUserId = u2.id ORDER BY r.createdAt DESC LIMIT 10");

    res.json({ recentUsers, recentSwaps, recentReviews });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
