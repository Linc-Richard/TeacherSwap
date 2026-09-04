const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Search teachers by username, name, subject, region, district with filters, ratings, and pagination.
// Filters: q, region, district, level, subject, experience, swapType, verified
// Pagination: page (1-based), limit (1-50, default 12)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const q = (req.query.q || '').trim();
    const region = (req.query.region || '').trim();
    const district = (req.query.district || '').trim();
    const level = (req.query.level || '').trim();
    const subject = (req.query.subject || '').trim();
    const experience = (req.query.experience || '').trim();
    const swapType = (req.query.swapType || '').trim();
    const verified = (req.query.verified || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    const where = ["u.role = 'teacher'", "u.id != '" + req.user.id.replace(/'/g, "''") + "'"];

    if (q) {
      const safe = q.replace(/'/g, "''").toLowerCase();
      where.push(`(
        LOWER(u.username) LIKE '%${safe}%'
        OR LOWER(u.fullName) LIKE '%${safe}%'
        OR LOWER(u.subjects) LIKE '%${safe}%'
        OR LOWER(u.region) LIKE '%${safe}%'
        OR LOWER(u.district) LIKE '%${safe}%'
        OR LOWER(u.schoolName) LIKE '%${safe}%'
      )`);
    }
    if (region && region !== 'all') where.push(`u.region = '${region.replace(/'/g, "''")}'`);
    if (district) {
      const d = district.replace(/'/g, "''").toLowerCase();
      where.push(`(LOWER(u.district) LIKE '%${d}%' OR LOWER(u.schoolName) LIKE '%${d}%')`);
    }
    if (level && level !== 'all') where.push(`(LOWER(u.teachingLevel) = '${level.toLowerCase()}' OR LOWER(u.teachingLevel) = 'both')`);
    if (subject && subject !== 'all') where.push(`LOWER(u.subjects) LIKE '%${subject.replace(/'/g, "''").toLowerCase()}%'`);
    if (experience && experience !== 'all') where.push(`u.experience LIKE '%${experience.replace(/'/g, "''")}%'`);
    if (swapType && swapType !== 'all') where.push(`(u.swapType = '${swapType.replace(/'/g, "''")}' OR u.swapType = 'either')`);
    if (verified === 'true' || verified === '1') where.push('u.isVerified = 1');
    if (verified === 'false' || verified === '0') where.push('u.isVerified = 0');

    const whereSql = where.join(' AND ');

    const countRows = db.exec(`SELECT COUNT(*) AS c FROM users u WHERE ${whereSql}`);
    const total = (countRows.length && countRows[0].values.length) ? countRows[0].values[0][0] : 0;

    const sql = `SELECT u.id, u.fullName, u.username, u.subjects, u.experience, u.schoolName,
        u.region, u.district, u.preferredRegion, u.preferredDistrict, u.swapType, u.isVerified, u.avatar,
        u.bio, u.teachingLevel, u.gender, u.createdAt,
        COALESCE(rv.avgRating, 0) AS rating, COALESCE(rv.cnt, 0) AS reviewCount
      FROM users u
      LEFT JOIN (
        SELECT toUserId, ROUND(AVG(rating), 1) AS avgRating, COUNT(*) AS cnt
        FROM reviews WHERE isFlagged = 0 GROUP BY toUserId
      ) rv ON rv.toUserId = u.id
      WHERE ${whereSql}
      ORDER BY u.isVerified DESC, u.fullName ASC
      LIMIT ${limit} OFFSET ${offset}`;

    const rows = db.exec(sql);
    if (!rows.length) return res.json({ teachers: [], total, page, limit, pages: Math.ceil(total / limit) });
    const cols = rows[0].columns;
    const teachers = rows[0].values.map(v => {
      const o = {};
      cols.forEach((c, i) => o[c] = v[i]);
      return o;
    });
    res.json({ teachers, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: 'Failed to search teachers' }); }
});

// Get teacher by username
router.get('/by-username/:username', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const uname = req.params.username.replace(/'/g, "''").toLowerCase();
    const rows = db.exec(`SELECT id, fullName, username, email, phone, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, teachingLevel, reason, isVerified, avatar, bio, createdAt
      FROM users WHERE LOWER(username) = '${uname}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Teacher not found' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const teacher = {};
    cols.forEach((c, i) => teacher[c] = vals[i]);
    res.json({ teacher });
  } catch (err) { res.status(500).json({ error: 'Failed to load teacher' }); }
});

// Professional public teacher profile: safe fields + rating summary + mutuality compatibility.
// The authenticated requester is used to compute compatibility. Never returns sensitive fields.
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const uid = req.params.id.replace(/'/g, "''");
    if (uid === req.user.id) return res.status(400).json({ error: 'Use your own profile page for your account' });

    const rows = db.exec(`SELECT id, fullName, username, subjects, experience, schoolName, region, district,
        preferredRegion, preferredDistrict, swapType, bio, avatar, teachingLevel, gender, isVerified, createdAt
      FROM users WHERE id = '${uid}' AND role = 'teacher'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Teacher not found' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const teacher = {};
    cols.forEach((c, i) => teacher[c] = vals[i]);

    // Rating summary from non-flagged reviews
    const revRows = db.exec(`SELECT rating FROM reviews WHERE toUserId = '${uid}' AND isFlagged = 0`);
    const ratings = (revRows.length && revRows[0].values.length) ? revRows[0].values.map(r => Number(r[0])) : [];
    const total = ratings.length;
    const average = total ? Math.round((ratings.reduce((s, r) => s + r, 0) / total) * 10) / 10 : 0;
    const distribution = [0, 0, 0, 0, 0];
    ratings.forEach(r => { if (r >= 1 && r <= 5) distribution[r - 1]++; });
    const rating = { average, total, distribution };

    // Compatibility between the requester and this teacher (mirrors client-side scoring)
    const meRows = db.exec(`SELECT region, district, preferredRegion, preferredDistrict, subjects, teachingLevel, swapType FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    const me = (meRows.length && meRows[0].values.length)
      ? { region: meRows[0].values[0][0], district: meRows[0].values[0][1], preferredRegion: meRows[0].values[0][2], preferredDistrict: meRows[0].values[0][3], subjects: meRows[0].values[0][4], teachingLevel: meRows[0].values[0][5], swapType: meRows[0].values[0][6] }
      : null;
    const compatibility = computeCompatibility(me, teacher);

    res.json({ teacher, rating, compatibility });
  } catch (err) { res.status(500).json({ error: 'Failed to load teacher' }); }
});

function computeCompatibility(me, t) {
  if (!me) return { score: 0, mutual: false, reasons: [] };
  let score = 50;
  const reasons = [];
  if (me.preferredRegion && t.region && me.preferredRegion === t.region) { score += 15; reasons.push('You want this region: they are currently here.'); }
  if (me.region && t.preferredRegion && me.region === t.preferredRegion) { score += 15; reasons.push('They want your region: you are currently there.'); }
  if (me.preferredDistrict && t.district && String(me.preferredDistrict).toLowerCase() === String(t.district).toLowerCase()) { score += 10; reasons.push('District preference aligns.'); }
  if (me.district && t.preferredDistrict && String(me.district).toLowerCase() === String(t.preferredDistrict).toLowerCase()) { score += 10; reasons.push('Their preferred district matches your current one.'); }
  const mine = (me.subjects || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const theirs = (t.subjects || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const common = mine.filter(s => theirs.indexOf(s) !== -1);
  if (common.length > 0) { score += Math.min(common.length * 5, 15); reasons.push('Shared subject(s): ' + common.join(', ')); }
  if (me.teachingLevel && t.teachingLevel && String(me.teachingLevel).toLowerCase() === String(t.teachingLevel).toLowerCase()) { score += 5; reasons.push('Same teaching level.'); }
  if (me.swapType && t.swapType && (String(me.swapType).toLowerCase() === String(t.swapType).toLowerCase() || String(t.swapType).toLowerCase() === 'either')) { score += 5; reasons.push('Same swap type.'); }
  score = Math.min(Math.max(score, 0), 99);
  return { score, mutual: score >= 70, reasons };
}

module.exports = router;
