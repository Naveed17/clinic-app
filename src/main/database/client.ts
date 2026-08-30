import { app } from 'electron';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { seedDefaultAdmin } from '../auth/seed';

function getSavedLicenseKey(): string | null {
  try {
    const file = join(app.getPath('userData'), 'license.dat');
    if (existsSync(file)) {
      const key = readFileSync(file, 'utf-8').trim();
      if (key) return key;
    }
  } catch { /* ignore */ }
  try {
    const cacheFile = join(app.getPath('userData'), 'license-cache.json');
    if (existsSync(cacheFile)) {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as { key?: string; schemaId?: string };
      if (cache?.key) return cache.key;
    }
  } catch { /* ignore */ }
  return null;
}

export function schemaIdForLicenseKey(key: string): string {
  const normalized = String(key || '').trim().toUpperCase();
  if (!normalized) return '';
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `lic_${hash}`;
}

export function getActiveSchemaId(): string {
  const key = getSavedLicenseKey();
  if (!key) return '';
  try {
    const cacheFile = join(app.getPath('userData'), 'license-cache.json');
    if (existsSync(cacheFile)) {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as { key?: string; schemaId?: string };
      if (cache?.key === key && cache?.schemaId) return cache.schemaId;
    }
  } catch { /* ignore */ }
  return schemaIdForLicenseKey(key);
}

export function getClinicDbPath(): string {
  const schemaId = getActiveSchemaId();
  if (!schemaId) {
    return join(app.getPath('userData'), 'clinic.db');
  }

  const schemaDbPath = join(app.getPath('userData'), `clinic_${schemaId}.db`);
  const legacyDbPath = join(app.getPath('userData'), 'clinic.db');
  const legacyFlagPath = join(app.getPath('userData'), 'clinic_legacy_migrated.flag');

  // Legacy migration runs ONCE ONLY for the original installed license key.
  // Fresh/new license keys will NOT copy legacy data and will start with a clean database.
  if (!existsSync(schemaDbPath) && existsSync(legacyDbPath) && !existsSync(legacyFlagPath)) {
    try {
      copyFileSync(legacyDbPath, schemaDbPath);
      writeFileSync(legacyFlagPath, schemaId, 'utf-8');
      console.log(`[Database] Migrated legacy clinic.db to ${schemaDbPath}`);
    } catch (err) {
      console.error(`[Database] Failed to migrate legacy clinic.db:`, err);
    }
  }

  return schemaDbPath;
}

let prisma: PrismaClient | undefined;
let currentDbPath: string | undefined;
const initializedDbPaths = new Set<string>();
let initPromise: Promise<void> | undefined;

export function getPrisma(): PrismaClient {
  const targetDbPath = getClinicDbPath();
  if (prisma && currentDbPath !== targetDbPath) {
    try {
      void prisma.$disconnect();
    } catch { /* ignore */ }
    prisma = undefined;
  }

  if (!prisma) {
    currentDbPath = targetDbPath;
    prisma = new PrismaClient({
      datasources: {
        db: { url: `file:${targetDbPath.replaceAll('\\', '/')}` },
      },
    });
  }

  return prisma;
}

export async function ensureDatabaseReady(): Promise<PrismaClient> {
  const db = getPrisma();
  const targetDbPath = currentDbPath || getClinicDbPath();
  if (!initializedDbPaths.has(targetDbPath)) {
    if (!initPromise) {
      initPromise = (async () => {
        await initializeDatabase(db);
        try {
          await seedDefaultAdmin();
        } catch { /* ignore */ }
        initializedDbPaths.add(targetDbPath);
      })().finally(() => {
        initPromise = undefined;
      });
    }
    await initPromise;
  }
  return db;
}

