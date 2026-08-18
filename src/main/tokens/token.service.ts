import type { TokenStatus } from '@prisma/client';
import { getPrisma, ensurePrescriptionPharmacyColumns } from '../database/client';
import { randomUUID } from 'node:crypto';
import { markCheckIn, markCheckOut } from '../doctors/attendance.service';
import { adjustStockByMedicineName } from '../inventory/inventory.service';
import { assertDoctorAvailableOnDate } from '../doctors/schedule.service';
import { isLicenseModuleEnabled } from '../license/license.ipc';

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

export type PharmacyStatus = 'PENDING' | 'DISPENSED';

export interface PharmacyQueueItem {
  prescriptionId: string;
  tokenId: string;
  tokenNumber: number;
  date: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  patientMrNumber: string | null;
  doctorName: string;
  diagnosis: string;
  medicines: { name: string; dosage: string; duration: string; instructions: string }[];
  tests: string[];
  advice: string;
  pharmacyStatus: PharmacyStatus;
  dispensedAt: string | null;
  invoiceId: string | null;
  appointmentCompleted: boolean;
  createdAt: string;
  updatedAt: string;
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
    pharmacyStatus: ((r.pharmacyStatus as string) || 'PENDING') as PharmacyStatus,
    dispensedAt: (r.dispensedAt as string | null | undefined) ?? null,
    invoiceId: (r.invoiceId as string | null | undefined) ?? null,
    createdAt: r.prescriptionCreatedAt ?? r.createdAt,
  };
}

function pharmacyModuleOn(): boolean {
  return isLicenseModuleEnabled('pharmacy');
}

async function applyPrescriptionStockDelta(
  medicines: { name?: string }[],
  delta: number,
  reference: string,
): Promise<void> {
  for (const med of medicines) {
    if (med.name?.trim()) {
      await adjustStockByMedicineName(med.name, delta, reference);
    }
  }
}

