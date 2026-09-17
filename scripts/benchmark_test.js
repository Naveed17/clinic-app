const { PrismaClient } = require('@prisma/client');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'CareFlow', 'clinic_lic_a4f55119d4172a3b.db');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } });

async function bench() {
  console.log('=== CareFlow Performance Benchmark (12,000+ DB) ===');
  
  // 1. Receptionist: list tokens for today
  let t0 = performance.now();
  const todayTokens = await prisma.token.findMany({
    where: { date: '2026-09-17' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrNumber: true, phone: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { tokenNumber: 'asc' }
  });
  let t1 = performance.now();
  console.log(`[1] Receptionist Today Tokens (${todayTokens.length} items): ${(t1 - t0).toFixed(2)} ms`);

  // 2. Receptionist: list recent 200 appointments
  t0 = performance.now();
  const appts = await prisma.appointment.findMany({
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      provider: { select: { id: true, firstName: true, lastName: true, role: true } }
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    take: 200
  });
  t1 = performance.now();
  console.log(`[2] Recent Appointments List (200 items): ${(t1 - t0).toFixed(2)} ms`);

  // 3. Patients Paginated List (page 1, 10 items) + Total Count
  t0 = performance.now();
  const [patientCount, patients] = await Promise.all([
    prisma.patient.count(),
    prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 0
    })
  ]);
  t1 = performance.now();
  console.log(`[3] Patients Paginated List (Total ${patientCount} records): ${(t1 - t0).toFixed(2)} ms`);

  // 4. Patient Instant Autocomplete Search
  t0 = performance.now();
  const searchResults = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Ali' } },
        { lastName: { contains: 'Ali' } },
        { phone: { contains: '0300' } },
        { mrNumber: { contains: '12' } }
      ]
    },
    take: 50
  });
  t1 = performance.now();
  console.log(`[4] Patient Instant Search (${searchResults.length} matches): ${(t1 - t0).toFixed(2)} ms`);

  // 5. Patient Profile Load + History
  const samplePatient = patients[0];
  t0 = performance.now();
  const [patientDetail, patientAppts, patientInvoices] = await Promise.all([
    prisma.patient.findUnique({ where: { id: samplePatient.id } }),
    prisma.appointment.findMany({ where: { patientId: samplePatient.id }, take: 100 }),
    prisma.invoice.findMany({ where: { patientId: samplePatient.id }, take: 100 })
  ]);
  t1 = performance.now();
  console.log(`[5] Patient Profile + Complete History: ${(t1 - t0).toFixed(2)} ms`);

  // 6. OPD Report Aggregation for September (12k appts)
  t0 = performance.now();
  const startOfDay = new Date(2026, 8, 1, 0, 0, 0);
  const endOfDay = new Date(2026, 8, 17, 23, 59, 59);
  const reportAppts = await prisma.appointment.findMany({
    where: { startsAt: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, status: true, startsAt: true, patientId: true, providerId: true }
  });
  t1 = performance.now();
  console.log(`[6] OPD Date-Range Query (${reportAppts.length} appts): ${(t1 - t0).toFixed(2)} ms`);

  // 7. Atomic MR Sequence Next Val
  t0 = performance.now();
  const seq = await prisma.$queryRawUnsafe('SELECT nextVal FROM _AppSequence WHERE name = ?', 'MR');
  t1 = performance.now();
  console.log(`[7] MR Sequence Number Generator O(1): ${(t1 - t0).toFixed(2)} ms (Current next: ${seq[0]?.nextVal})`);

  console.log('=== Benchmark Completed Successfully ===');
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
  });
  console.log('Registered Users in DB:');
  console.table(users);
  await prisma.$disconnect();
}

bench().catch(console.error);