/** Idempotent — safe to call before pharmacy queue / dispense queries. */
export async function ensurePrescriptionPharmacyColumns(
  database: PrismaClient = getPrisma(),
): Promise<void> {
  const cols = (
    await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Prescription)')
  ).map((r) => r.name);
  if (!cols.includes('pharmacyStatus')) {
    await database.$executeRawUnsafe(
      `ALTER TABLE "Prescription" ADD COLUMN "pharmacyStatus" TEXT NOT NULL DEFAULT 'PENDING'`,
    );
  }
  if (!cols.includes('dispensedAt')) {
    await database.$executeRawUnsafe('ALTER TABLE "Prescription" ADD COLUMN "dispensedAt" DATETIME');
  }
  if (!cols.includes('invoiceId')) {
    await database.$executeRawUnsafe('ALTER TABLE "Prescription" ADD COLUMN "invoiceId" TEXT');
  }
}

export async function initializeDatabase(database: PrismaClient = getPrisma()): Promise<void> {
  try {
    await database.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await database.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
    await database.$executeRawUnsafe('PRAGMA temp_store = MEMORY');
    await database.$executeRawUnsafe('PRAGMA cache_size = -64000');
  } catch {
    /* Ignore pragma errors on non-SQLite backends */
  }

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'RECEPTIONIST',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "avatar" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  const userCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(User)')).map((r) => r.name);
  if (!userCols.includes('avatar')) {
    await database.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "avatar" TEXT');
  }

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Patient" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT,
      "weight" REAL,
      "dateOfBirth" DATETIME,
      "phone" TEXT,
      "email" TEXT,
      "address" TEXT,
      "emergencyContactName" TEXT,
      "emergencyContactPhone" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Patient_createdAt_idx" ON "Patient"("createdAt")',
  );

  // Patient Migrations
  const patientTableInfo = await database.$queryRawUnsafe<{ name: string; notnull: number | bigint }[]>('PRAGMA table_info(Patient)');
  const patientCols = patientTableInfo.map((r) => r.name);
  const lastNameCol = patientTableInfo.find((c) => c.name === 'lastName');
  if (lastNameCol && Number(lastNameCol.notnull) === 1) {
    try {
      await database.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
      await database.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Patient_migration_tmp" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "mrNumber" TEXT NOT NULL DEFAULT '',
          "firstName" TEXT NOT NULL,
          "lastName" TEXT,
          "weight" REAL,
          "dateOfBirth" DATETIME,
          "gender" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "address" TEXT,
          "emergencyContactName" TEXT,
          "emergencyContactPhone" TEXT,
          "bloodGroup" TEXT,
          "allergies" TEXT,
          "chronicConditions" TEXT,
          "primaryDoctorId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          FOREIGN KEY ("primaryDoctorId") REFERENCES "User"("id") ON DELETE SET NULL
        )
      `);
      const tmpInfo = await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Patient_migration_tmp)');
      const commonCols = patientTableInfo.filter((c) => tmpInfo.some((t) => t.name === c.name)).map((c) => `"${c.name}"`).join(', ');
      await database.$executeRawUnsafe(`INSERT INTO "Patient_migration_tmp" (${commonCols}) SELECT ${commonCols} FROM "Patient"`);
      await database.$executeRawUnsafe('DROP TABLE "Patient"');
      await database.$executeRawUnsafe('ALTER TABLE "Patient_migration_tmp" RENAME TO "Patient"');
      await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName")');
      await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone")');
      await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_createdAt_idx" ON "Patient"("createdAt")');
      await database.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Patient_mrNumber_key" ON "Patient"("mrNumber")');
      await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_mrNumber_idx" ON "Patient"("mrNumber")');
      await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_primaryDoctorId_idx" ON "Patient"("primaryDoctorId")');
    } catch (err) {
      console.error('Failed to migrate Patient lastName column:', err);
    } finally {
      await database.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    }
  }
  if (!patientCols.includes('bloodGroup')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "bloodGroup" TEXT');
  if (!patientCols.includes('allergies')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "allergies" TEXT');
  if (!patientCols.includes('chronicConditions')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "chronicConditions" TEXT');
  if (!patientCols.includes('weight')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "weight" REAL');
  if (!patientCols.includes('mrNumber')) {
    await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "mrNumber" TEXT NOT NULL DEFAULT \'\'');
    const existing = await database.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "Patient" WHERE "mrNumber" = \'\' ORDER BY "createdAt" ASC');
    for (let i = 0; i < existing.length; i++) {
      const num = String(i + 1).padStart(5, '0');
      await database.$executeRawUnsafe(`UPDATE "Patient" SET "mrNumber" = ? WHERE "id" = ?`, `MR-${num}`, existing[i].id);
    }
    await database.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Patient_mrNumber_key" ON "Patient"("mrNumber")');
    await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_mrNumber_idx" ON "Patient"("mrNumber")');
  }
  if (!patientCols.includes('primaryDoctorId')) {
    await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "primaryDoctorId" TEXT');
    await database.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Patient_primaryDoctorId_idx" ON "Patient"("primaryDoctorId")',
    );
  }
  if (!patientCols.includes('gender')) {
    await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "gender" TEXT');
  }

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Appointment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "patientId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "endsAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "reason" TEXT,
      "notes" TEXT,
      "feeType" TEXT NOT NULL DEFAULT 'PAID',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT,
      FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Appointment_createdAt_idx" ON "Appointment"("createdAt")',
  );

  const apptCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Appointment)')).map(r => r.name);
  if (!apptCols.includes('recurrenceRule')) await database.$executeRawUnsafe('ALTER TABLE "Appointment" ADD COLUMN "recurrenceRule" TEXT');
  if (!apptCols.includes('parentId')) await database.$executeRawUnsafe('ALTER TABLE "Appointment" ADD COLUMN "parentId" TEXT');
  if (!apptCols.includes('feeType')) await database.$executeRawUnsafe('ALTER TABLE "Appointment" ADD COLUMN "feeType" TEXT NOT NULL DEFAULT \'PAID\'');
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Appointment_providerId_startsAt_idx" ON "Appointment"("providerId", "startsAt")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "patientId" TEXT NOT NULL,
      "appointmentId" TEXT UNIQUE,
      "invoiceNumber" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "issuedAt" DATETIME,
      "dueAt" DATETIME,
      "subtotal" DECIMAL NOT NULL DEFAULT 0,
      "discount" DECIMAL NOT NULL DEFAULT 0,
      "tax" DECIMAL NOT NULL DEFAULT 0,
      "total" DECIMAL NOT NULL DEFAULT 0,
      "amountPaid" DECIMAL NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT
    )
  `);

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InvoiceItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "invoiceId" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "unitPrice" DECIMAL NOT NULL DEFAULT 0,
      "lineTotal" DECIMAL NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Invoice_patientId_createdAt_idx" ON "Invoice"("patientId", "createdAt")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "Invoice"("createdAt")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DoctorProfile" (
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
    )
  `);
  const doctorProfileCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(DoctorProfile)')).map((r) => r.name);
  if (!doctorProfileCols.includes('avatar')) {
    await database.$executeRawUnsafe('ALTER TABLE "DoctorProfile" ADD COLUMN "avatar" TEXT');
  }
  if (!doctorProfileCols.includes('consultationFee')) {
    await database.$executeRawUnsafe(
      'ALTER TABLE "DoctorProfile" ADD COLUMN "consultationFee" DECIMAL NOT NULL DEFAULT 0',
    );
  }
  await database.$executeRawUnsafe(`
    UPDATE "User" SET "avatar" = (
      SELECT dp.avatar FROM "DoctorProfile" dp
       WHERE dp."userId" = "User".id AND dp.avatar IS NOT NULL AND TRIM(dp.avatar) <> ''
       LIMIT 1
    )
    WHERE ("avatar" IS NULL OR TRIM("avatar") = '')
      AND EXISTS (
        SELECT 1 FROM "DoctorProfile" dp
         WHERE dp."userId" = "User".id AND dp.avatar IS NOT NULL AND TRIM(dp.avatar) <> ''
      )
  `);

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LabOrder" (
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
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "LabOrder_patientId_idx" ON "LabOrder"("patientId")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "LabOrder_status_idx" ON "LabOrder"("status")',
  );

  const labOrderCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(LabOrder)')).map(r => r.name);
  if (!labOrderCols.includes('tokenId')) {
    await database.$executeRawUnsafe('ALTER TABLE "LabOrder" ADD COLUMN "tokenId" TEXT');
    await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LabOrder_tokenId_idx" ON "LabOrder"("tokenId")');
  }

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PatientDocument" (
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
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PatientDocument_patientId_idx" ON "PatientDocument"("patientId")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LabReport" (
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
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "LabReport_labOrderId_idx" ON "LabReport"("labOrderId")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Payment" (
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
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Payment_invoiceId_paidAt_idx" ON "Payment"("invoiceId", "paidAt")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Token" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tokenNumber" INTEGER NOT NULL,
      "date" TEXT NOT NULL,
      "patientId" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'WAITING',
      "notes" TEXT,
      "reason" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT,
      FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Token_date_tokenNumber_doctorId_key" ON "Token"("date", "tokenNumber", "doctorId")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Token_date_doctorId_idx" ON "Token"("date", "doctorId")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Token_date_status_idx" ON "Token"("date", "status")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Token_date_doctorId_status_idx" ON "Token"("date", "doctorId", "status")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Token_patientId_idx" ON "Token"("patientId")',
  );

  const tokenCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Token)')).map(r => r.name);
  if (!tokenCols.includes('reason')) {
    await database.$executeRawUnsafe('ALTER TABLE "Token" ADD COLUMN "reason" TEXT');
  }
  if (!tokenCols.includes('consultationFee')) {
    await database.$executeRawUnsafe(
      'ALTER TABLE "Token" ADD COLUMN "consultationFee" DECIMAL NOT NULL DEFAULT 0',
    );
  }
  if (!tokenCols.includes('feeRefunded')) {
    await database.$executeRawUnsafe(
      'ALTER TABLE "Token" ADD COLUMN "feeRefunded" DECIMAL NOT NULL DEFAULT 0',
    );
  }
  if (!tokenCols.includes('feeDiscount')) {
    await database.$executeRawUnsafe(
      'ALTER TABLE "Token" ADD COLUMN "feeDiscount" DECIMAL NOT NULL DEFAULT 0',
    );
  }

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DoctorSchedule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "doctorId" TEXT NOT NULL,
      "dayOfWeek" INTEGER NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "DoctorSchedule_doctorId_dayOfWeek_key" ON "DoctorSchedule"("doctorId", "dayOfWeek")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "DoctorSchedule_doctorId_idx" ON "DoctorSchedule"("doctorId")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DoctorAttendance" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "doctorId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "checkInAt" DATETIME NOT NULL,
      "checkOutAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "DoctorAttendance_doctorId_date_key" ON "DoctorAttendance"("doctorId", "date")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "DoctorAttendance_doctorId_idx" ON "DoctorAttendance"("doctorId")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "DoctorAttendance_date_idx" ON "DoctorAttendance"("date")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Prescription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tokenId" TEXT NOT NULL UNIQUE,
      "diagnosis" TEXT NOT NULL DEFAULT '',
      "medicines" TEXT NOT NULL DEFAULT '[]',
      "tests" TEXT NOT NULL DEFAULT '[]',
      "advice" TEXT NOT NULL DEFAULT '',
      "thumbName" TEXT,
      "thumbnail" TEXT,
      "pharmacyStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "dispensedAt" DATETIME,
      "invoiceId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Prescription_tokenId_idx" ON "Prescription"("tokenId")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Prescription_pharmacyStatus_idx" ON "Prescription"("pharmacyStatus")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Prescription_createdAt_idx" ON "Prescription"("createdAt")',
  );
  const prescriptionCols = (
    await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Prescription)')
  ).map((r) => r.name);
  if (!prescriptionCols.includes('thumbName')) {
    await database.$executeRawUnsafe('ALTER TABLE "Prescription" ADD COLUMN "thumbName" TEXT');
  }
  if (!prescriptionCols.includes('thumbnail')) {
    await database.$executeRawUnsafe('ALTER TABLE "Prescription" ADD COLUMN "thumbnail" TEXT');
  }
  await ensurePrescriptionPharmacyColumns(database);

  // ==========================================
  // MEDICINE CATALOG (invoice / Rx picker)
  // ==========================================

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Medicine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "genericName" TEXT,
      "categoryId" TEXT,
      "barcode" TEXT UNIQUE,
      "unit" TEXT NOT NULL DEFAULT 'Tablet',
      "rackNumber" TEXT,
      "minStockAlert" INTEGER NOT NULL DEFAULT 10,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_name_idx" ON "Medicine"("name")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_genericName_idx" ON "Medicine"("genericName")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_barcode_idx" ON "Medicine"("barcode")',
  );

  // Migration for existing Medicine table if upgrading from simple schema
  const medCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Medicine)')).map(r => r.name);
  if (!medCols.includes('genericName')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "genericName" TEXT');
  if (!medCols.includes('categoryId')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "categoryId" TEXT');
  if (!medCols.includes('barcode')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "barcode" TEXT');
  if (!medCols.includes('rackNumber')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "rackNumber" TEXT');
  if (!medCols.includes('minStockAlert')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "minStockAlert" INTEGER NOT NULL DEFAULT 10');
  if (!medCols.includes('unit')) await database.$executeRawUnsafe(`ALTER TABLE "Medicine" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'Tablet'`);
  if (!medCols.includes('mg')) await database.$executeRawUnsafe('ALTER TABLE "Medicine" ADD COLUMN "mg" INTEGER');

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MedicineBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "medicineId" TEXT NOT NULL,
      "batchNumber" TEXT NOT NULL,
      "expiryDate" DATETIME NOT NULL,
      "purchasePrice" DECIMAL NOT NULL DEFAULT 0,
      "salePrice" DECIMAL NOT NULL DEFAULT 0,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "MedicineBatch_medicineId_batchNumber_key" ON "MedicineBatch"("medicineId", "batchNumber")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "MedicineBatch_expiryDate_idx" ON "MedicineBatch"("expiryDate")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "MedicineBatch_quantity_idx" ON "MedicineBatch"("quantity")',
  );

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "roomId" TEXT NOT NULL DEFAULT 'staff',
      "senderId" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT '',
      "message" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "audioData" TEXT,
      "audioDuration" REAL
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt")',
  );

  const chatCols = (
    await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(ChatMessage)')
  ).map((r) => r.name);
  if (!chatCols.includes('audioData')) {
    await database.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN "audioData" TEXT');
  }
  if (!chatCols.includes('audioDuration')) {
    await database.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN "audioDuration" REAL');
  }

  // Migrate legacy flat stock/price into MedicineBatch (one-time, when old columns still exist)
  if (medCols.includes('stock') || medCols.includes('price')) {
    try {
      const legacyRows = await database.$queryRawUnsafe<{
        id: string; name: string; stock: number | null; price: number | null;
      }[]>(`SELECT id, name,
        ${medCols.includes('stock') ? 'stock' : '0 as stock'},
        ${medCols.includes('price') ? 'price' : '0 as price'}
        FROM "Medicine"`);

      for (const row of legacyRows) {
        const stock = Number(row.stock ?? 0);
        const price = Number(row.price ?? 0);
        if (stock <= 0 && price <= 0) continue;

        const existingBatches = await database.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "MedicineBatch" WHERE medicineId = ? LIMIT 1`,
          row.id,
        );
        if (existingBatches.length > 0) continue;

        const now = new Date().toISOString();
        const expiry = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
        await database.$executeRawUnsafe(
          `INSERT INTO "MedicineBatch" (id, medicineId, batchNumber, expiryDate, purchasePrice, salePrice, quantity, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(), row.id, 'LEGACY', expiry, price, price, Math.max(0, stock), now, now,
        );
      }
    } catch {
      // Ignore if legacy columns cannot be read
    }
  }

  await database.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "StockMovement"');
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "PurchaseOrderItem"');
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "PurchaseOrder"');
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "Supplier"');
  // Keep a stub category table: older DBs still have Medicine.categoryId → MedicineCategory.
  // Dropping only the parent table makes Prisma medicine.create() fail with P2021.
  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MedicineCategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await rebuildMedicineWithoutCategoryFk(database);
  await migrateMedicineNameMgUnique(database);
  await database.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

/** Drop leftover FK to MedicineCategory so catalog inserts do not require that table. */
async function rebuildMedicineWithoutCategoryFk(database: PrismaClient): Promise<void> {
  const fks = await database.$queryRawUnsafe<{ table: string }[]>(
    'PRAGMA foreign_key_list("Medicine")',
  );
  if (!fks.some((fk) => String(fk.table) === 'MedicineCategory')) return;

  const cols = (
    await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info("Medicine")')
  ).map((r) => r.name);
  const dest = [
    'id',
    'name',
    'genericName',
    'categoryId',
    'barcode',
    'unit',
    'rackNumber',
    'minStockAlert',
    'mg',
    'createdAt',
    'updatedAt',
  ];
  const copy = dest.filter((c) => cols.includes(c));

  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "Medicine_rebuild"');
  await database.$executeRawUnsafe(`
    CREATE TABLE "Medicine_rebuild" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "genericName" TEXT,
      "categoryId" TEXT,
      "barcode" TEXT UNIQUE,
      "unit" TEXT NOT NULL DEFAULT 'Tablet',
      "rackNumber" TEXT,
      "minStockAlert" INTEGER NOT NULL DEFAULT 10,
      "mg" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(
    `INSERT INTO "Medicine_rebuild" (${copy.map((c) => `"${c}"`).join(', ')})
     SELECT ${copy.map((c) => `"${c}"`).join(', ')} FROM "Medicine"`,
  );
  await database.$executeRawUnsafe('DROP TABLE "Medicine"');
  await database.$executeRawUnsafe('ALTER TABLE "Medicine_rebuild" RENAME TO "Medicine"');
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_name_idx" ON "Medicine"("name")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_genericName_idx" ON "Medicine"("genericName")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_barcode_idx" ON "Medicine"("barcode")',
  );
}

