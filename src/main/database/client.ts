import { app } from 'electron';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';

// Fix userData path so it never changes regardless of productName
app.setName('clinic-management-system');

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: { url: `file:${join(app.getPath('userData'), 'clinic.db').replaceAll('\\', '/')}` },
      },
    });
  }

  return prisma;
}

export async function initializeDatabase(): Promise<void> {
  const database = getPrisma();

  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'RECEPTIONIST',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Patient" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
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
  // Migrations: add columns if they don't exist yet
  const patientCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Patient)')).map(r => r.name);
  if (!patientCols.includes('bloodGroup')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "bloodGroup" TEXT');
  if (!patientCols.includes('allergies')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "allergies" TEXT');
  if (!patientCols.includes('chronicConditions')) await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "chronicConditions" TEXT');
  if (!patientCols.includes('mrNumber')) {
    await database.$executeRawUnsafe('ALTER TABLE "Patient" ADD COLUMN "mrNumber" TEXT NOT NULL DEFAULT \'\'');
    // Backfill existing rows with unique MR numbers
    const existing = await database.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "Patient" WHERE "mrNumber" = \'\'  ORDER BY "createdAt" ASC');
    for (let i = 0; i < existing.length; i++) {
      const num = String(i + 1).padStart(5, '0');
      await database.$executeRawUnsafe(`UPDATE "Patient" SET "mrNumber" = 'MR-${num}' WHERE "id" = '${existing[i].id}'`);
    }
    await database.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Patient_mrNumber_key" ON "Patient"("mrNumber")');
    await database.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Patient_mrNumber_idx" ON "Patient"("mrNumber")');
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
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT,
      FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt")',
  );
  const apptCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Appointment)')).map(r => r.name);
  if (!apptCols.includes('recurrenceRule')) await database.$executeRawUnsafe('ALTER TABLE "Appointment" ADD COLUMN "recurrenceRule" TEXT');
  if (!apptCols.includes('parentId')) await database.$executeRawUnsafe('ALTER TABLE "Appointment" ADD COLUMN "parentId" TEXT');
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
  // Token Table Creation with "reason"
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
    'CREATE INDEX IF NOT EXISTS "Token_patientId_idx" ON "Token"("patientId")',
  );

  // Runtime Migration for existing installations (CRUCIAL FIX)
  const tokenCols = (await database.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(Token)')).map(r => r.name);
  if (!tokenCols.includes('reason')) {
    await database.$executeRawUnsafe('ALTER TABLE "Token" ADD COLUMN "reason" TEXT');
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

  // DoctorAttendance table
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

  // Medicine table
  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Medicine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "price" DECIMAL NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Medicine_name_idx" ON "Medicine"("name")',
  );

  // Prescription table
  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Prescription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tokenId" TEXT NOT NULL UNIQUE,
      "diagnosis" TEXT NOT NULL DEFAULT '',
      "medicines" TEXT NOT NULL DEFAULT '[]',
      "tests" TEXT NOT NULL DEFAULT '[]',
      "advice" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE
    )
  `);
  await database.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Prescription_tokenId_idx" ON "Prescription"("tokenId")',
  );
}

export async function disconnectPrisma(): Promise<void> {
  await prisma?.$disconnect();
}
