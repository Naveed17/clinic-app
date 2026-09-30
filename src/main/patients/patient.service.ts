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
  
  // 1. Find the highest number in Patient table
  let currentMax = 0;
  try {
    const res = await prisma.$queryRawUnsafe<{ maxNum: number | bigint | null }[]>(
      `SELECT MAX(CAST(SUBSTR("mrNumber", 4) AS INTEGER)) as maxNum FROM "Patient" WHERE "mrNumber" LIKE 'MR-%'`,
    );
    const raw = res?.[0]?.maxNum;
    if (raw != null && Number.isFinite(Number(raw))) {
      currentMax = Math.max(currentMax, Number(raw));
    }
  } catch (err) {
    console.warn('[patient.service] Error checking MAX mrNumber from Patient:', err);
  }

  // 2. Also check _AppSequence
  try {
    const seqRow = await prisma.$queryRawUnsafe<{ nextVal: number | bigint }[]>(
      `SELECT "nextVal" FROM "_AppSequence" WHERE "name" = 'mrNumber'`,
    );
    if (seqRow && seqRow.length > 0 && seqRow[0].nextVal != null) {
      currentMax = Math.max(currentMax, Number(seqRow[0].nextVal));
    }
  } catch {
    // ignore
  }

  // 3. Find first free candidate number that does not exist in Patient table
  let candidate = currentMax + 1;
  while (true) {
    const mrStr = `MR-${String(candidate).padStart(5, '0')}`;
    const exists = await prisma.patient.findFirst({
      where: { mrNumber: mrStr },
      select: { id: true },
    });
    if (!exists) {
      // Update _AppSequence to candidate
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_AppSequence" ("name", "nextVal") VALUES ('mrNumber', ?)
           ON CONFLICT("name") DO UPDATE SET "nextVal" = ?`,
          candidate,
          candidate,
        );
      } catch {
        // ignore
      }
      return mrStr;
    }
    candidate++;
  }
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
      ) AND ("isDeleted" = 0 OR "isDeleted" IS NULL)
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
  let whereClause = '("isDeleted" = 0 OR "isDeleted" IS NULL)';
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
  const prisma = getPrisma();
  const data = mapPatientInput(input);

  // Validate primaryDoctorId exists if provided
  if (input.primaryDoctorId) {
    const doc = await prisma.user.findUnique({
      where: { id: input.primaryDoctorId },
      select: { id: true },
    });
    if (!doc) {
      delete (data as { primaryDoctor?: unknown }).primaryDoctor;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const mrNumber = await generateMrNumber();
    try {
      return await prisma.patient.create({ data: { ...data, mrNumber } });
    } catch (err: any) {
      if (err?.code === 'P2002' && attempt < 4) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "_AppSequence" SET "nextVal" = "nextVal" + 1 WHERE "name" = 'mrNumber'`,
          );
        } catch { /* ignore */ }
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to create patient: could not generate a unique MR number');
}

export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  const data = mapPatientInput(input);
  // Do not re-assign primary doctor on normal demographic edits unless explicitly sent
  if (input.primaryDoctorId === undefined) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
  } else if (!input.primaryDoctorId) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
    (data as Prisma.PatientUpdateInput).primaryDoctor = { disconnect: true };
  } else {
    // Validate doctor exists before trying to connect
    const doc = await getPrisma().user.findUnique({
      where: { id: input.primaryDoctorId },
      select: { id: true },
    });
    if (!doc) {
      delete (data as { primaryDoctor?: unknown }).primaryDoctor;
    }
  }
  return getPrisma().patient.update({ where: { id }, data });
}

export async function deletePatient(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.patient.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

export async function getPatient(id: string): Promise<Patient | null> {
  const patient = await getPrisma().patient.findUnique({
    where: { id },
  });
  if (!patient || patient.isDeleted) return null;
  return patient;
}
