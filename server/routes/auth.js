const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { generateToken, generateTempToken, authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const db = await getDb();
    const { email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, username } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name required' });

    if (username) {
      const uname = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, underscore)' });
      const existingU = db.exec(`SELECT id FROM users WHERE username = '${uname}'`);
      if (existingU.length && existingU[0].values.length) return res.status(409).json({ error: 'This username is already taken' });
    }

    const existing = db.exec(`SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuid();
    const uname = username ? String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') : null;
    try {
      db.run(
        `INSERT INTO users (id, email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, username, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'teacher')`,
        [id, email, hashed, fullName, phone || '', tscNumber ? String(tscNumber).trim() : null, gender || '', teachingLevel || '', subjects || '', experience || '', schoolName || '', region || '', district || '', preferredRegion || '', preferredDistrict || '', swapType || '', reason || '', uname]
      );
    } catch (e) {
      if (String(e.message).includes('tscNumber')) return res.status(409).json({ error: 'This TSC number is already registered' });
      if (String(e.message).includes('username')) return res.status(409).json({ error: 'This username is already taken' });
      throw e;
    }
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

    if (user.isTwoFactorEnabled) {
      const tempToken = generateTempToken({ id: user.id, email: user.email, role: user.role }, '2fa');
      logAudit(user.id, 'LOGIN_2FA_PENDING', '2FA challenge issued', req.ip);
      return res.json({
        requires2FA: true,
        tempToken,
        user: { id: user.id, email: user.email, fullName: user.fullName }
      });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, fullName: user.fullName, role: user.role,
        isTwoFactorEnabled: !!user.isTwoFactorEnabled, phone: user.phone, avatar: user.avatar,
        region: user.region, district: user.district, schoolName: user.schoolName,
        subjects: user.subjects, teachingLevel: user.teachingLevel, experience: user.experience,
        tscNumber: user.tscNumber, isVerified: !!user.isVerified, gender: user.gender,
        preferredRegion: user.preferredRegion, preferredDistrict: user.preferredDistrict, swapType: user.swapType,
        username: user.username, bio: user.bio
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
    const fields = ['fullName', 'phone', 'tscNumber', 'gender', 'teachingLevel', 'subjects', 'experience', 'schoolName', 'region', 'district', 'preferredRegion', 'preferredDistrict', 'swapType', 'reason', 'avatar', 'bio', 'username'];
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

// Check if a username is available
router.post('/check-username', async (req, res) => {
  try {
    const db = await getDb();
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const uname = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (uname.length < 3) return res.json({ available: false, error: 'Username must be at least 3 characters' });
    if (uname.length > 30) return res.json({ available: false, error: 'Username must be 30 characters or fewer' });
    const existing = db.exec(`SELECT id FROM users WHERE username = '${uname}'`);
    const taken = existing.length && existing[0].values.length;
    res.json({ available: !taken, username: uname });
  } catch (err) { res.status(500).json({ error: 'Check failed' }); }
});

// Update username
router.put('/username', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const uname = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (uname.length > 30) return res.status(400).json({ error: 'Username must be 30 characters or fewer' });
    const existing = db.exec(`SELECT id FROM users WHERE username = '${uname}' AND id != '${req.user.id}'`);
    if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Username already taken' });
    db.run(`UPDATE users SET username = '${uname}', updatedAt = datetime('now') WHERE id = '${req.user.id}'`);
    saveDb();
    logAudit(req.user.id, 'USERNAME_CHANGE', `Username changed to ${uname}`);
    res.json({ success: true, username: uname });
  } catch (err) { res.status(500).json({ error: 'Failed to update username' }); }
});

router.get('/teachers', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT id, fullName, username, email, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, isVerified, avatar, bio FROM users WHERE role = 'teacher' AND id != '${req.user.id.replace(/'/g, "''")}'`);
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
