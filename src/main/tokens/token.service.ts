import type { TokenStatus } from '@prisma/client';
import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';
import { markCheckIn, markCheckOut } from '../doctors/attendance.service';
import { adjustStockByMedicineName } from '../inventory/inventory.service';
import { assertDoctorAvailableOnDate } from '../doctors/schedule.service';

export interface TokenInput {
  patientId: string;
  doctorId: string;
  date: string;
  notes?: string | null;
  reason?: string | null;
}

export interface PrescriptionInput {
  diagnosis: string;
  medicines: { name: string; dosage: string; duration: string; instructions: string }[];
  tests: string[];
  advice: string;
  thumbName?: string | null;
  thumbnail?: string | null;
}

export interface PrescriptionFeedItem {
  id: string;
  tokenId: string;
  tokenNumber: number;
  patientName: string;
  doctorName: string;
  createdAt: string;
}

const tokenInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, mrNumber: true } },
  doctor:  { select: { id: true, firstName: true, lastName: true } },
};

function mapPrescription(tokenId: unknown, r: Record<string, unknown>) {
  return {
    id: r.prescriptionId ?? r.id,
    tokenId,
    diagnosis: r.diagnosis,
    medicines: JSON.parse((r.medicines as string) || '[]'),
    tests: JSON.parse((r.tests as string) || '[]'),
    advice: r.advice,
    thumbName: (r.thumbName as string | null | undefined) ?? null,
    thumbnail: (r.thumbnail as string | null | undefined) ?? null,
    createdAt: r.prescriptionCreatedAt ?? r.createdAt,
  };
}

function parseRawToken(_row: Record<string, unknown>) { return _row; } 

export async function listTokens(date: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail,
           pr.createdAt as prescriptionCreatedAt,
           CASE WHEN pr.id IS NOT NULL THEN 1 ELSE 0 END as prescriptionRaw
    FROM "Token" t
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    LEFT JOIN "Prescription" pr ON pr.tokenId = t.id
    WHERE t.date = ?
    ORDER BY t.tokenNumber ASC
  `, date);
  return rows.map((r) => ({
    id: r.id, tokenNumber: r.tokenNumber, date: r.date,
    patientId: r.patientId, doctorId: r.doctorId,
    status: r.status, notes: r.notes, reason: r.reason, createdAt: r.createdAt, updatedAt: r.updatedAt,
    patient: { id: r.patientObjId, firstName: r.patientFirstName, lastName: r.patientLastName, mrNumber: r.patientMrNumber },
    doctor:  { id: r.doctorObjId,  firstName: r.doctorFirstName,  lastName: r.doctorLastName },
    prescription: r.prescriptionRaw ? mapPrescription(r.id, r) : null,
  }));
}

export async function listPrescriptionFeed(date: string): Promise<PrescriptionFeedItem[]> {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<PrescriptionFeedItem[]>(`
    SELECT pr.id, pr.tokenId, t.tokenNumber,
           p.firstName || ' ' || p.lastName AS patientName,
           u.firstName || ' ' || u.lastName AS doctorName,
           pr.createdAt
    FROM "Prescription" pr
    JOIN "Token" t ON t.id = pr.tokenId
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    WHERE t.date = ?
    ORDER BY pr.createdAt DESC
  `, date);
  return rows;
}

export async function listTokenDoctors() {
  return getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' }, // Latest added doctors top par
  });
}

export async function listTokenPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true, mrNumber: true },
    orderBy: { createdAt: 'desc' }, // Naye patients dropdown mein pehle aayenge
  });
}

export async function createToken(input: TokenInput) {
  const doctor = await getPrisma().user.findFirst({
    where: { id: input.doctorId, role: 'DOCTOR' },
    select: { id: true, isActive: true },
  });
  if (!doctor) throw new Error('Doctor not found.');
  if (!doctor.isActive) throw new Error('This doctor is inactive. Activate them in Doctor Schedule first.');
  await assertDoctorAvailableOnDate(input.doctorId, input.date);

  const existing = await getPrisma().token.findFirst({
    where: { patientId: input.patientId, date: input.date },
    include: tokenInclude,
  });
  if (existing) return { ...existing, prescription: null };
  const last = await getPrisma().token.findFirst({
    where: { date: input.date, doctorId: input.doctorId },
    orderBy: { tokenNumber: 'desc' },
    select: { tokenNumber: true },
  });
  const tokenNumber = (last?.tokenNumber ?? 0) + 1;
  const token = await getPrisma().token.create({
    data: {
      tokenNumber,
      date: input.date,
      patientId: input.patientId,
      doctorId: input.doctorId,
      notes: input.notes?.trim() ?? null,
      reason: input.reason?.trim() ?? null,
    },
    include: tokenInclude,
  });
  return { ...token, prescription: null };
}

export async function updateTokenStatus(id: string, status: TokenStatus) {
  const token = await getPrisma().token.update({
    where: { id },
    data: { status },
    include: tokenInclude,
  });

  if (status === 'DONE') {
    const existing = await getPrisma().doctorAttendance.findUnique({
      where: { doctorId_date: { doctorId: token.doctor.id, date: token.date } },
    });
    if (!existing) await markCheckIn(token.doctor.id, token.date);
  }
  if (status === 'DONE' || status === 'SKIPPED') {
    const remaining = await getPrisma().token.count({
      where: { doctorId: token.doctor.id, date: token.date, status: { in: ['WAITING'] } },
    });
    if (remaining === 0) await markCheckOut(token.doctor.id, token.date);
  }
  const pr = await getPrisma().$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Prescription" WHERE tokenId = ? LIMIT 1`, id
  );
  return {
    ...token,
    prescription: pr[0] ? mapPrescription(id, pr[0]) : null,
  };
}

