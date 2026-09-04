const { getDb, saveDb } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

async function seed() {
  const db = await getDb();

  const existing = db.exec("SELECT COUNT(*) as c FROM users");
  if (existing.length && existing[0].values.length && existing[0].values[0][0] > 1) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding database...');

  // ─── USERS ───────────────────────────────────────────────
  const adminPw = await bcrypt.hash('admin123', 10);
  db.run("INSERT OR IGNORE INTO users (id, email, password, fullName, role, isVerified) VALUES (?, ?, ?, ?, 'admin', 1)",
    ['admin-001', 'admin@teacherswap.com', adminPw, 'Admin User']);

  const teachers = [
    { email: 'juma@example.com', fullName: 'Juma Makame', region: 'Dar es Salaam', district: 'Kinondoni', school: 'Mzizima Secondary', subjects: 'Mathematics, Physics', level: 'secondary', exp: '6-10', prefR: 'Arusha', prefD: 'Arusha City', swapType: 'permanent', phone: '0712345678', gender: 'male', bio: 'Experienced math teacher looking to relocate to Arusha' },
    { email: 'amina@example.com', fullName: 'Amina Hassan', region: 'Arusha', district: 'Arusha City', school: 'Moshi Secondary', subjects: 'English, Literature', level: 'secondary', exp: '3-5', prefR: 'Dar es Salaam', prefD: 'Kinondoni', swapType: 'permanent', phone: '0712345679', gender: 'female', bio: 'English teacher passionate about literature and drama' },
    { email: 'baraka@example.com', fullName: 'Baraka Mushi', region: 'Mbeya', district: 'Mbeya City', school: 'Mbeya Primary', subjects: 'Science, Geography', level: 'primary', exp: '10+', prefR: 'Kilimanjaro', prefD: 'Moshi Rural', swapType: 'temporary', phone: '0712345680', gender: 'male', bio: 'Senior primary teacher seeking temporary assignment in Kilimanjaro' },
    { email: 'diana@example.com', fullName: 'Diana Mwangi', region: 'Dodoma', district: 'Chamwino', school: 'Dodoma Secondary', subjects: 'History, Civics', level: 'secondary', exp: '3-5', prefR: 'Mwanza', prefD: 'Ilemela', swapType: 'either', phone: '0712345681', gender: 'female', bio: 'History teacher wanting to experience Mwanza region' },
    { email: 'elisha@example.com', fullName: 'Elisha Nkya', region: 'Mwanza', district: 'Ilemela', school: 'Mwanza Primary', subjects: 'Mathematics, Kiswahili', level: 'primary', exp: '6-10', prefR: 'Dodoma', prefD: 'Chamwino', swapType: 'permanent', phone: '0712345682', gender: 'male', bio: 'Primary math teacher looking to move to Dodoma' },
    { email: 'fatuma@example.com', fullName: 'Fatuma Ali', region: 'Tanga', district: 'Tanga City', school: 'Tanga Secondary', subjects: 'Biology, Chemistry', level: 'secondary', exp: '0-2', prefR: 'Dar es Salaam', prefD: 'Temeke', swapType: 'temporary', phone: '0712345683', gender: 'female', bio: 'New science teacher eager to gain experience in Dar es Salaam' },
    { email: 'george@example.com', fullName: 'George Mwita', region: 'Kilimanjaro', district: 'Moshi Rural', school: 'Kilimanjaro Primary', subjects: 'English, Science', level: 'primary', exp: '3-5', prefR: 'Mbeya', prefD: 'Mbeya City', swapType: 'either', phone: '0712345684', gender: 'male', bio: 'Primary teacher open to both permanent and temporary swaps' },
    { email: 'hawa@example.com', fullName: 'Hawa Selemani', region: 'Morogoro', district: 'Morogoro Municipal', school: 'Morogoro Secondary', subjects: 'Geography, History', level: 'secondary', exp: '6-10', prefR: 'Arusha', prefD: 'Arusha Rural', swapType: 'permanent', phone: '0712345685', gender: 'female', bio: 'Geography specialist looking to move to Arusha region' }
  ];

  const userIds = {};
  for (const t of teachers) {
    const pw = await bcrypt.hash('password123', 10);
    const id = uuid();
    userIds[t.email] = id;
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password, fullName, role, phone, gender, region, district, schoolName, subjects, teachingLevel, experience, preferredRegion, preferredDistrict, swapType, bio, isVerified)
       VALUES (?, ?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, t.email, pw, t.fullName, t.phone, t.gender, t.region, t.district, t.school, t.subjects, t.level, t.exp, t.prefR, t.prefD, t.swapType, t.bio]
    );
  }

  // ─── SCHOOLS ─────────────────────────────────────────────
  const schools = [
    { name: 'Mzizima Secondary', region: 'Dar es Salaam', district: 'Kinondoni', lat: -6.7924, lng: 39.2083, level: 'secondary', subjects: 'Mathematics, Physics, Chemistry', teachers: 45, swaps: 3 },
    { name: 'Moshi Secondary', region: 'Arusha', district: 'Arusha City', lat: -3.3667, lng: 36.6833, level: 'secondary', subjects: 'English, Literature, Kiswahili', teachers: 38, swaps: 5 },
    { name: 'Mbeya Primary', region: 'Mbeya', district: 'Mbeya City', lat: -8.9, lng: 33.45, level: 'primary', subjects: 'Science, Geography, Math', teachers: 28, swaps: 2 },
    { name: 'Dodoma Secondary', region: 'Dodoma', district: 'Chamwino', lat: -6.1833, lng: 35.75, level: 'secondary', subjects: 'History, Civics, English', teachers: 35, swaps: 4 },
    { name: 'Mwanza Primary', region: 'Mwanza', district: 'Ilemela', lat: -2.5167, lng: 32.9, level: 'primary', subjects: 'Mathematics, Kiswahili', teachers: 22, swaps: 1 },
    { name: 'Tanga Secondary', region: 'Tanga', district: 'Tanga City', lat: -5.0667, lng: 39.1, level: 'secondary', subjects: 'Biology, Chemistry, Physics', teachers: 40, swaps: 3 },
    { name: 'Kilimanjaro Primary', region: 'Kilimanjaro', district: 'Moshi Rural', lat: -3.2333, lng: 37.3333, level: 'primary', subjects: 'English, Science, Math', teachers: 30, swaps: 2 },
    { name: 'Morogoro Secondary', region: 'Morogoro', district: 'Morogoro Municipal', lat: -6.8167, lng: 37.6667, level: 'secondary', subjects: 'Geography, History, English', teachers: 36, swaps: 4 },
    { name: 'Ilala Primary', region: 'Dar es Salaam', district: 'Ilala', lat: -6.8333, lng: 39.2833, level: 'primary', subjects: 'Kiswahili, Math, Science', teachers: 25, swaps: 2 },
    { name: 'Kariakoo Secondary', region: 'Dar es Salaam', district: 'Ilala', lat: -6.8167, lng: 39.2833, level: 'secondary', subjects: 'Mathematics, English, Chemistry', teachers: 42, swaps: 6 },
    { name: 'Temeke Primary', region: 'Dar es Salaam', district: 'Temeke', lat: -6.8667, lng: 39.2667, level: 'primary', subjects: 'Science, Math, Kiswahili', teachers: 20, swaps: 1 },
    { name: 'Arusha Secondary', region: 'Arusha', district: 'Arusha Rural', lat: -3.3833, lng: 36.6833, level: 'secondary', subjects: 'Biology, Geography, English', teachers: 33, swaps: 3 },
    { name: 'Mwanza Secondary', region: 'Mwanza', district: 'Nyamagana', lat: -2.5167, lng: 32.9, level: 'secondary', subjects: 'Physics, Chemistry, Math', teachers: 37, swaps: 4 },
    { name: 'Mbeya Secondary', region: 'Mbeya', district: 'Mbeya Rural', lat: -8.9, lng: 33.5, level: 'secondary', subjects: 'English, Literature, History', teachers: 34, swaps: 2 },
    { name: 'Shinyanga Primary', region: 'Shinyanga', district: 'Shinyanga Urban', lat: -3.6667, lng: 33.4167, level: 'primary', subjects: 'Math, Kiswahili, Science', teachers: 18, swaps: 1 }
  ];

  const schoolIds = {};
  for (const s of schools) {
    const id = uuid();
    schoolIds[s.name] = id;
    db.run(
      `INSERT OR IGNORE INTO schools (id, name, region, district, latitude, longitude, educationLevel, subjects, teacherCount, activeSwaps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, s.name, s.region, s.district, s.lat, s.lng, s.level, s.subjects, s.teachers, s.swaps]
    );
  }

  // ─── SWAP REQUESTS ───────────────────────────────────────
  const keys = Object.keys(userIds);
  const swapIds = {};
  if (keys.length >= 2) {
    const pairs = [
      [0, 1, 'completed', 'Great teacher!', 'Location match'],
      [1, 2, 'pending', 'Interested in your profile', 'Subject expertise'],
      [2, 3, 'completed', 'Perfect swap!', 'Mutual benefit'],
      [3, 4, 'accepted', 'Let us discuss details', 'Region preference'],
      [4, 0, 'pending', 'Would you like to swap?', 'Subject overlap']
    ];
    for (const [fi, ti, status, msg, reason] of pairs) {
      if (keys[fi] && keys[ti]) {
        const swapId = uuid();
        swapIds[`${fi}-${ti}`] = swapId;
        db.run("INSERT OR IGNORE INTO swap_requests (id, fromUserId, toUserId, status, message, reason, respondedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [swapId, userIds[keys[fi]], userIds[keys[ti]], status, msg, reason, status !== 'pending' ? new Date().toISOString() : null]);
      }
    }
  }

  // ─── SWAP MATCHES ─────────────────────────────────────────
  if (keys.length >= 4) {
    const matches = [
      { u1: 0, u2: 1, score: 85, explanation: 'Same subjects, complementary regions. Juma wants Arusha, Amina wants Dar es Salaam.' },
      { u1: 2, u2: 3, score: 72, explanation: 'Both primary teachers. Baraka wants Kilimanjaro, Diana wants Mwanza.' },
      { u1: 4, u2: 5, score: 68, explanation: 'Elisha wants Dodoma, Fatuma wants Dar es Salaam. Partial match.' }
    ];
    for (const m of matches) {
      db.run("INSERT OR IGNORE INTO swap_matches (id, user1Id, user2Id, score, explanation, status) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), userIds[keys[m.u1]], userIds[keys[m.u2]], m.score, m.explanation, 'pending']);
    }
  }

  // ─── REVIEWS ─────────────────────────────────────────────
  if (keys.length >= 4) {
    const reviewData = [
      { from: 0, to: 1, swap: '0-1', rating: 5, feedback: 'Excellent swap experience! Very professional.' },
      { from: 1, to: 0, swap: '0-1', rating: 4, feedback: 'Great communication, smooth process.' },
      { from: 2, to: 3, swap: '2-3', rating: 5, feedback: 'Best swap I have ever done. Highly recommend!' },
      { from: 3, to: 2, swap: '2-3', rating: 4, feedback: 'Very cooperative and understanding.' }
    ];
    for (const r of reviewData) {
      const sid = swapIds[r.swap];
      if (sid) {
        db.run("INSERT OR IGNORE INTO reviews (id, fromUserId, toUserId, swapRequestId, rating, feedback) VALUES (?, ?, ?, ?, ?, ?)",
          [uuid(), userIds[keys[r.from]], userIds[keys[r.to]], sid, r.rating, r.feedback]);
      }
    }
  }

  // ─── MEETINGS ────────────────────────────────────────────
  if (keys.length >= 4) {
    const tomorrow = new Date(Date.now() + 86400000);
    const nextWeek = new Date(Date.now() + 604800000);
    const meetings = [
      { req: 0, res: 1, title: 'Initial Discussion', date: tomorrow.toISOString().split('T')[0], time: '10:00', status: 'accepted' },
      { req: 2, res: 3, title: 'Swap Planning Meeting', date: nextWeek.toISOString().split('T')[0], time: '14:30', status: 'pending' }
    ];
    for (const m of meetings) {
      db.run("INSERT OR IGNORE INTO meetings (id, requesterId, responderId, title, date, time, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [uuid(), userIds[keys[m.req]], userIds[keys[m.res]], m.title, m.date, m.time, m.status]);
    }
  }

  // ─── MESSAGES ────────────────────────────────────────────
  if (keys.length >= 4) {
    const convo1 = [userIds[keys[0]], userIds[keys[1]]].sort().join(':');
    const convo2 = [userIds[keys[2]], userIds[keys[3]]].sort().join(':');
    const now = new Date();
    const msgData = [
      { conv: convo1, from: 0, to: 1, content: 'Hello! I saw your profile and I am interested in a swap.', time: new Date(now - 3600000) },
      { conv: convo1, from: 1, to: 0, content: 'Hi! Yes, I think we would be a great match.', time: new Date(now - 3000000) },
      { conv: convo1, from: 0, to: 1, content: 'I teach in Kinondoni and want to move to Arusha. You are in Arusha right?', time: new Date(now - 2400000) },
      { conv: convo1, from: 1, to: 0, content: 'Yes, I am at Moshi Secondary in Arusha City. And I want to move to Kinondoni!', time: new Date(now - 1800000) },
      { conv: convo2, from: 2, to: 3, content: 'Hi Diana, I saw the match recommendation. Want to discuss?', time: new Date(now - 7200000) },
      { conv: convo2, from: 3, to: 2, content: 'Sure! When are you free for a meeting?', time: new Date(now - 6600000) }
    ];
    for (const m of msgData) {
      db.run("INSERT OR IGNORE INTO messages (id, conversationId, senderId, receiverId, content, createdAt, isRead) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [uuid(), m.conv, userIds[keys[m.from]], userIds[keys[m.to]], m.content, m.time.toISOString(), 1]);
    }
  }

  // ─── NOTIFICATIONS ───────────────────────────────────────
  if (keys.length >= 2) {
    const notifData = [
      { user: 0, type: 'new_match', title: 'New Match Found!', body: 'You have been matched with Amina Hassan. Check your recommendations!', link: '/find-match.html' },
      { user: 1, type: 'swap_request', title: 'New Swap Request', body: 'Juma Makame has sent you a swap request.', link: '/dashboard.html' },
      { user: 2, type: 'meeting', title: 'Meeting Scheduled', body: 'Your meeting with Diana Mwangi has been confirmed.', link: '/dashboard.html' },
      { user: 3, type: 'message', title: 'New Message', body: 'Baraka Mushi sent you a message.', link: '/messages.html' },
      { user: 0, type: 'review', title: 'New Review Received', body: 'Amina Hassan left you a 5-star review!', link: '/profile.html' }
    ];
    for (const n of notifData) {
      db.run("INSERT OR IGNORE INTO notifications (id, userId, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), userIds[keys[n.user]], n.type, n.title, n.body, n.link]);
    }
  }

  // ─── FAVORITES ───────────────────────────────────────────
  if (keys.length >= 3) {
    db.run("INSERT OR IGNORE INTO favorites (id, userId, targetUserId) VALUES (?, ?, ?)",
      [uuid(), userIds[keys[0]], userIds[keys[1]]]);
    db.run("INSERT OR IGNORE INTO favorites (id, userId, targetUserId) VALUES (?, ?, ?)",
      [uuid(), userIds[keys[0]], userIds[keys[2]]]);
  }

  // ─── USER SETTINGS ───────────────────────────────────────
  for (const email of Object.keys(userIds)) {
    db.run("INSERT OR IGNORE INTO user_settings (id, userId) VALUES (?, ?)", [uuid(), userIds[email]]);
  }
  db.run("INSERT OR IGNORE INTO user_settings (id, userId) VALUES (?, ?)", [uuid(), 'admin-001']);

  // ─── AUDIT LOGS ─────────────────────────────────────────
  const auditActions = [
    { user: 0, action: 'LOGIN', details: 'User logged in' },
    { user: 1, action: 'LOGIN', details: 'User logged in' },
    { user: 0, action: 'PROFILE_UPDATE', details: 'Profile updated' },
    { user: 0, action: 'SWAP_REQUEST', details: 'Sent swap request' },
    { user: 1, action: 'SWAP_UPDATE', details: 'Swap accepted' }
  ];
  for (const a of auditActions) {
    db.run("INSERT OR IGNORE INTO audit_logs (id, userId, action, details) VALUES (?, ?, ?, ?)",
      [uuid(), userIds[keys[a.user]], a.action, a.details]);
  }

  // ─── AI RECOMMENDATIONS ──────────────────────────────────
  if (keys.length >= 2) {
    db.run("INSERT OR IGNORE INTO ai_recommendations (id, userId, recommendedUserId, score, explanation) VALUES (?, ?, ?, ?, ?)",
      [uuid(), userIds[keys[0]], userIds[keys[1]], 85, 'Same subjects, complementary regions, high mutual compatibility']);
    db.run("INSERT OR IGNORE INTO ai_recommendations (id, userId, recommendedUserId, score, explanation) VALUES (?, ?, ?, ?, ?)",
      [uuid(), userIds[keys[0]], userIds[keys[2]], 62, 'Partial match on region preference']);
  }

  // ─── SUBSCRIPTION PLANS ─────────────────────────────────
  const plans = [
    { name: 'Basic', tier: 'basic', price: 15000, days: 30, features: ['Browse teacher profiles', 'Send up to 5 swap requests/month', 'Basic matching recommendations', 'Email support'], popular: 0 },
    { name: 'Premium', tier: 'premium', price: 35000, days: 30, features: ['Unlimited swap requests', 'Priority matching algorithm', 'Direct messaging', 'Meeting scheduler', 'Advanced analytics dashboard', 'Priority email & phone support'], popular: 1 },
    { name: 'Enterprise', tier: 'enterprise', price: 80000, days: 30, features: ['Everything in Premium', 'Dedicated account manager', 'Bulk teacher swap coordination', 'School-wide analytics', 'Custom reports', '24/7 phone & WhatsApp support', 'API access for integrations'], popular: 0 }
  ];
  const planIds = {};
  for (const p of plans) {
    const id = uuid();
    planIds[p.tier] = id;
    db.run('INSERT OR IGNORE INTO subscription_plans (id, name, tier, price, durationDays, features, popular) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, p.name, p.tier, p.price, p.days, JSON.stringify(p.features), p.popular]);
  }

  // ─── PAYMENT METHODS ────────────────────────────────────
  const methods = [
    { provider: 'M-Pesa', accountName: 'TeacherSwap Payments', phoneNumber: '0682987984', instructions: 'Lipia kwa M-Pesa kwa namba hii. Tuma risiti baada ya malipo.' },
    { provider: 'Airtel Money', accountName: 'TeacherSwap Payments', phoneNumber: '0682987984', instructions: 'Lipia kwa Airtel Money kwa namba hii. Tuma risiti baada ya malipo.' },
    { provider: 'Tigo Pesa', accountName: 'TeacherSwap Payments', phoneNumber: '0682987984', instructions: 'Lipia kwa Tigo Pesa kwa namba hii. Tuma risiti baada ya malipo.' },
    { provider: 'HaloPesa', accountName: 'TeacherSwap Payments', phoneNumber: '0682987984', instructions: 'Lipia kwa HaloPesa kwa namba hii. Tuma risiti baada ya malipo.' }
  ];
  for (const m of methods) {
    db.run('INSERT OR IGNORE INTO payment_methods (id, provider, accountName, phoneNumber, instructions) VALUES (?, ?, ?, ?, ?)',
      [uuid(), m.provider, m.accountName, m.phoneNumber, m.instructions]);
  }

  saveDb();
  console.log('Seed complete!');
  console.log('Admin: admin@teacherswap.com / admin123');
  console.log('Teachers: (any teacher email) / password123');
}

seed().catch(console.error);
