const path = require('path');
const dbPath = path.resolve('prisma/clinic.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:///${dbPath}`;
console.log('URL:', process.env.DATABASE_URL);
const { PrismaClient } = require('./node_modules/.prisma/client/index.js');
const prisma = new PrismaClient();
prisma.$queryRawUnsafe('PRAGMA table_info(Patient)').then(rows => {
  console.log('Patient cols:', rows.map(r => r.name).join(', '));
  return prisma.$queryRawUnsafe('PRAGMA table_info(Appointment)');
}).then(rows => {
  console.log('Appointment cols:', rows.map(r => r.name).join(', '));
  return prisma.$disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