export async function upsertPrescription(tokenId: string, input: PrescriptionInput) {
  const db = getPrisma();
  const existing = await db.$queryRawUnsafe<{ id: string; medicines: string }[]>(
    `SELECT id, medicines FROM "Prescription" WHERE tokenId = ? LIMIT 1`, tokenId
  );
  const now = new Date().toISOString();
  const medicines = JSON.stringify(input.medicines);
  const tests = JSON.stringify(input.tests);
  const thumbName =
    input.thumbName === undefined ? undefined : input.thumbName?.trim() || null;
  const thumbnail =
    input.thumbnail === undefined ? undefined : input.thumbnail?.trim() || null;

  if (existing.length > 0) {
    // Restore stock for old medicines before applying new ones
    try {
      const oldMeds: { name: string }[] = JSON.parse(existing[0].medicines || '[]');
      for (const med of oldMeds) {
        if (med.name?.trim()) {
          await adjustStockByMedicineName(med.name, 1, `Prescription restore:${tokenId}`);
        }
      }
    } catch { /* ignore parse errors from old data */ }

    if (thumbName !== undefined || thumbnail !== undefined) {
      await db.$executeRawUnsafe(
        `UPDATE "Prescription" SET diagnosis=?, medicines=?, tests=?, advice=?,
          thumbName=COALESCE(?, thumbName), thumbnail=COALESCE(?, thumbnail), updatedAt=? WHERE tokenId=?`,
        input.diagnosis,
        medicines,
        tests,
        input.advice,
        thumbName ?? null,
        thumbnail ?? null,
        now,
        tokenId,
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "Prescription" SET diagnosis=?, medicines=?, tests=?, advice=?, updatedAt=? WHERE tokenId=?`,
        input.diagnosis, medicines, tests, input.advice, now, tokenId
      );
    }

    // Deduct stock for new medicines (FEFO via inventory batches)
    for (const med of input.medicines) {
      if (med.name?.trim()) {
        await adjustStockByMedicineName(med.name, -1, `Prescription:${tokenId}`);
      }
    }

    return existing[0].id;
  } else {
    const id = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO "Prescription" (id, tokenId, diagnosis, medicines, tests, advice, thumbName, thumbnail, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id,
      tokenId,
      input.diagnosis,
      medicines,
      tests,
      input.advice,
      thumbName ?? null,
      thumbnail ?? null,
      now,
      now,
    );

    // Deduct stock for prescribed medicines (FEFO via inventory batches)
    for (const med of input.medicines) {
      if (med.name?.trim()) {
        await adjustStockByMedicineName(med.name, -1, `Prescription:${tokenId}`);
      }
    }

    return id;
  }
}

export async function getTokenForPatient(patientId: string, date: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail,
           pr.createdAt as prescriptionCreatedAt,
           CASE WHEN pr.id IS NOT NULL THEN 1 ELSE 0 END as prescriptionRaw
    FROM "Token" t
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    LEFT JOIN "Prescription" pr ON pr.tokenId = t.id
    WHERE t.patientId = ? AND t.date = ?
    LIMIT 1
  `, patientId, date);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id, tokenNumber: r.tokenNumber, date: r.date,
    patientId: r.patientId, doctorId: r.doctorId,
    status: r.status, notes: r.notes, reason: r.reason, createdAt: r.createdAt, updatedAt: r.updatedAt,
    patient: { id: r.patientObjId, firstName: r.patientFirstName, lastName: r.patientLastName, mrNumber: r.patientMrNumber },
    doctor:  { id: r.doctorObjId,  firstName: r.doctorFirstName,  lastName: r.doctorLastName },
    prescription: r.prescriptionRaw ? mapPrescription(r.id, r) : null,
  };
}

export async function getTokenById(tokenId: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail,
           pr.createdAt as prescriptionCreatedAt,
           CASE WHEN pr.id IS NOT NULL THEN 1 ELSE 0 END as prescriptionRaw
    FROM "Token" t
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    LEFT JOIN "Prescription" pr ON pr.tokenId = t.id
    WHERE t.id = ?
    LIMIT 1
  `, tokenId);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id, tokenNumber: r.tokenNumber, date: r.date,
    patientId: r.patientId, doctorId: r.doctorId,
    status: r.status, notes: r.notes, reason: r.reason, createdAt: r.createdAt, updatedAt: r.updatedAt,
    patient: { id: r.patientObjId, firstName: r.patientFirstName, lastName: r.patientLastName, mrNumber: r.patientMrNumber },
    doctor:  { id: r.doctorObjId,  firstName: r.doctorFirstName,  lastName: r.doctorLastName },
    prescription: r.prescriptionRaw ? mapPrescription(r.id, r) : null,
  };
}

export async function deleteToken(id: string) {
  const db = getPrisma();
  const token = await db.token.findUnique({ where: { id }, select: { patientId: true, doctorId: true, date: true } });
  if (token) {
    const dayStart = new Date(`${token.date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${token.date}T23:59:59.999Z`);
    await db.appointment.deleteMany({
      where: { patientId: token.patientId, providerId: token.doctorId, startsAt: { gte: dayStart, lte: dayEnd } },
    });
  }
  return db.token.delete({ where: { id } });
}