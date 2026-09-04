const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { generateToken, logAudit } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

// ─── Redirect-based OAuth flow ───────────────────────────────────
// This is the primary Google login flow.  No popup, no window.opener,
// no postMessage — the browser navigates to Google and back.

function getOAuth2Client() {
  return new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );
}

// Step 1: redirect the browser to Google's OAuth consent page.
router.get('/google', (req, res) => {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(renderErrorPage('Google sign-in is not configured on the server. Please use email/password login.'));
  }
  const client = getOAuth2Client();
  // CSRF protection: signed state = timestamp.hmac
  const ts = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', config.JWT_SECRET).update(ts + ':' + nonce).digest('hex');
  const state = ts + '.' + nonce + '.' + sig;
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state: state
  });
  res.redirect(url);
});

// Step 2: Google redirects here with ?code=...&state=...
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login.html?error=no_code');
  }

  // CSRF check: verify signed state (valid for 10 minutes)
  if (state) {
    const parts = state.split('.');
    if (parts.length !== 3) return res.redirect('/login.html?error=state_mismatch');
    const [tsStr, nonce, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', config.JWT_SECRET).update(tsStr + ':' + nonce).digest('hex');
    const ts = Number(tsStr);
    if (sig !== expectedSig || !ts || Date.now() - ts > 600000) {
      return res.redirect('/login.html?error=state_mismatch');
    }
  }

  try {
    console.log('[google-callback] Step 1: code received=' + !!code + ' state received=' + !!state);
    const client = getOAuth2Client();
    console.log('[google-callback] Step 2: OAuth2Client created, clientId=' + (config.GOOGLE_CLIENT_ID || '').slice(0, 12) + '...');

    let tokens;
    try {
      tokens = (await client.getToken(code)).tokens;
      console.log('[google-callback] Step 3: token exchange SUCCESS, has_id_token=' + !!tokens.id_token);
    } catch (tokenErr) {
      console.error('[google-callback] Step 3 FAILED: token exchange error:', tokenErr.message);
      if (tokenErr.response && tokenErr.response.data) {
        console.error('[google-callback]   Google error details:', JSON.stringify(tokenErr.response.data));
      }
      return res.redirect('/login.html?error=token_exchange_failed&detail=' + encodeURIComponent(tokenErr.message));
    }

    let ticket;
    try {
      const idToken = tokens.id_token;
      if (!idToken) {
        console.error('[google-callback] Step 4 FAILED: Google did not return an ID token');
        return res.redirect('/login.html?error=missing_id_token');
      }
      ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: config.GOOGLE_CLIENT_ID
      });
      console.log('[google-callback] Step 4: token verification SUCCESS');
    } catch (verifyErr) {
      console.error('[google-callback] Step 4 FAILED: verify error:', verifyErr.message);
      return res.redirect('/login.html?error=token_verify_failed&detail=' + encodeURIComponent(verifyErr.message));
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email || payload.email_verified !== true || !payload.sub) {
      console.error('[google-callback] Step 5 FAILED: invalid payload email=' + !!(payload && payload.email) + ' verified=' + (payload && payload.email_verified) + ' sub=' + !!(payload && payload.sub));
      return res.redirect('/login.html?error=invalid_token');
    }
    console.log('[google-callback] Step 5: payload OK, email=' + payload.email.slice(0, 3) + '...');

    const db = await getDb();
    console.log('[google-callback] Step 6: database ready');
    const email = String(payload.email).trim().toLowerCase();
    const fullName = payload.name || email.split('@')[0];
    const googleId = payload.sub;
    const avatar = payload.picture || '';
    const now = new Date().toISOString();

    let user, token;

    // 1) Existing Google-linked account
    let rows = getRows(db, 'SELECT * FROM users WHERE googleId = ?', [googleId]);
    if (rows.length) {
      user = rows[0];
      db.run("UPDATE users SET avatar = COALESCE(NULLIF(?, ''), avatar), authProvider = 'google', lastLoginAt = ?, updatedAt = ? WHERE id = ?",
        [avatar, now, now, user.id]);
      saveDb();
      logAudit(user.id, 'GOOGLE_LOGIN', 'User logged in via Google (redirect)');
      token = generateToken({ id: user.id, email: user.email, role: user.role });
      console.log('[google-callback] Step 7a: existing Google user, redirecting with token');
      return res.redirect(`/login.html?google_token=${encodeURIComponent(token)}&google_user=${encodeURIComponent(JSON.stringify(serializeUser(user, 'google')))}`);
    }

    // 2) Link to existing email/password account
    rows = getRows(db, 'SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length) {
      user = rows[0];
      db.run("UPDATE users SET googleId = ?, authProvider = 'google', avatar = COALESCE(NULLIF(?, ''), avatar), lastLoginAt = ?, updatedAt = ? WHERE id = ?",
        [googleId, avatar, now, now, user.id]);
      saveDb();
      logAudit(user.id, 'GOOGLE_LINK', 'Google account linked to existing user (redirect)');
      token = generateToken({ id: user.id, email: user.email, role: user.role });
      console.log('[google-callback] Step 7b: linked to existing user, redirecting with token');
      return res.redirect(`/login.html?google_token=${encodeURIComponent(token)}&google_user=${encodeURIComponent(JSON.stringify(serializeUser(user, 'google')))}`);
    }

    // 3) Create new account
    const id = uuid();
    const randomPw = await bcrypt.hash(uuid() + Date.now(), 10);
    db.run(
      `INSERT INTO users (id, email, password, fullName, googleId, authProvider, avatar, role, isVerified, lastLoginAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'google', ?, 'teacher', 1, ?, ?, ?)`,
      [id, email, randomPw, fullName, googleId, avatar, now, now, now]
    );
    saveDb();
    logAudit(id, 'GOOGLE_REGISTER', 'User registered via Google (redirect)');
    token = generateToken({ id, email, role: 'teacher' });
    user = { id, email, fullName, role: 'teacher', authProvider: 'google', avatar, isVerified: true };
    console.log('[google-callback] Step 7c: new user created, redirecting with token');
    return res.redirect(`/login.html?google_token=${encodeURIComponent(token)}&google_user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (err) {
    console.error('[google-callback] UNHANDLED error:', err && err.message);
    console.error('[google-callback] Stack:', err && err.stack);
    return res.redirect('/login.html?error=google_auth_failed&detail=' + encodeURIComponent(err && err.message || 'unknown'));
  }
});

// Small HTML page sent by the backend that stores the JWT and redirects to dashboard.
// This avoids any need for popup/postMessage — the redirect flow is entirely
// server-driven and lands on a normal page.
function renderErrorPage(message) {
  return `<!DOCTYPE html><html><head><title>TeacherSwap</title></head><body style="font-family:Poppins,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f8fc;">
    <div style="text-align:center;max-width:400px;padding:32px;">
      <h2 style="color:#6366f1;">TeacherSwap</h2>
      <p style="color:#64748b;">${message}</p>
      <a href="/login.html" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Back to Login</a>
    </div></body></html>`;
}

function getRows(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

// Defer creating the OAuth2Client until we know a client ID is configured.
// Used by the legacy POST /google endpoint (ID-token verification).
let googleClient = null;
function ensureClient() {
  if (!config.GOOGLE_CLIENT_ID) return null;
  if (!googleClient) googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  return googleClient;
}

// Verify a Google ID token and return the trusted payload, or throw a
// friendly error. Only the verified `sub` is accepted as the stable Google
// account identifier; email/name come from the verified token.
async function verifyGoogleToken(credential) {
  const client = ensureClient();
  if (!client) {
    const err = new Error('Google sign-in is not configured on the server. Please set GOOGLE_CLIENT_ID in the environment.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  if (typeof credential !== 'string' || !credential || credential.split('.').length !== 3) {
    const err = new Error('Invalid Google credential.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID
    });
  } catch (verErr) {
    const code = verErr && verErr.code;
    const msg = String(verErr && verErr.message || '');
    if (/expired|used too late|used too early|token used/i.test(msg) || code === 401) {
      const err = new Error('Your Google sign-in has expired. Please try again.');
      err.code = 'GOOGLE_EXPIRED';
      throw err;
    }
    if (/audience|client/i.test(msg)) {
      const err = new Error('Google sign-in is not configured for this client.');
      err.code = 'GOOGLE_CLIENT_MISMATCH';
      throw err;
    }
    const err = new Error('Google could not verify your sign-in. Please try again.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const err = new Error('Google could not verify your sign-in. Please try again.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  // Verify issuer (accounts.google.com).
  const iss = String(payload.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
    const err = new Error('Google sign-in failed: unrecognized issuer.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  // Verify audience explicitly against our client ID.
  const aud = String(payload.aud || '');
  if (aud !== config.GOOGLE_CLIENT_ID) {
    const err = new Error('Google sign-in failed: incorrect client.');
    err.code = 'GOOGLE_CLIENT_MISMATCH';
    throw err;
  }

  // Require a verified email for account linking.
  if (!payload.email || payload.email_verified !== true) {
    const err = new Error('Your Google account must have a verified email to sign in.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  if (!payload.sub) {
    const err = new Error('Google sign-in failed: missing account identifier.');
    err.code = 'GOOGLE_INVALID';
    throw err;
  }

  return payload;
}

router.post('/google', async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'Google credential token required' });
  }

  let payload;
  try {
    // Uses the real Google verifier by default. The verifier is injectable so
    // the find/link/create account logic can be tested deterministically.
    payload = await googleVerify(credential);
  } catch (err) {
    const status = err.code === 'GOOGLE_NOT_CONFIGURED' ? 503
      : (err.code === 'GOOGLE_EXPIRED' ? 401
      : (err.code === 'GOOGLE_CLIENT_MISMATCH' ? 401 : 400));
    return res.status(status).json({ error: err.message });
  }

  try {
    const db = await getDb();
    const email = String(payload.email).trim().toLowerCase();
    const fullName = payload.name || email.split('@')[0];
    const googleId = payload.sub;
    const avatar = payload.picture || '';
    const now = new Date().toISOString();

    // 1) Existing Google-linked account (by verified sub).
    let rows = getRows(db, 'SELECT * FROM users WHERE googleId = ?', [googleId]);
    if (rows.length) {
      const user = rows[0];
      db.run("UPDATE users SET avatar = COALESCE(NULLIF(?, ''), avatar), authProvider = 'google', lastLoginAt = ?, updatedAt = ? WHERE id = ?",
        [avatar, now, now, user.id]);
      saveDb();
      logAudit(user.id, 'GOOGLE_LOGIN', 'User logged in via Google');
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ token, user: serializeUser(user, 'google') });
    }

    // 2) Link to an existing account with a matching email (never overwrite password).
    rows = getRows(db, 'SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length) {
      const user = rows[0];
      db.run("UPDATE users SET googleId = ?, authProvider = 'google', avatar = COALESCE(NULLIF(?, ''), avatar), lastLoginAt = ?, updatedAt = ? WHERE id = ?",
        [googleId, avatar, now, now, user.id]);
      saveDb();
      logAudit(user.id, 'GOOGLE_LINK', 'Google account linked to existing user');
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ token, user: serializeUser(user, 'google') });
    }

    // 3) Create a new TeacherSwap account.
    const id = uuid();
    const randomPw = await bcrypt.hash(uuid() + Date.now(), 10);
    db.run(
      `INSERT INTO users (id, email, password, fullName, googleId, authProvider, avatar, role, isVerified, lastLoginAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'google', ?, 'teacher', 1, ?, ?, ?)`,
      [id, email, randomPw, fullName, googleId, avatar, now, now, now]
    );
    saveDb();
    logAudit(id, 'GOOGLE_REGISTER', 'User registered via Google');
    const token = generateToken({ id, email, role: 'teacher' });
    return res.status(201).json({
      token,
      user: { id, email, fullName, role: 'teacher', authProvider: 'google', avatar, isVerified: true }
    });
  } catch (err) {
    // Never expose database errors or stack traces. Do not log the credential.
    console.error('Google sign-in error:', err && err.message);
    return res.status(500).json({ error: 'An unexpected error occurred during Google sign-in. Please try again.' });
  }
});

function serializeUser(user, provider) {
  return {
    id: user.id, email: user.email, fullName: user.fullName, role: user.role,
    authProvider: provider || user.authProvider || 'google',
    isTwoFactorEnabled: !!user.isTwoFactorEnabled, phone: user.phone, avatar: user.avatar,
    region: user.region, district: user.district, schoolName: user.schoolName,
    subjects: user.subjects, teachingLevel: user.teachingLevel, experience: user.experience,
    tscNumber: user.tscNumber, isVerified: !!user.isVerified, gender: user.gender,
    preferredRegion: user.preferredRegion, preferredDistrict: user.preferredDistrict,
    swapType: user.swapType, username: user.username, bio: user.bio, googleId: user.googleId || ''
  };
}

// Real Google ID token verifier. Injectable for deterministic testing of the
// account find/link/create logic; the production default always uses real
// Google token verification and never trusts frontend-supplied identity.
let injectedVerify = null;
function googleVerify(credential) {
  if (injectedVerify) return injectedVerify(credential);
  return verifyGoogleToken(credential);
}
// Test-only injection point (used only in automated tests).
function __setVerify(fn) { injectedVerify = fn; }

module.exports = router;
module.exports.__setVerify = __setVerify;
