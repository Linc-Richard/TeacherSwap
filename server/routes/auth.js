const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { generateToken, generateTempToken, authMiddleware, adminOnly, logAudit } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

function getRows(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

// Public configuration for auth clients. Only exposes non-secret data.
// The Google client ID is public by design; never expose the client secret here.
router.get('/config', (req, res) => {
  res.json({
    googleClientId: config.GOOGLE_CLIENT_ID || '',
    googleConfigured: !!config.GOOGLE_CLIENT_ID
  });
});

function validateUsername(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_]{3,30}$/.test(value)) {
    return { error: 'Username must be 3-30 characters using only letters, numbers, and underscore' };
  }
  return { value: value.toLowerCase() };
}

router.post('/register', async (req, res) => {
  try {
    const db = await getDb();
    const { email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, username } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name required' });

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (typeof password !== 'string' || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (username !== undefined && username !== null && username !== '') {
      const usernameResult = validateUsername(username);
      if (usernameResult.error) return res.status(400).json({ error: usernameResult.error });
      const existingU = getRows(db, 'SELECT id FROM users WHERE username = ?', [usernameResult.value]);
      if (existingU.length) return res.status(409).json({ error: 'This username is already taken' });
    }

    const existing = getRows(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuid();
    const uname = username !== undefined && username !== null && username !== '' ? validateUsername(username).value : null;
    try {
      db.run(
        `INSERT INTO users (id, email, password, fullName, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, username, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'teacher')`,
        [id, normalizedEmail, hashed, fullName, phone || '', tscNumber ? String(tscNumber).trim() : null, gender || '', teachingLevel || '', subjects || '', experience || '', schoolName || '', region || '', district || '', preferredRegion || '', preferredDistrict || '', swapType || '', reason || '', uname]
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
    const loginEmail = String(email).trim().toLowerCase();

    const userRows = getRows(db, 'SELECT * FROM users WHERE email = ?', [loginEmail]);
    if (!userRows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = userRows[0];

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

// Logout: JWT is stateless and stored client-side, so the token is simply
// discarded on the client. This endpoint exists for symmetry and to allow
// any future server-side token revocation; it returns 200 once the client
// has authenticated. The frontend removes 'ts-token'/'ts-user' from storage.
router.post('/logout', authMiddleware, (req, res) => {
  logAudit(req.user.id, 'LOGOUT', 'User logged out', req.ip);
  res.json({ success: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const userRows = getRows(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];
    delete user.password;
    delete user.twoFactorSecret;
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const fields = ['fullName', 'phone', 'tscNumber', 'gender', 'teachingLevel', 'subjects', 'experience', 'schoolName', 'region', 'district', 'preferredRegion', 'preferredDistrict', 'swapType', 'reason', 'avatar', 'bio', 'username'];
    const updates = [];
    const values = [];
    if (req.body.username !== undefined) {
      const usernameResult = validateUsername(req.body.username);
      if (usernameResult.error) return res.status(400).json({ error: usernameResult.error });
      const existingUsername = getRows(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [usernameResult.value, req.user.id]);
      if (existingUsername.length) return res.status(409).json({ error: 'Username already taken' });
      req.body.username = usernameResult.value;
    }
    if (req.body.tscNumber !== undefined) {
      const tscNumber = req.body.tscNumber === null ? null : String(req.body.tscNumber).trim();
      if (tscNumber) {
        const existingTsc = getRows(db, 'SELECT id FROM users WHERE tscNumber = ? AND id != ?', [tscNumber, req.user.id]);
        if (existingTsc.length) return res.status(409).json({ error: 'This TSC number is already registered' });
      }
      req.body.tscNumber = tscNumber;
    }
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
    const usernameResult = validateUsername(username);
    if (usernameResult.error) return res.json({ available: false, error: usernameResult.error });
    const existing = getRows(db, 'SELECT id FROM users WHERE username = ?', [usernameResult.value]);
    res.json({ available: existing.length === 0, username: usernameResult.value });
  } catch (err) { res.status(500).json({ error: 'Check failed' }); }
});

// Update username
router.put('/username', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const usernameResult = validateUsername(username);
    if (usernameResult.error) return res.status(400).json({ error: usernameResult.error });
    const uname = usernameResult.value;
    const existing = getRows(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [uname, req.user.id]);
    if (existing.length) return res.status(409).json({ error: 'Username already taken' });
    db.run("UPDATE users SET username = ?, updatedAt = datetime('now') WHERE id = ?", [uname, req.user.id]);
    saveDb();
    logAudit(req.user.id, 'USERNAME_CHANGE', `Username changed to ${uname}`);
    res.json({ success: true, username: uname });
  } catch (err) { res.status(500).json({ error: 'Failed to update username' }); }
});

router.get('/teachers', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const teachers = getRows(db, "SELECT id, fullName, username, email, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, isVerified, avatar, bio FROM users WHERE role = 'teacher' AND id != ?", [req.user.id]);
    res.json({ teachers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teachers/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const teacherRows = getRows(db, "SELECT id, fullName, email, phone, tscNumber, gender, teachingLevel, subjects, experience, schoolName, region, district, preferredRegion, preferredDistrict, swapType, reason, isVerified, avatar, createdAt FROM users WHERE id = ? AND role = 'teacher'", [req.params.id]);
    if (!teacherRows.length) return res.status(404).json({ error: 'Teacher not found' });
    const teacher = teacherRows[0];
    res.json({ teacher });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/promote', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
    const rows = getRows(db, 'SELECT id, fullName, email, role FROM users WHERE email = ?', [String(userEmail).trim().toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    if (user.role === 'admin') return res.status(409).json({ error: 'User is already an admin' });
    db.run("UPDATE users SET role = 'admin', updatedAt = datetime('now') WHERE id = ?", [user.id]);
    saveDb();
    logAudit(req.user.id, 'ADMIN_PROMOTE', `Promoted ${user.email} to admin`);
    res.json({ success: true, user: { id: user.id, fullName: user.fullName, email: user.email, role: 'admin' } });
  } catch (err) { res.status(500).json({ error: 'Failed to promote user' }); }
});

module.exports = router;