/** Allow same medicine name with different mg strengths (Tab/Capsule/Injection). */
async function migrateMedicineNameMgUnique(database: PrismaClient): Promise<void> {
  const indexes = await database.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Medicine'`,
  );
  if (indexes.some((i) => i.name === 'Medicine_name_mg_key')) return;

  const cols = (
    await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info("Medicine")')
  ).map((r) => r.name);
  const dest = [
    'id',
    'name',
    'genericName',
    'categoryId',
    'barcode',
    'unit',
    'rackNumber',
    'minStockAlert',
    'mg',
    'createdAt',
    'updatedAt',
  ];
  const copy = dest.filter((c) => cols.includes(c));

  await database.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "Medicine_rebuild"');
  await database.$executeRawUnsafe(`
    CREATE TABLE "Medicine_rebuild" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "genericName" TEXT,
      "categoryId" TEXT,
      "barcode" TEXT UNIQUE,
      "unit" TEXT NOT NULL DEFAULT 'Tablet',
      "rackNumber" TEXT,
      "minStockAlert" INTEGER NOT NULL DEFAULT 10,
      "mg" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(
    `INSERT INTO "Medicine_rebuild" (${copy.map((c) => `"${c}"`).join(', ')})
     SELECT ${copy.map((c) => `"${c}"`).join(', ')} FROM "Medicine"`,
  );
  await database.$executeRawUnsafe('DROP TABLE "Medicine"');
  await database.$executeRawUnsafe('ALTER TABLE "Medicine_rebuild" RENAME TO "Medicine"');
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_name_idx" ON "Medicine"("name")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_genericName_idx" ON "Medicine"("genericName")',
  );
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_barcode_idx" ON "Medicine"("barcode")',
  );
  await database.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Medicine_name_mg_key" ON "Medicine"("name", IFNULL("mg", -1))',
  );
  await database.$executeRawUnsafe('PRAGMA foreign_keys=ON');
}

export async function disconnectPrisma(): Promise<void> {
  await prisma?.$disconnect();
}