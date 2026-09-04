const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, logAudit } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec('SELECT * FROM schools ORDER BY name');
    if (!rows.length) return res.json({ schools: [] });
    const cols = rows[0].columns;
    const schools = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ schools });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/map', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.exec('SELECT id, name, region, district, educationLevel, subjects, latitude, longitude, teacherCount, activeSwaps FROM schools WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    if (!rows.length) return res.json({ schools: [] });
    const cols = rows[0].columns;
    const schools = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    res.json({ schools });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/regions', async (req, res) => {
  const regions = [
    'Arusha','Dar es Salaam','Dodoma','Geita','Iringa','Kagera','Katavi','Kigoma',
    'Kilimanjaro','Lindi','Manyara','Mara','Mbeya','Mjini Magharibi','Morogoro',
    'Mtwara','Mwanza','Njombe','Pemba North','Pemba South','Pwani','Rukwa',
    'Ruvuma','Shinyanga','Simiyu','Singida','Songwe','Tabora','Tanga',
    'Unguja North','Unguja South'
  ];
  res.json({ regions });
});

router.get('/districts', async (req, res) => {
  const districts = [
    'Ileje','Mbozi','Momba','Mpemba','Songwe','Kalambo','Nkasi','Sumbawanga',
    'Chunya','Mbeya City','Mbeya Rural','Mbarali','Rungwe','Busokelo','Kyela',
    'Tunduma','Mufindi','Njombe Rural','Njombe Urban','Makete','Ludewa',
    'Mbinga','Namtumbo','Tunduru','Ruangwa','Nachingwea','Liwale','Kilwa',
    'Lindi Rural','Lindi Urban','Mtwara Rural','Mtwara Urban','Masasi',
    'Nanyumbu','Newala','Tandahimba','Mkuranga','Kisarawe','Mafia','Rufiji',
    'Bagamoyo','Ubungo','Kinondoni','Ilala','Temeke','Kigamboni',
    'Arusha City','Arusha Rural','Meru','Monduli','Longido','Ngorongoro',
    'Karatu','Moshi Rural','Moshi Urban','Hai','Siha','Rombo','Same',
    'Mwanga','Lushoto','Korogwe','Muheza','Tanga City','Pangani','Handeni',
    'Kiteto','Simanjiro','Njonabe','Bariadi','Busega','Itilima','Maswa',
    'Meatu','Kwimba','Misungwi','Magimba','Ilemela','Nyamagana','Ukerewe',
    'Bunda','Butiama','Musoma Rural','Musoma Urban','Rorya','Tarime','Serengeti',
    'Geita','Chato','Mbogwe','Nyang\'hwale','Bukombe','Kahama','Msalala',
    'Shinyanga Rural','Shinyanga Urban','Ushetu','Kishapu','Tabora Urban',
    'Tabora Rural','Igunga','Nzega','Urambo','Uyui','Sikonge','Kaliua',
    'Kigoma Rural','Kigoma Urban','Buhigwe','Kakonko','Kasulu Rural',
    'Kasulu Urban','Kibondo','Uvinza','Manyovu','Mpanda','Karema','Mlele',
    'Mpimbwe','Nsimbo','Tanganyika','Kasanga'
  ];
  res.json({ districts });
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, region, district, educationLevel, subjects, latitude, longitude } = req.body;
    if (!name || !region || !district) return res.status(400).json({ error: 'Name, region, and district required' });
    const id = uuid();
    db.run(
      'INSERT INTO schools (id, name, region, district, educationLevel, subjects, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, region, district, educationLevel || '', subjects || '', latitude || null, longitude || null]
    );
    saveDb();
    logAudit(req.user.id, 'SCHOOL_ADD', `Added school: ${name}`);
    res.status(201).json({ id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const fields = ['name', 'region', 'district', 'educationLevel', 'subjects', 'latitude', 'longitude', 'teacherCount', 'activeSwaps'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields' });
    values.push(req.params.id);
    db.run(`UPDATE schools SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
    logAudit(req.user.id, 'SCHOOL_UPDATE', `Updated school ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM schools WHERE id = '${req.params.id.replace(/'/g, "''")}'`);
    saveDb();
    logAudit(req.user.id, 'SCHOOL_DELETE', `Deleted school ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/nearby', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { lat, lng, radius = 50 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const rows = db.exec('SELECT id, name, region, district, latitude, longitude, teacherCount, activeSwaps FROM schools WHERE latitude IS NOT NULL');
    if (!rows.length) return res.json({ schools: [] });
    const cols = rows[0].columns;
    const allSchools = rows[0].values.map(v => { const o = {}; cols.forEach((c, i) => o[c] = v[i]); return o; });
    const nearby = allSchools.filter(s => {
      const d = getDistance(lat, lng, s.latitude, s.longitude);
      return d <= Number(radius);
    }).map(s => {
      s.distance = getDistance(lat, lng, s.latitude, s.longitude);
      return s;
    }).sort((a, b) => a.distance - b.distance);
    res.json({ schools: nearby });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = router;
