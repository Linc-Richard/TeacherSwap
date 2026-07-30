const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const userRows = db.exec(`SELECT * FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    if (!userRows.length || !userRows[0].values.length) return res.status(404).json({ error: 'User not found' });
    const uCols = userRows[0].columns;
    const uVals = userRows[0].values[0];
    const user = {};
    uCols.forEach((c, i) => user[c] = uVals[i]);

    const teacherRows = db.exec(`SELECT id, fullName, subjects, experience, region, district, schoolName, preferredRegion, preferredDistrict, teachingLevel, swapType, isVerified, avatar FROM users WHERE role = 'teacher' AND id != '${req.user.id.replace(/'/g, "''")}'`);
    if (!teacherRows.length) return res.json({ recommendations: [] });
    const tCols = teacherRows[0].columns;
    const teachers = teacherRows[0].values.map(v => { const o = {}; tCols.forEach((c, i) => o[c] = v[i]); return o; });

    const recommendations = teachers.map(t => {
      let score = 50;
      const reasons = [];

      if (user.preferredRegion && t.region === user.preferredRegion) { score += 15; reasons.push('Located in your preferred region'); }
      if (user.region && t.preferredRegion === user.region) { score += 15; reasons.push('Wants to move to your region'); }
      if (user.preferredDistrict && t.district === user.preferredDistrict) { score += 10; reasons.push('Located in your preferred district'); }
      if (user.district && t.preferredDistrict === user.district) { score += 10; reasons.push('Wants to move to your district'); }

      const userSubjects = (user.subjects || '').split(',').map(s => s.trim().toLowerCase());
      const teacherSubjects = (t.subjects || '').split(',').map(s => s.trim().toLowerCase());
      const common = userSubjects.filter(s => teacherSubjects.includes(s));
      if (common.length > 0) { score += Math.min(common.length * 5, 15); reasons.push(`Shares subjects: ${common.join(', ')}`); }

      if (user.teachingLevel && t.teachingLevel === user.teachingLevel) { score += 5; reasons.push('Same teaching level'); }
      if (user.experience && t.experience === user.experience) { score += 5; reasons.push('Similar experience level'); }
      if (user.swapType && t.swapType === user.swapType) { score += 5; reasons.push('Same swap type preference'); }

      score = Math.min(Math.max(score, 0), 99);

      let badge = '';
      if (score >= 85) badge = 'Excellent Match';
      else if (score >= 70) badge = 'Great Match';
      else if (score >= 55) badge = 'Good Match';
      else badge = 'Possible Match';

      return {
        teacher: t,
        score: Math.round(score),
        badge,
        explanation: reasons.slice(0, 3),
        mutualCompatibility: score >= 70
      };
    }).sort((a, b) => b.score - a.score);

    const topRecs = recommendations.slice(0, 10);
    topRecs.forEach(r => {
      const recId = uuid();
      db.run('INSERT INTO ai_recommendations (id, userId, recommendedUserId, score, explanation) VALUES (?, ?, ?, ?, ?)',
        [recId, req.user.id, r.teacher.id, r.score, r.explanation.join(' | ')]);
    });
    saveDb();

    res.json({
      recommendations: topRecs,
      topMatch: topRecs[0] || null,
      totalTeachers: teachers.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM ai_recommendations WHERE userId = '${req.user.id.replace(/'/g, "''")}' ORDER BY createdAt DESC LIMIT 20`);
    if (!rows.length) return res.json({ history: [] });
    const cols = rows[0].columns;
    const history = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