export async function listTokens(date: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail, pr.pharmacyStatus, pr.dispensedAt, pr.invoiceId,
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

export async function listPharmacyQueue(date: string): Promise<PharmacyQueueItem[]> {
  const db = getPrisma();
  await ensurePrescriptionPharmacyColumns(db);
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT
      pr.id AS prescriptionId,
      pr.tokenId,
      t.tokenNumber,
      t.date,
      t.patientId,
      t.doctorId,
      p.firstName || ' ' || p.lastName AS patientName,
      p.mrNumber AS patientMrNumber,
      u.firstName || ' ' || u.lastName AS doctorName,
      pr.diagnosis,
      pr.medicines,
      pr.tests,
      pr.advice,
      COALESCE(pr.pharmacyStatus, 'PENDING') AS pharmacyStatus,
      pr.dispensedAt,
      pr.invoiceId,
      pr.createdAt,
      pr.updatedAt,
      CASE WHEN EXISTS (
        SELECT 1 FROM "Appointment" a
        WHERE a.patientId = t.patientId
          AND a.providerId = t.doctorId
          AND a.status = 'COMPLETED'
          AND date(a.startsAt) = t.date
      ) THEN 1 ELSE 0 END AS appointmentCompleted
    FROM "Prescription" pr
    JOIN "Token" t ON t.id = pr.tokenId
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    WHERE t.date = ?
    ORDER BY
      appointmentCompleted DESC,
      CASE WHEN COALESCE(pr.pharmacyStatus, 'PENDING') = 'PENDING' THEN 0 ELSE 1 END ASC,
      t.tokenNumber ASC
  `, date);

  return rows.map((r) => ({
    prescriptionId: String(r.prescriptionId),
    tokenId: String(r.tokenId),
    tokenNumber: Number(r.tokenNumber),
    date: String(r.date),
    patientId: String(r.patientId),
    doctorId: String(r.doctorId),
    patientName: String(r.patientName || ''),
    patientMrNumber: (r.patientMrNumber as string | null) ?? null,
    doctorName: String(r.doctorName || ''),
    diagnosis: String(r.diagnosis || ''),
    medicines: JSON.parse(String(r.medicines || '[]')),
    tests: JSON.parse(String(r.tests || '[]')),
    advice: String(r.advice || ''),
    pharmacyStatus: ((r.pharmacyStatus as string) || 'PENDING') as PharmacyStatus,
    dispensedAt: (r.dispensedAt as string | null) ?? null,
    invoiceId: (r.invoiceId as string | null) ?? null,
    appointmentCompleted: Number(r.appointmentCompleted) === 1,
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
  }));
}

export async function listTokenDoctors() {
  return getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listTokenPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true, mrNumber: true },
    orderBy: { createdAt: 'desc' },
  });
}

function localDayBoundsFromDateStr(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw new Error('Invalid token date.');
  return {
    dayStart: new Date(y, m - 1, d, 0, 0, 0, 0),
    dayEnd: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

async function hasBookedVisitOnDate(patientId: string, doctorId: string, dateStr: string): Promise<boolean> {
  const { dayStart, dayEnd } = localDayBoundsFromDateStr(dateStr);
  const found = await getPrisma().appointment.findFirst({
    where: {
      patientId,
      providerId: doctorId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function createToken(input: TokenInput) {
  const doctor = await getPrisma().user.findFirst({
    where: { id: input.doctorId, role: 'DOCTOR' },
    select: { id: true, isActive: true },
  });
  if (!doctor) throw new Error('Doctor not found.');
  if (!doctor.isActive) throw new Error('This doctor is inactive. Activate them in Doctor Schedule first.');
  if (!(await hasBookedVisitOnDate(input.patientId, input.doctorId, input.date))) {
    await assertDoctorAvailableOnDate(input.doctorId, input.date);
  }

  const existing = await getPrisma().token.findFirst({
    where: { patientId: input.patientId, date: input.date, doctorId: input.doctorId },
    include: tokenInclude,
  });
  if (existing) {
    if (existing.status !== 'WAITING') {
      return updateTokenStatus(existing.id, 'WAITING');
    }
    return { ...existing, prescription: null };
  }
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

/** Same patient + doctor + local day — used when a visit appointment is completed. */
export async function completeWaitingTokenForVisit(
  patientId: string,
  doctorId: string,
  visitAt: Date,
): Promise<string | null> {
  const date = [
    visitAt.getFullYear(),
    String(visitAt.getMonth() + 1).padStart(2, '0'),
    String(visitAt.getDate()).padStart(2, '0'),
  ].join('-');
  const token = await getPrisma().token.findFirst({
    where: {
      patientId,
      doctorId,
      date,
      status: 'WAITING',
    },
    orderBy: { tokenNumber: 'desc' },
    select: { id: true },
  });
  if (!token) return null;
  await updateTokenStatus(token.id, 'DONE');
  return token.id;
}

export async function upsertPrescription(tokenId: string, input: PrescriptionInput) {
  const db = getPrisma();
  await ensurePrescriptionPharmacyColumns(db);
  const existing = await db.$queryRawUnsafe<{ id: string; medicines: string; pharmacyStatus?: string }[]>(
    `SELECT id, medicines, pharmacyStatus FROM "Prescription" WHERE tokenId = ? LIMIT 1`, tokenId
  );
  const now = new Date().toISOString();
  const medicines = JSON.stringify(input.medicines);
  const tests = JSON.stringify(input.tests);
  const thumbName =
    input.thumbName === undefined ? undefined : input.thumbName?.trim() || null;
  const thumbnail =
    input.thumbnail === undefined ? undefined : input.thumbnail?.trim() || null;
  const deferStock = pharmacyModuleOn();

  if (existing.length > 0) {
    const medsChanged = (existing[0].medicines || '[]') !== medicines;
    const nextStatus =
      existing[0].pharmacyStatus === 'DISPENSED' && !medsChanged ? 'DISPENSED' : 'PENDING';

    if (!deferStock) {
      try {
        const oldMeds: { name: string }[] = JSON.parse(existing[0].medicines || '[]');
        await applyPrescriptionStockDelta(oldMeds, 1, `Prescription restore:${tokenId}`);
      } catch { /* ignore parse errors from old data */ }
    }

    if (thumbName !== undefined || thumbnail !== undefined) {
      await db.$executeRawUnsafe(
        `UPDATE "Prescription" SET diagnosis=?, medicines=?, tests=?, advice=?,
          thumbName=COALESCE(?, thumbName), thumbnail=COALESCE(?, thumbnail),
          pharmacyStatus=?,
          dispensedAt=CASE WHEN ? = 'PENDING' THEN NULL ELSE dispensedAt END,
          invoiceId=CASE WHEN ? = 'PENDING' AND ? = 1 THEN NULL ELSE invoiceId END,
          updatedAt=? WHERE tokenId=?`,
        input.diagnosis,
        medicines,
        tests,
        input.advice,
        thumbName ?? null,
        thumbnail ?? null,
        nextStatus,
        nextStatus,
        nextStatus,
        medsChanged ? 1 : 0,
        now,
        tokenId,
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "Prescription" SET diagnosis=?, medicines=?, tests=?, advice=?,
          pharmacyStatus=?,
          dispensedAt=CASE WHEN ? = 'PENDING' THEN NULL ELSE dispensedAt END,
          invoiceId=CASE WHEN ? = 'PENDING' AND ? = 1 THEN NULL ELSE invoiceId END,
          updatedAt=? WHERE tokenId=?`,
        input.diagnosis,
        medicines,
        tests,
        input.advice,
        nextStatus,
        nextStatus,
        nextStatus,
        medsChanged ? 1 : 0,
        now,
        tokenId,
      );
    }

    if (!deferStock) {
      await applyPrescriptionStockDelta(input.medicines, -1, `Prescription:${tokenId}`);
    }

    return existing[0].id;
  }

  const id = randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "Prescription" (id, tokenId, diagnosis, medicines, tests, advice, thumbName, thumbnail, pharmacyStatus, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    tokenId,
    input.diagnosis,
    medicines,
    tests,
    input.advice,
    thumbName ?? null,
    thumbnail ?? null,
    'PENDING',
    now,
    now,
  );

  if (!deferStock) {
    await applyPrescriptionStockDelta(input.medicines, -1, `Prescription:${tokenId}`);
  }

  return id;
}

