const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'CareFlow', 'clinic.db');
const db = new Database(dbPath);
const todayUtc = new Date().toISOString().slice(0, 10);
const todayLocal = new Date().toLocaleDateString('en-CA');
console.log(JSON.stringify({ todayUtc, todayLocal, dbPath }, null, 2));
console.log('cols', db.prepare('PRAGMA table_info(Prescription)').all().map((r) => r.name));
console.log('rx count', db.prepare('SELECT COUNT(*) c FROM Prescription').get());
console.log(
  'recent rx',
  db
    .prepare(
      `SELECT pr.id, pr.tokenId, t.date, t.tokenNumber, pr.pharmacyStatus, pr.createdAt, substr(pr.diagnosis,1,30) d
       FROM Prescription pr JOIN Token t ON t.id=pr.tokenId
       ORDER BY pr.createdAt DESC LIMIT 8`,
    )
    .all(),
);
console.log('tokens by date', db.prepare('SELECT date, COUNT(*) c FROM Token GROUP BY date ORDER BY date DESC LIMIT 8').all());
console.log(
  'queue utc',
  db
    .prepare(
      `SELECT pr.id, t.date, t.tokenNumber FROM Prescription pr JOIN Token t ON t.id=pr.tokenId WHERE t.date=?`,
    )
    .all(todayUtc),
);
console.log(
  'queue local',
  db
    .prepare(
      `SELECT pr.id, t.date, t.tokenNumber FROM Prescription pr JOIN Token t ON t.id=pr.tokenId WHERE t.date=?`,
    )
    .all(todayLocal),
);
