import type { Patient, Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';
import { ageToDateOfBirth } from '../../shared/patientAge';
import { toWhatsAppNumber } from '../../shared/whatsappPhone';

export interface PatientListInput {
  page: number;
  pageSize: number;
  search: string;
  providerId?: string;
}

export interface PatientInput {
  firstName: string;
  lastName?: string | null;
  weight?: number | string | null;
  dateOfBirth?: string | null;
  age?: number | string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  /** Doctor who registered / owns this patient (not an appointment). */
  primaryDoctorId?: string | null;
}

async function generateMrNumber(): Promise<string> {
  const prisma = getPrisma();
  try {
    const updated = await prisma.$queryRawUnsafe<{ nextVal: number | bigint }[]>(
      `UPDATE "_AppSequence" SET "nextVal" = "nextVal" + 1 WHERE "name" = 'mrNumber' RETURNING "nextVal"`
    );
    if (updated && updated.length > 0 && updated[0].nextVal != null) {
      const num = Number(updated[0].nextVal);
      return `MR-${String(num).padStart(5, '0')}`;
    }
  } catch {
    // Table or row not present yet, initialize below
  }

  // Initialize sequence from current maximum MR number in DB
  const res = await prisma.$queryRawUnsafe<{ maxNum: number | bigint | null }[]>(
    `SELECT MAX(CAST(SUBSTR("mrNumber", 4) AS INTEGER)) as maxNum FROM "Patient" WHERE "mrNumber" LIKE 'MR-%'`,
  );
  const raw = res[0]?.maxNum;
  const currentMax = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0;
  const nextVal = currentMax + 1;

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_AppSequence" ("name", "nextVal") VALUES ('mrNumber', ?)
       ON CONFLICT("name") DO UPDATE SET "nextVal" = ?`,
      nextVal,
      nextVal,
    );
  } catch {
    // Ignore fallback errors
  }

  return `MR-${String(nextVal).padStart(5, '0')}`;
}

function resolveDateOfBirth(input: PatientInput): Date | null {
  if (input.dateOfBirth) return new Date(input.dateOfBirth);
  if (input.age != null && String(input.age).trim() !== '') {
    return ageToDateOfBirth(input.age);
  }
  return null;
}

function mapPatientInput(input: PatientInput): Omit<Prisma.PatientCreateInput, 'mrNumber'> {
  const weightNum = input.weight != null && String(input.weight).trim() !== '' ? parseFloat(String(input.weight)) : null;
  const data = {
    firstName: input.firstName.trim(),
    lastName: input.lastName?.trim() || null,
    weight: weightNum != null && !Number.isNaN(weightNum) ? weightNum : null,
    dateOfBirth: resolveDateOfBirth(input),
    gender: input.gender?.trim() || null,
    phone: toWhatsAppNumber(input.phone) || input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    bloodGroup: input.bloodGroup?.trim() || null,
    allergies: input.allergies?.trim() || null,
    chronicConditions: input.chronicConditions?.trim() || null,
    ...(input.primaryDoctorId ? { primaryDoctor: { connect: { id: input.primaryDoctorId } } } : {}),
  };
  return data as Omit<Prisma.PatientCreateInput, 'mrNumber'>;
}

function normalizePatientRow(row: any): Patient {
  return {
    ...row,
    weight: row.weight != null && !Number.isNaN(Number(row.weight)) ? Number(row.weight) : null,
    dateOfBirth: row.dateOfBirth
      ? row.dateOfBirth instanceof Date
        ? row.dateOfBirth
        : new Date(row.dateOfBirth)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export async function listPatients({ page, pageSize, search, providerId }: PatientListInput): Promise<{
  data: Patient[];
  total: number;
}> {
  const prisma = getPrisma();
  const trimmed = search?.trim();

  // Fast path for doctor filtering (using indexed UNION instead of slow correlated scans)
  if (providerId) {
    let whereClause = `
      "id" IN (
        SELECT "id" FROM "Patient" WHERE "primaryDoctorId" = ?
        UNION
        SELECT "patientId" FROM "Appointment" WHERE "providerId" = ?
        UNION
        SELECT "patientId" FROM "Token" WHERE "doctorId" = ?
      )
    `;
    const params: (string | number)[] = [providerId, providerId, providerId];

    if (trimmed) {
      whereClause += ` AND (
        "firstName" LIKE ? OR "lastName" LIKE ? OR ("firstName" || ' ' || COALESCE("lastName", '')) LIKE ?
        OR "phone" LIKE ? OR "email" LIKE ? OR "mrNumber" LIKE ?
      )`;
      const pattern = `%${trimmed}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const offset = Math.max(0, (page - 1) * pageSize);
    const dataQuery = `SELECT * FROM "Patient" WHERE ${whereClause} ORDER BY "createdAt" DESC, "id" DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as "total" FROM "Patient" WHERE ${whereClause}`;

    const [rows, countRes] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(dataQuery, ...params, pageSize, offset),
      prisma.$queryRawUnsafe<{ total: number | bigint }[]>(countQuery, ...params),
    ]);

    const data = rows.map(normalizePatientRow);
    const total = Number(countRes[0]?.total ?? 0);

    data.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      const mrA = parseInt((a.mrNumber || '').replace(/\D/g, ''), 10) || 0;
      const mrB = parseInt((b.mrNumber || '').replace(/\D/g, ''), 10) || 0;
      return mrB - mrA;
    });

    return { data, total };
  }

  // Non-doctor (admin / receptionist / lab)
  let whereClause = '1=1';
  const params: (string | number)[] = [];

  if (trimmed) {
    whereClause += ` AND (
      "firstName" LIKE ? OR "lastName" LIKE ? OR ("firstName" || ' ' || COALESCE("lastName", '')) LIKE ?
      OR "phone" LIKE ? OR "email" LIKE ? OR "mrNumber" LIKE ?
    )`;
    const pattern = `%${trimmed}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const offset = Math.max(0, (page - 1) * pageSize);
  const dataQuery = `SELECT * FROM "Patient" WHERE ${whereClause} ORDER BY "createdAt" DESC, "id" DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) as "total" FROM "Patient" WHERE ${whereClause}`;

  const [rows, countRes] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(dataQuery, ...params, pageSize, offset),
    prisma.$queryRawUnsafe<{ total: number | bigint }[]>(countQuery, ...params),
  ]);

  const data = rows.map(normalizePatientRow);
  const total = Number(countRes[0]?.total ?? 0);

  data.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (tB !== tA) return tB - tA;
    const mrA = parseInt((a.mrNumber || '').replace(/\D/g, ''), 10) || 0;
    const mrB = parseInt((b.mrNumber || '').replace(/\D/g, ''), 10) || 0;
    return mrB - mrA;
  });

  return { data, total };
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  const mrNumber = await generateMrNumber();
  return getPrisma().patient.create({ data: { ...mapPatientInput(input), mrNumber } });
}

export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  const data = mapPatientInput(input);
  // Do not re-assign primary doctor on normal demographic edits unless explicitly sent
  if (input.primaryDoctorId === undefined) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
  } else if (!input.primaryDoctorId) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
    (data as Prisma.PatientUpdateInput).primaryDoctor = { disconnect: true };
  }
  return getPrisma().patient.update({ where: { id }, data });
}

export async function deletePatient(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({ where: { patientId: id }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length > 0) {
      await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { patientId: id } });
    }

    const labOrders = await tx.labOrder.findMany({ where: { patientId: id }, select: { id: true } });
    const labOrderIds = labOrders.map((o) => o.id);
    if (labOrderIds.length > 0) {
      await tx.labReport.deleteMany({ where: { labOrderId: { in: labOrderIds } } });
      await tx.labOrder.deleteMany({ where: { patientId: id } });
    }

    const tokens = await tx.token.findMany({ where: { patientId: id }, select: { id: true } });
    if (tokens.length > 0) {
      // Prescription is SQLite-only (not in Prisma schema); remove before tokens.
      for (const token of tokens) {
        await tx.$executeRawUnsafe('DELETE FROM "Prescription" WHERE "tokenId" = ?', token.id);
      }
      await tx.token.deleteMany({ where: { patientId: id } });
    }

    await tx.appointment.deleteMany({ where: { patientId: id } });
    await tx.patientDocument.deleteMany({ where: { patientId: id } });
    await tx.patient.delete({ where: { id } });
  });
}

export async function getPatient(id: string): Promise<Patient | null> {
  return getPrisma().patient.findUnique({
    where: { id },
  });
}
