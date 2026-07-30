const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { generateToken, authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const db = await getDb();
    const { email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name required' });

    const existing = db.exec(`SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuid();
    db.run(
      `INSERT INTO users (id, email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'teacher')`,
      [id, email, hashed, fullName, phone || '', tscNumber || '', gender || '', teachingLevel || '', subjects || '', experience || '', schoolName || '', region || '', district || '']
    );
    saveDb();
    logAudit(id, 'REGISTER', 'User registered');
    const token = generateToken({ id, email, role: 'teacher' });
    res.status(201).json({ token, user: { id, email, fullName, role: 'teacher' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const db = await getDb();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const rows = db.exec(`SELECT * FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(401).json({ error: 'Invalid credentials' });

    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const user = {};
    cols.forEach((c, i) => user[c] = vals[i]);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    logAudit(user.id, 'LOGIN', 'User logged in', req.ip);
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, fullName: user.fullName, role: user.role,
        isTwoFactorEnabled: !!user.isTwoFactorEnabled, phone: user.phone, avatar: user.avatar,
        region: user.region, district: user.district, schoolName: user.schoolName,
        subjects: user.subjects, teachingLevel: user.teachingLevel, experience: user.experience,
        tscNumber: user.tscNumber, isVerified: !!user.isVerified, gender: user.gender,
        preferredRegion: user.preferredRegion, preferredDistrict: user.preferredDistrict, swapType: user.swapType
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM users WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const user = {};
    cols.forEach((c, i) => { if (c !== 'password' && c !== 'twoFactorSecret') user[c] = vals[i]; });
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const fields = ['fullName', 'phone', 'tscNumber', 'gender', 'teachingLevel', 'subjects', 'experience', 'schoolName', 'region', 'district', 'preferredRegion', 'preferredDistrict', 'swapType', 'reason', 'avatar', 'bio'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push("updatedAt = datetime('now')");
    values.push(req.user.id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
    logAudit(req.user.id, 'PROFILE_UPDATE', 'Profile updated');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teachers', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT id, fullName, email, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, isVerified, avatar FROM users WHERE role = 'teacher' AND id != '${req.user.id.replace(/'/g, "''")}'`);
    if (!rows.length) return res.json({ teachers: [] });
    const cols = rows[0].columns;
    const teachers = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ teachers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teachers/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT id, fullName, email, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, isVerified, avatar, createdAt FROM users WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Teacher not found' });
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const teacher = {};
    cols.forEach((c, i) => teacher[c] = vals[i]);
    res.json({ teacher });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
