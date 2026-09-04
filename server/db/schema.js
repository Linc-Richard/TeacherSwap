const { getDb, saveDb } = require('./database');

async function initSchema() {
  const db = await getDb();

  db.run(`PRAGMA foreign_keys=ON`);

  // ─── USERS ───────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT DEFAULT '',
      role TEXT DEFAULT 'teacher',
      tscNumber TEXT UNIQUE,
      gender TEXT DEFAULT '',
      teachingLevel TEXT DEFAULT '',
      subjects TEXT DEFAULT '',
      experience TEXT DEFAULT '',
      schoolName TEXT DEFAULT '',
      region TEXT DEFAULT '',
      district TEXT DEFAULT '',
      preferredRegion TEXT DEFAULT '',
      preferredDistrict TEXT DEFAULT '',
      swapType TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      googleId TEXT,
      authProvider TEXT DEFAULT 'local',
      isVerified INTEGER DEFAULT 0,
      isTwoFactorEnabled INTEGER DEFAULT 0,
      twoFactorSecret TEXT,
      backupCodes TEXT,
      emailVerificationToken TEXT,
      lastLoginAt TEXT,
      subscriptionTier TEXT DEFAULT 'free',
      subscriptionExpiresAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_users_region ON users(region)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_users_pref_region ON users(preferredRegion)"); } catch(e) {}

  // ─── SCHOOLS ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      district TEXT NOT NULL,
      educationLevel TEXT DEFAULT '',
      subjects TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      teacherCount INTEGER DEFAULT 0,
      activeSwaps INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_schools_region ON schools(region)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_schools_district ON schools(district)"); } catch(e) {}

  // ─── SWAP REQUESTS ───────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS swap_requests (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      fromSchoolId TEXT,
      toSchoolId TEXT,
      message TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      respondedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fromUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (toUserId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_swaps_from ON swap_requests(fromUserId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_swaps_to ON swap_requests(toUserId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_swaps_status ON swap_requests(status)"); } catch(e) {}

  // ─── SWAP MATCHES (AI-generated pairs) ───────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS swap_matches (
      id TEXT PRIMARY KEY,
      user1Id TEXT NOT NULL,
      user2Id TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      explanation TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      user1Accepted INTEGER DEFAULT 0,
      user2Accepted INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_matches_user1 ON swap_matches(user1Id)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_matches_user2 ON swap_matches(user2Id)"); } catch(e) {}

  // ─── REVIEWS ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      swapRequestId TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      feedback TEXT DEFAULT '',
      isAnonymous INTEGER DEFAULT 0,
      isFlagged INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fromUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (toUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (swapRequestId) REFERENCES swap_requests(id) ON DELETE CASCADE,
      UNIQUE(fromUserId, toUserId, swapRequestId)
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_reviews_to ON reviews(toUserId)"); } catch(e) {}

  // ─── MEETINGS ────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      requesterId TEXT NOT NULL,
      responderId TEXT NOT NULL,
      swapRequestId TEXT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER DEFAULT 30,
      location TEXT DEFAULT '',
      videoLink TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (requesterId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (responderId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_meetings_req ON meetings(requesterId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_meetings_resp ON meetings(responderId)"); } catch(e) {}

  // ─── MESSAGES (chat) ─────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      content TEXT NOT NULL,
      isRead INTEGER DEFAULT 0,
      readAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversationId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiverId)"); } catch(e) {}

  // ─── NOTIFICATIONS ───────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      relatedUserId TEXT,
      isRead INTEGER DEFAULT 0,
      readAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(userId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(userId, isRead)"); } catch(e) {}

  // ─── PASSWORD RESET TOKENS ───────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      isUsed INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token)"); } catch(e) {}

  // ─── FAVORITES (saved teachers) ──────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      targetUserId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (targetUserId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, targetUserId)
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_favs_user ON favorites(userId)"); } catch(e) {}

  // ─── USER SETTINGS ───────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      notifySwapRequests INTEGER DEFAULT 1,
      notifyMessages INTEGER DEFAULT 1,
      notifyMeetings INTEGER DEFAULT 1,
      notifyRecommendations INTEGER DEFAULT 1,
      emailDigest INTEGER DEFAULT 0,
      privacyShowPhone INTEGER DEFAULT 0,
      privacyShowEmail INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ─── TRUSTED DEVICES (2FA) ──────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      userAgent TEXT DEFAULT '',
      expiresAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_devices_user ON trusted_devices(userId)"); } catch(e) {}

  // ─── AUDIT LOGS ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(userId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(createdAt)"); } catch(e) {}

  // ─── SUBSCRIPTION PLANS ──────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      tier TEXT UNIQUE NOT NULL CHECK(tier IN ('basic', 'premium', 'enterprise')),
      price REAL NOT NULL,
      durationDays INTEGER NOT NULL,
      features TEXT DEFAULT '[]',
      recommended INTEGER DEFAULT 0,
      popular INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── PAYMENT METHODS (admin-configurable) ────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      accountName TEXT NOT NULL,
      phoneNumber TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      instructions TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pay_methods_provider ON payment_methods(provider)"); } catch(e) {}

  // ─── PAYMENTS ────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      planId TEXT NOT NULL,
      transactionId TEXT NOT NULL,
      phoneNumber TEXT NOT NULL,
      amount REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      receiptPath TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected', 'failed')),
      verifiedBy TEXT,
      verifiedAt TEXT,
      rejectedReason TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES subscription_plans(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(userId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)"); } catch(e) {}

  // ─── USER SUBSCRIPTIONS ──────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      planId TEXT NOT NULL,
      tier TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
      startedAt TEXT DEFAULT (datetime('now')),
      expiresAt TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES subscription_plans(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_user_subs_user ON user_subscriptions(userId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_user_subs_status ON user_subscriptions(status)"); } catch(e) {}

  // ─── AI RECOMMENDATIONS (legacy) ─────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      recommendedUserId TEXT NOT NULL,
      score REAL DEFAULT 0,
      explanation TEXT DEFAULT '',
      isViewed INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recommendedUserId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_ai_rec_user ON ai_recommendations(userId)"); } catch(e) {}

  // Add columns that might be missing on existing databases
  try { db.run("ALTER TABLE users ADD COLUMN googleId TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN authProvider TEXT DEFAULT 'local'"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN lastLoginAt TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN emailVerificationToken TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN subscriptionTier TEXT DEFAULT 'free'"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN subscriptionExpiresAt TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN reason TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE swap_requests ADD COLUMN reason TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE swap_requests ADD COLUMN respondedAt TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN username TEXT"); } catch(e) {}
  try { db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username != ''"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_users_google ON users(googleId) WHERE googleId IS NOT NULL AND googleId != ''"); } catch(e) {}

  // ─── BLOCKED USERS ──────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id TEXT PRIMARY KEY,
      blockerId TEXT NOT NULL,
      blockedId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (blockerId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blockedId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(blockerId, blockedId)
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blockerId)"); } catch(e) {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON blocked_users(blockedId)"); } catch(e) {}

  // ─── REPORTS ────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporterId TEXT NOT NULL,
      reportedUserId TEXT NOT NULL,
      conversationId TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporterId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reportedUserId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { db.run("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)"); } catch(e) {}

  saveDb();
  console.log('Database schema initialized');
}

module.exports = { initSchema };
