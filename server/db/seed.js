const { getDb, saveDb } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

async function seed() {
  const db = await getDb();

  // Check if already seeded
  const existing = db.exec("SELECT COUNT(*) as c FROM users");
  if (existing.length && existing[0].values.length && existing[0].values[0][0] > 1) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding database...');

  // Admin user
  const adminPw = await bcrypt.hash('admin123', 10);
  db.run("INSERT OR IGNORE INTO users (id, email, password, fullName, role, isVerified) VALUES (?, ?, ?, ?, 'admin', 1)",
    ['admin-001', 'admin@teacherswap.com', adminPw, 'Admin User']);

  // Sample teachers
  const teachers = [
    { email: 'juma@example.com', fullName: 'Juma Makame', region: 'Dar es Salaam', district: 'Kinondoni', school: 'Mzizima Secondary', subjects: 'Mathematics, Physics', level: 'secondary', exp: '6-10', preferredRegion: 'Arusha', preferredDistrict: 'Arusha City', swapType: 'permanent', phone: '0712345678' },
    { email: 'amina@example.com', fullName: 'Amina Hassan', region: 'Arusha', district: 'Arusha City', school: 'Moshi Secondary', subjects: 'English, Literature', level: 'secondary', exp: '3-5', preferredRegion: 'Dar es Salaam', preferredDistrict: 'Kinondoni', swapType: 'permanent', phone: '0712345679' },
    { email: 'baraka@example.com', fullName: 'Baraka Mushi', region: 'Mbeya', district: 'Mbeya City', school: 'Mbeya Primary', subjects: 'Science, Geography', level: 'primary', exp: '10+', preferredRegion: 'Kilimanjaro', preferredDistrict: 'Moshi Rural', swapType: 'temporary', phone: '0712345680' },
    { email: 'diana@example.com', fullName: 'Diana Mwangi', region: 'Dodoma', district: 'Chamwino', school: 'Dodoma Secondary', subjects: 'History, Civics', level: 'secondary', exp: '3-5', preferredRegion: 'Mwanza', preferredDistrict: 'Ilemela', swapType: 'either', phone: '0712345681' },
    { email: 'elisha@example.com', fullName: 'Elisha Nkya', region: 'Mwanza', district: 'Ilemela', school: 'Mwanza Primary', subjects: 'Mathematics, Kiswahili', level: 'primary', exp: '6-10', preferredRegion: 'Dodoma', preferredDistrict: 'Chamwino', swapType: 'permanent', phone: '0712345682' },
    { email: 'fatuma@example.com', fullName: 'Fatuma Ali', region: 'Tanga', district: 'Tanga City', school: 'Tanga Secondary', subjects: 'Biology, Chemistry', level: 'secondary', exp: '0-2', preferredRegion: 'Dar es Salaam', preferredDistrict: 'Temeke', swapType: 'temporary', phone: '0712345683' },
    { email: 'george@example.com', fullName: 'George Mwita', region: 'Kilimanjaro', district: 'Moshi Rural', school: 'Kilimanjaro Primary', subjects: 'English, Science', level: 'primary', exp: '3-5', preferredRegion: 'Mbeya', preferredDistrict: 'Mbeya City', swapType: 'either', phone: '0712345684' },
    { email: 'hawa@example.com', fullName: 'Hawa Selemani', region: 'Morogoro', district: 'Morogoro Municipal', school: 'Morogoro Secondary', subjects: 'Geography, History', level: 'secondary', exp: '6-10', preferredRegion: 'Arusha', preferredDistrict: 'Arusha Rural', swapType: 'permanent', phone: '0712345685' }
  ];

  for (const t of teachers) {
    const pw = await bcrypt.hash('password123', 10);
    const id = uuid();
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password, fullName, role, phone, region, district, schoolName, subjects, teachingLevel, experience, preferredRegion, preferredDistrict, swapType, isVerified)
       VALUES (?, ?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, t.email, pw, t.fullName, t.phone, t.region, t.district, t.school, t.subjects, t.level, t.exp, t.preferredRegion, t.preferredDistrict, t.swapType]
    );
  }

  // Schools with coordinates
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

  for (const s of schools) {
    const id = uuid();
    db.run(
      `INSERT OR IGNORE INTO schools (id, name, region, district, latitude, longitude, educationLevel, subjects, teacherCount, activeSwaps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, s.name, s.region, s.district, s.lat, s.lng, s.level, s.subjects, s.teachers, s.swaps]
    );
  }

  // Sample reviews
  const teacherEmails = teachers.map(t => t.email);
  const users = db.exec("SELECT id, email FROM users WHERE role = 'teacher'");
  const userIds = {};
  if (users.length) {
    const cols = users[0].columns;
    users[0].values.forEach(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); userIds[o.email] = o.id; });
  }

  // Sample swap requests
  const keys = Object.keys(userIds);
  if (keys.length >= 2) {
    for (let i = 0; i < Math.min(keys.length - 1, 4); i++) {
      const fromId = userIds[keys[i]];
      const toId = userIds[keys[i + 1]];
      const status = ['completed', 'pending', 'completed', 'accepted'][i];
      const swapId = uuid();
      db.run("INSERT OR IGNORE INTO swap_requests (id, fromUserId, toUserId, status) VALUES (?, ?, ?, ?)",
        [swapId, fromId, toId, status]);

      if (status === 'completed') {
        const rating = Math.floor(Math.random() * 2) + 4;
        const feedbacks = ['Great swap experience!', 'Very professional teacher', 'Smooth process, highly recommend', 'Excellent communication throughout'];
        db.run("INSERT OR IGNORE INTO reviews (id, fromUserId, toUserId, swapRequestId, rating, feedback) VALUES (?, ?, ?, ?, ?, ?)",
          [uuid(), fromId, toId, swapId, rating, feedbacks[i]]);
      }
    }
  }

  saveDb();
  console.log('Seed complete!');
  console.log('Admin: admin@teacherswap.com / admin123');
  console.log('Teachers: (any teacher email) / password123');
}

seed().catch(console.error);
