#!/usr/bin/env node
const { execSync } = require('child_process');
const { join, resolve } = require('path');
const { existsSync } = require('fs');
const os = require('os');

function getDbPath() {
  const appName = 'clinic-management-system';
  let base;
  if (process.platform === 'win32') {
    base = process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming');
  } else if (process.platform === 'darwin') {
    base = join(os.homedir(), 'Library', 'Application Support');
  } else {
    base = process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config');
  }
  return join(base, appName, 'clinic.db');
}

const dbPath = getDbPath();

if (!existsSync(dbPath)) {
  console.error(`\n❌ DB not found at: ${dbPath}`);
  console.error('   Run the app at least once so the database is created.\n');
  process.exit(1);
}

// Use node:sqlite (Node 22+) or fallback to prisma db execute
const sqlStatements = [
  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS "Payment_invoiceId_paidAt_idx" ON "Payment"("invoiceId", "paidAt")`,
  `CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt")`,
  `CREATE TABLE IF NOT EXISTS "LabOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "test" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "notes" TEXT,
    "orderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT,
    FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS "LabOrder_patientId_idx" ON "LabOrder"("patientId")`,
  `CREATE INDEX IF NOT EXISTS "LabOrder_status_idx" ON "LabOrder"("status")`,
  `CREATE TABLE IF NOT EXISTS "LabReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "LabReport_labOrderId_idx" ON "LabReport"("labOrderId")`,
  `CREATE TABLE IF NOT EXISTS "PatientDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "PatientDocument_patientId_idx" ON "PatientDocument"("patientId")`,
  `CREATE TABLE IF NOT EXISTS "DoctorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "specialization" TEXT NOT NULL,
    "qualification" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  )`,
];

const url = `file:${dbPath}`;
const env = { ...process.env, DATABASE_URL: url };

let synced = false;
for (const sql of sqlStatements) {
  try {
    execSync(`npx prisma db execute --stdin --url "${url}"`, {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    synced = true;
  } catch {
    // ignore — table may already exist or FK constraint on older sqlite
  }
}

if (synced) console.log('✅ Missing tables synced.');

console.log(`\n✅ Opening Prisma Studio with DB:\n   ${dbPath}\n`);
execSync('npx prisma studio', { stdio: 'inherit', env });