/** Mark Rx dispensed; when pharmacy module is on, FEFO-decrement stock once. */
export async function dispensePharmacyPrescription(
  tokenId: string,
  options?: { invoiceId?: string | null; skipStock?: boolean },
): Promise<PharmacyQueueItem | null> {
  const db = getPrisma();
  await ensurePrescriptionPharmacyColumns(db);
  const rows = await db.$queryRawUnsafe<{
    id: string;
    medicines: string;
    pharmacyStatus: string;
  }[]>(
    `SELECT id, medicines, COALESCE(pharmacyStatus, 'PENDING') AS pharmacyStatus
     FROM "Prescription" WHERE tokenId = ? LIMIT 1`,
    tokenId,
  );
  if (!rows[0]) throw new Error('Prescription not found.');

  const alreadyDispensed = rows[0].pharmacyStatus === 'DISPENSED';
  const now = new Date().toISOString();
  const invoiceId = options?.invoiceId?.trim() || null;

  await db.$executeRawUnsafe(
    `UPDATE "Prescription"
     SET pharmacyStatus = 'DISPENSED',
         dispensedAt = COALESCE(dispensedAt, ?),
         invoiceId = COALESCE(?, invoiceId),
         updatedAt = ?
     WHERE tokenId = ?`,
    now,
    invoiceId,
    now,
    tokenId,
  );

  if (!alreadyDispensed && pharmacyModuleOn() && !options?.skipStock) {
    try {
      const meds: { name: string }[] = JSON.parse(rows[0].medicines || '[]');
      await applyPrescriptionStockDelta(meds, -1, `Pharmacy dispense:${tokenId}`);
    } catch { /* ignore */ }
  }

  const token = await getTokenById(tokenId);
  if (!token) return null;
  const queue = await listPharmacyQueue(String(token.date));
  return queue.find((item) => item.tokenId === tokenId) ?? null;
}

export async function linkPrescriptionInvoice(tokenId: string, invoiceId: string): Promise<void> {
  const db = getPrisma();
  const now = new Date().toISOString();
  await db.$executeRawUnsafe(
    `UPDATE "Prescription" SET invoiceId = ?, updatedAt = ? WHERE tokenId = ?`,
    invoiceId,
    now,
    tokenId,
  );
}

export async function getTokenForPatient(patientId: string, date: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail, pr.pharmacyStatus, pr.dispensedAt, pr.invoiceId,
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
           pr.thumbName, pr.thumbnail, pr.pharmacyStatus, pr.dispensedAt, pr.invoiceId,
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
