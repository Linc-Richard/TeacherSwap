const express = require('express');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs = require('fs');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, adminOnly, logAudit } = require('../middleware/auth');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── SUBSCRIPTION PLANS (public) ─────────────────────────

// GET /api/plans - list all active plans
router.get('/plans', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec("SELECT * FROM subscription_plans WHERE isActive = 1 ORDER BY price ASC");
    if (!rows.length) return res.json({ plans: [] });
    const cols = rows[0].columns;
    const plans = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ plans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PAYMENT METHODS (public) ────────────────────────────

// GET /api/payment-methods - list active methods
router.get('/payment-methods', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec("SELECT * FROM payment_methods WHERE isActive = 1 ORDER BY provider ASC");
    if (!rows.length) return res.json({ methods: [] });
    const cols = rows[0].columns;
    const methods = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ methods });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER PAYMENT SUBMISSION ─────────────────────────────

router.post('/payments/submit', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { planId, transactionId, phoneNumber, amount, paymentMethod, notes, receiptData } = req.body;
    if (!planId || !transactionId || !phoneNumber || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'planId, transactionId, phoneNumber, amount, paymentMethod required' });
    }

    const planRows = db.exec(`SELECT * FROM subscription_plans WHERE id = '${planId.replace(/'/g, "''")}' AND isActive = 1`);
    if (!planRows.length || !planRows[0].values.length) return res.status(400).json({ error: 'Invalid or inactive plan' });

    const id = uuid();
    let receiptPath = '';

    if (receiptData) {
      const ext = receiptData.match(/^data:image\/(\w+)/);
      const fileExt = ext ? ext[1] : 'png';
      const filename = `receipt_${id}.${fileExt}`;
      const buffer = Buffer.from(receiptData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      receiptPath = `/uploads/receipts/${filename}`;
    }

    db.run(
      'INSERT INTO payments (id, userId, planId, transactionId, phoneNumber, amount, paymentMethod, receiptPath, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, planId, transactionId, phoneNumber, amount, paymentMethod, receiptPath, notes || '']
    );
    saveDb();
    logAudit(req.user.id, 'PAYMENT_SUBMIT', `Payment submitted for plan ${planId}`);
    res.status(201).json({ id, status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/payments/history - user's payment history
router.get('/payments/history', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`
      SELECT p.*, sp.name as planName, sp.tier as planTier
      FROM payments p
      JOIN subscription_plans sp ON p.planId = sp.id
      WHERE p.userId = '${req.user.id.replace(/'/g, "''")}'
      ORDER BY p.createdAt DESC
    `);
    if (!rows.length) return res.json({ payments: [] });
    const cols = rows[0].columns;
    const payments = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/subscription/status - current user's subscription status
router.get('/subscription/status', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec(`
      SELECT us.*, sp.name as planName, sp.features as planFeatures, sp.price as planPrice
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.planId = sp.id
      WHERE us.userId = '${req.user.id.replace(/'/g, "''")}' AND us.status = 'active'
      ORDER BY us.createdAt DESC LIMIT 1
    `);
    if (!rows.length || !rows[0].values.length) {
      return res.json({ subscription: null, tier: 'free' });
    }
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const sub = {};
    cols.forEach((c, i) => sub[c] = vals[i]);
    const expired = sub.expiresAt && new Date(sub.expiresAt) < new Date();
    if (expired) {
      db.run(`UPDATE user_subscriptions SET status = 'expired' WHERE id = '${sub.id.replace(/'/g, "''")}'`);
      db.run(`UPDATE users SET subscriptionTier = 'free', subscriptionExpiresAt = NULL WHERE id = '${req.user.id.replace(/'/g, "''")}'`);
      saveDb();
      return res.json({ subscription: null, tier: 'free', expired: true });
    }
    res.json({ subscription: sub, tier: sub.tier });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: SUBSCRIPTION PLANS CRUD ──────────────────────

router.get('/admin/plans', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec("SELECT * FROM subscription_plans ORDER BY price ASC");
    if (!rows.length) return res.json({ plans: [] });
    const cols = rows[0].columns;
    const plans = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ plans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/plans', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { name, tier, price, durationDays, features, recommended, popular } = req.body;
    if (!name || !tier || !price || !durationDays) return res.status(400).json({ error: 'name, tier, price, durationDays required' });
    const id = uuid();
    db.run(
      'INSERT INTO subscription_plans (id, name, tier, price, durationDays, features, recommended, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, tier, price, durationDays, JSON.stringify(features || []), recommended ? 1 : 0, popular ? 1 : 0]
    );
    saveDb();
    logAudit(req.user.id, 'PLAN_CREATE', `Created plan: ${name}`);
    res.status(201).json({ id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/plans/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const fields = ['name', 'tier', 'price', 'durationDays', 'features', 'recommended', 'popular', 'isActive'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(f === 'features' ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields' });
    updates.push("updatedAt = datetime('now')");
    values.push(req.params.id);
    db.run(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
    logAudit(req.user.id, 'PLAN_UPDATE', `Updated plan ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/plans/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM subscription_plans WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'PLAN_DELETE', `Deleted plan ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: PAYMENT METHODS CRUD ─────────────────────────

router.get('/admin/payment-methods', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec("SELECT * FROM payment_methods ORDER BY provider ASC");
    if (!rows.length) return res.json({ methods: [] });
    const cols = rows[0].columns;
    const methods = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ methods });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/payment-methods', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { provider, accountName, phoneNumber, instructions } = req.body;
    if (!provider || !accountName || !phoneNumber) return res.status(400).json({ error: 'provider, accountName, phoneNumber required' });
    const id = uuid();
    db.run('INSERT INTO payment_methods (id, provider, accountName, phoneNumber, instructions) VALUES (?, ?, ?, ?, ?)',
      [id, provider, accountName, phoneNumber, instructions || '']);
    saveDb();
    logAudit(req.user.id, 'PAY_METHOD_CREATE', `Added ${provider}: ${accountName}`);
    res.status(201).json({ id, provider, accountName, phoneNumber });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/payment-methods/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const fields = ['provider', 'accountName', 'phoneNumber', 'isActive', 'instructions'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields' });
    updates.push("updatedAt = datetime('now')");
    values.push(req.params.id);
    db.run(`UPDATE payment_methods SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
    logAudit(req.user.id, 'PAY_METHOD_UPDATE', `Updated ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/payment-methods/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM payment_methods WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'PAY_METHOD_DELETE', `Deleted ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: PAYMENT VERIFICATION ─────────────────────────

router.get('/admin/payments', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { status: filterStatus } = req.query;
    let sql = `
      SELECT p.*, sp.name as planName, sp.tier as planTier, u.fullName as userName, u.email as userEmail
      FROM payments p
      JOIN subscription_plans sp ON p.planId = sp.id
      JOIN users u ON p.userId = u.id
    `;
    if (filterStatus) sql += ` WHERE p.status = '${filterStatus.replace(/'/g, "''")}'`;
    sql += ' ORDER BY p.createdAt DESC';
    const rows = db.exec(sql);
    if (!rows.length) return res.json({ payments: [] });
    const cols = rows[0].columns;
    const payments = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/payments/:id/verify', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const payRows = db.exec(`SELECT * FROM payments WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    if (!payRows.length || !payRows[0].values.length) return res.status(404).json({ error: 'Payment not found' });
    const cols = payRows[0].columns;
    const vals = payRows[0].values[0];
    const payment = {};
    cols.forEach((c, i) => payment[c] = vals[i]);

    if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment already processed' });

    db.run(`UPDATE payments SET status = 'verified', verifiedBy = '${req.user.id.replace(/'/g, "''")}', verifiedAt = datetime('now'), updatedAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}'`);

    const planRows = db.exec(`SELECT * FROM subscription_plans WHERE id = '${payment.planId.replace(/'/g, "''")}'`);
    if (planRows.length && planRows[0].values.length) {
      const pCols = planRows[0].columns;
      const pVals = planRows[0].values[0];
      const plan = {};
      pCols.forEach((c, i) => plan[c] = pVals[i]);

      const expiresAt = new Date(Date.now() + plan.durationDays * 86400000).toISOString();

      const existingSub = db.exec(`SELECT id FROM user_subscriptions WHERE userId = '${payment.userId.replace(/'/g, "''")}'`);
      if (existingSub.length && existingSub[0].values.length) {
        db.run(`UPDATE user_subscriptions SET planId = '${plan.id.replace(/'/g, "''")}', tier = '${plan.tier.replace(/'/g, "''")}', status = 'active', startedAt = datetime('now'), expiresAt = '${expiresAt.replace(/'/g, "''")}', updatedAt = datetime('now') WHERE userId = '${payment.userId.replace(/'/g, "''")}'`);
      } else {
        db.run('INSERT INTO user_subscriptions (id, userId, planId, tier, expiresAt) VALUES (?, ?, ?, ?, ?)',
          [uuid(), payment.userId, plan.id, plan.tier, expiresAt]);
      }

      db.run(`UPDATE users SET subscriptionTier = '${plan.tier.replace(/'/g, "''")}', subscriptionExpiresAt = '${expiresAt.replace(/'/g, "''")}' WHERE id = '${payment.userId.replace(/'/g, "''")}'`);
    }

    saveDb();
    logAudit(req.user.id, 'PAYMENT_VERIFY', `Verified payment ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/payments/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { reason } = req.body;
    db.run(`UPDATE payments SET status = 'rejected', rejectedReason = '${(reason || '').replace(/'/g, "''")}', updatedAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'PAYMENT_REJECT', `Rejected payment ${req.params.id}: ${reason || ''}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/payments/:id/fail', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`UPDATE payments SET status = 'failed', updatedAt = datetime('now') WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'PAYMENT_FAIL', `Marked payment ${req.params.id} as failed`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: PAYMENT OVERVIEW ─────────────────────────────

router.get('/admin/payments/overview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const getVal = (sql) => { const r = db.exec(sql); return (r.length && r[0].values.length) ? r[0].values[0][0] : 0; };
    res.json({
      totalPayments: getVal('SELECT COUNT(*) FROM payments'),
      pendingPayments: getVal("SELECT COUNT(*) FROM payments WHERE status = 'pending'"),
      verifiedPayments: getVal("SELECT COUNT(*) FROM payments WHERE status = 'verified'"),
      rejectedPayments: getVal("SELECT COUNT(*) FROM payments WHERE status = 'rejected'"),
      failedPayments: getVal("SELECT COUNT(*) FROM payments WHERE status = 'failed'"),
      totalRevenue: getVal("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified'"),
      activeSubscriptions: getVal("SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active'"),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
