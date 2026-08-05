const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { generateToken, logAudit } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential token required' });

    let payload;
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevToken = typeof credential === 'string' && credential.endsWith('.dev');

    if (config.GOOGLE_CLIENT_ID && !isDevToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: config.GOOGLE_CLIENT_ID
        });
        payload = ticket.getPayload();
      } catch {
        if (isProduction) {
          return res.status(401).json({ error: 'Invalid Google token' });
        }
      }
    }

    if (!payload) {
      if (isProduction) {
        return res.status(401).json({ error: 'Google sign-in is not configured in production' });
      }
      // Dev/demo mode only: decode the JWT without verifying
      try {
        const parts = credential.split('.');
        if (parts.length !== 3) throw new Error('Invalid token');
        payload = JSON.parse(atob(parts[1]));
      } catch {
        return res.status(400).json({ error: 'Invalid Google token. Set a valid GOOGLE_CLIENT_ID in .env for production or use a valid credential.' });
      }
    }

    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const db = await getDb();
    const email = payload.email;
    const fullName = payload.name || payload.email.split('@')[0];
    const googleId = payload.sub;
    const avatar = payload.picture || '';

    const existing = db.exec(`SELECT * FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
    if (existing.length && existing[0].values.length) {
      const cols = existing[0].columns;
      const vals = existing[0].values[0];
      const user = {};
      cols.forEach((c, i) => user[c] = vals[i]);

      db.run(`UPDATE users SET googleId = '${googleId.replace(/'/g, "''")}', avatar = COALESCE(NULLIF('${avatar.replace(/'/g, "''")}', ''), avatar), updatedAt = datetime('now') WHERE id = '${user.id.replace(/'/g, "''")}'`);
      saveDb();

      logAudit(user.id, 'GOOGLE_LOGIN', 'User logged in via Google');
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      return res.json({
        token,
        user: {
          id: user.id, email: user.email, fullName: user.fullName, role: user.role,
          phone: user.phone, avatar: user.avatar || avatar,
          region: user.region, district: user.district, schoolName: user.schoolName,
          subjects: user.subjects, teachingLevel: user.teachingLevel, experience: user.experience,
          isVerified: !!user.isVerified, preferredRegion: user.preferredRegion,
          preferredDistrict: user.preferredDistrict, swapType: user.swapType
        }
      });
    }

    // New user - register with Google
    const id = uuid();
    const randomPw = await bcrypt.hash(uuid(), 10);
    db.run(
      `INSERT INTO users (id, email, password, fullName, googleId, avatar, role, isVerified)
       VALUES (?, ?, ?, ?, ?, ?, 'teacher', 1)`,
      [id, email, randomPw, fullName, googleId, avatar]
    );
    saveDb();

    logAudit(id, 'GOOGLE_REGISTER', 'User registered via Google');
    const token = generateToken({ id, email, role: 'teacher' });
    res.status(201).json({
      token,
      user: { id, email, fullName, role: 'teacher', avatar, isVerified: true }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
