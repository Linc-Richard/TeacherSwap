const { getDb, saveDb } = require('./database');

async function initSchema() {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'teacher',
      tscNumber TEXT UNIQUE,
      gender TEXT,
      teachingLevel TEXT,
      subjects TEXT,
      experience TEXT,
      schoolName TEXT,
      region TEXT,
      district TEXT,
      preferredRegion TEXT,
      preferredDistrict TEXT,
      swapType TEXT,
      reason TEXT,
      avatar TEXT,
      isVerified INTEGER DEFAULT 0,
      isTwoFactorEnabled INTEGER DEFAULT 0,
      twoFactorSecret TEXT,
      backupCodes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      district TEXT NOT NULL,
      educationLevel TEXT,
      subjects TEXT,
      latitude REAL,
      longitude REAL,
      teacherCount INTEGER DEFAULT 0,
      activeSwaps INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS swap_requests (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      fromSchoolId TEXT,
      toSchoolId TEXT,
      message TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fromUserId) REFERENCES users(id),
      FOREIGN KEY (toUserId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      swapRequestId TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      feedback TEXT,
      isAnonymous INTEGER DEFAULT 0,
      isFlagged INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fromUserId) REFERENCES users(id),
      FOREIGN KEY (toUserId) REFERENCES users(id),
      FOREIGN KEY (swapRequestId) REFERENCES swap_requests(id),
      UNIQUE(fromUserId, toUserId, swapRequestId)
    )
  `);

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
      location TEXT,
      videoLink TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (requesterId) REFERENCES users(id),
      FOREIGN KEY (responderId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      userAgent TEXT,
      expiresAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      recommendedUserId TEXT NOT NULL,
      score REAL DEFAULT 0,
      explanation TEXT,
      isViewed INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (recommendedUserId) REFERENCES users(id)
    )
  `);

  // Add googleId and avatar columns if they don't exist (for Google Sign-In)
  try { db.run("ALTER TABLE users ADD COLUMN googleId TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"); } catch(e) {}

  saveDb();
  console.log('Database schema initialized');
}

module.exports = { initSchema };
