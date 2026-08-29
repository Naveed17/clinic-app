import type { TokenStatus, Prisma } from '@prisma/client';
import { getPrisma, ensurePrescriptionPharmacyColumns } from '../database/client';
import { randomUUID } from 'node:crypto';
import { markCheckIn, markCheckOut } from '../doctors/attendance.service';
import { assertDoctorAvailableOnDate } from '../doctors/schedule.service';
import {
  clampFeeDiscount,
  mapTokenFee,
  tokenNetFee,
  weekVisitFromDate,
} from '../../shared/tokenFee';
import { dateOfBirthToAge } from '../../shared/patientAge';

export interface TokenInput {
  patientId: string;
  doctorId: string;
  date: string;
  notes?: string | null;
  reason?: string | null;
  consultationFee?: number;
  feeDiscount?: number;
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

async function resolveConsultationFee(doctorId: string, override?: number): Promise<number> {
  if (override !== undefined && override !== null && String(override) !== '') {
    return mapTokenFee(override);
  }
  const profile = await getPrisma().doctorProfile.findUnique({
    where: { userId: doctorId },
    select: { consultationFee: true },
  });
  return mapTokenFee(profile?.consultationFee);
}

const tokenInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, mrNumber: true, gender: true, dateOfBirth: true } },
  doctor:  { select: { id: true, firstName: true, lastName: true } },
} as unknown as Prisma.TokenInclude;

function mapPatientPerson(p: { id: string; firstName: string; lastName: string; mrNumber?: string | null; gender?: string | null; dateOfBirth?: Date | null; phone?: string | null }) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    mrNumber: p.mrNumber ?? undefined,
    gender: p.gender ?? null,
    phone: p.phone ?? null,
    age: dateOfBirthToAge(p.dateOfBirth),
  };
}

function mapTokenRecord(token: {
  id: string;
  tokenNumber: number;
  date: string;
  patientId: string;
  doctorId: string;
  status: TokenStatus;
  notes: string | null;
  reason: string | null;
  consultationFee: unknown;
  feeDiscount?: unknown;
  feeRefunded?: unknown;
  createdAt: Date;
  updatedAt: Date;
  patient: Parameters<typeof mapPatientPerson>[0];
  doctor: { id: string; firstName: string; lastName: string };
  prescription?: unknown;
}) {
  return {
    ...token,
    consultationFee: mapTokenFee(token.consultationFee),
    feeDiscount: mapTokenFee(token.feeDiscount),
    feeRefunded: mapTokenFee(token.feeRefunded),
    patient: mapPatientPerson(token.patient),
    prescription: token.prescription ?? null,
  };
}

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

function mapJoinToken(r: Record<string, unknown>) {
  return {
    id: r.id, tokenNumber: r.tokenNumber, date: r.date,
    patientId: r.patientId, doctorId: r.doctorId,
    status: r.status, notes: r.notes, reason: r.reason,
    consultationFee: mapTokenFee(r.consultationFee),
    feeDiscount: mapTokenFee(r.feeDiscount),
    feeRefunded: mapTokenFee(r.feeRefunded),
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    patient: mapPatientPerson({
      id: r.patientObjId as string,
      firstName: r.patientFirstName as string,
      lastName: r.patientLastName as string,
      mrNumber: r.patientMrNumber as string | null,
      gender: r.patientGender as string | null,
      dateOfBirth: r.patientDob ? new Date(r.patientDob as string) : null,
    }),
    doctor:  { id: r.doctorObjId,  firstName: r.doctorFirstName,  lastName: r.doctorLastName },
    prescription: r.prescriptionRaw ? mapPrescription(r.id, r) : null,
  };
}

export async function listTokens(date: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber, p.gender as patientGender, p.dateOfBirth as patientDob,
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
  return rows.map(mapJoinToken);
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
  const doctors = await getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      doctorProfile: { select: { consultationFee: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return doctors.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    avatar: d.avatar || d.doctorProfile?.avatar || null,
    consultationFee: mapTokenFee(d.doctorProfile?.consultationFee),
  }));
}

export async function listTokenPatients(search?: string) {
  const query = search?.trim();
  const where: Prisma.PatientWhereInput = query
    ? {
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { phone: { contains: query } },
          { mrNumber: { contains: query } },
        ],
      }
    : {};
  const rows = await getPrisma().patient.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, mrNumber: true, gender: true, dateOfBirth: true, phone: true },
    orderBy: { createdAt: 'desc' },
    take: query ? 50 : 100,
  } as unknown as Prisma.PatientFindManyArgs);
  return rows.map((row) => mapPatientPerson(row as Parameters<typeof mapPatientPerson>[0]));
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
    try {
      await assertDoctorAvailableOnDate(input.doctorId, input.date);
    } catch {
      /* Walk-in token: allow token generation even if weekly schedule day template is unconfigured */
    }
  }

  const consultationFee = await resolveConsultationFee(input.doctorId, input.consultationFee);
  const feeDiscount = clampFeeDiscount(input.feeDiscount, consultationFee);

  const existing = await getPrisma().token.findFirst({
    where: { patientId: input.patientId, date: input.date, doctorId: input.doctorId },
    include: tokenInclude,
  });
  if (existing) {
    if (existing.status !== 'WAITING') {
      return updateTokenStatus(existing.id, 'WAITING');
    }
    const updated = await getPrisma().token.update({
      where: { id: existing.id },
      data: { consultationFee },
      include: tokenInclude,
    });
    await getPrisma().$executeRawUnsafe(
      `UPDATE "Token" SET feeDiscount = ?, updatedAt = ? WHERE id = ?`,
      feeDiscount,
      new Date().toISOString(),
      existing.id,
    );
    return mapTokenRecord({
      ...updated,
      patient: updated.patient as Parameters<typeof mapPatientPerson>[0],
      feeDiscount,
      feeRefunded: (updated as { feeRefunded?: unknown }).feeRefunded,
      prescription: null,
    });
  }

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const nextRes = await getPrisma().$queryRawUnsafe<{ nextNum: number }[]>(
        `SELECT COALESCE(MAX("tokenNumber"), 0) + 1 AS nextNum FROM "Token" WHERE "date" = ? AND "doctorId" = ?`,
        input.date,
        input.doctorId,
      );
      const tokenNumber = Number(nextRes[0]?.nextNum ?? 1);

      const token = await getPrisma().token.create({
        data: {
          tokenNumber,
          date: input.date,
          patientId: input.patientId,
          doctorId: input.doctorId,
          notes: input.notes?.trim() ?? null,
          reason: input.reason?.trim() ?? null,
          consultationFee,
        },
        include: tokenInclude,
      });
      await getPrisma().$executeRawUnsafe(
        `UPDATE "Token" SET feeDiscount = ? WHERE id = ?`,
        feeDiscount,
        token.id,
      );
      const derivedFeeType = consultationFee === 0 ? 'FREE' : feeDiscount > 0 ? 'HALF' : 'PAID';
      await getPrisma().$executeRawUnsafe(
        `UPDATE "Appointment" SET "feeType" = ? WHERE "patientId" = ? AND "providerId" = ? AND "startsAt" LIKE ?`,
        derivedFeeType,
        input.patientId,
        input.doctorId,
        `${input.date}%`,
      );
      return mapTokenRecord({
        ...token,
        patient: token.patient as Parameters<typeof mapPatientPerson>[0],
        feeDiscount,
        feeRefunded: (token as { feeRefunded?: unknown }).feeRefunded,
        prescription: null,
      });
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      if (errorObj?.code === 'P2002' && attempts < 5) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not allocate a unique token number. Please try again.');
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
    consultationFee: mapTokenFee((token as { consultationFee?: unknown }).consultationFee),
    feeDiscount: mapTokenFee((token as { feeDiscount?: unknown }).feeDiscount),
    feeRefunded: mapTokenFee((token as { feeRefunded?: unknown }).feeRefunded),
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

  if (existing.length > 0) {
    const medsChanged = (existing[0].medicines || '[]') !== medicines;
    const nextStatus =
      existing[0].pharmacyStatus === 'DISPENSED' && !medsChanged ? 'DISPENSED' : 'PENDING';

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

export async function getTokenForPatient(patientId: string, date: string, doctorId?: string) {
  const db = getPrisma();
  const doctorFilter = doctorId ? 'AND t.doctorId = ?' : '';
  const params = doctorId ? [patientId, date, doctorId] : [patientId, date];
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber, p.gender as patientGender, p.dateOfBirth as patientDob,
           u.id as doctorObjId, u.firstName as doctorFirstName, u.lastName as doctorLastName,
           pr.id as prescriptionId, pr.diagnosis, pr.medicines, pr.tests, pr.advice,
           pr.thumbName, pr.thumbnail, pr.pharmacyStatus, pr.dispensedAt, pr.invoiceId,
           pr.createdAt as prescriptionCreatedAt,
           CASE WHEN pr.id IS NOT NULL THEN 1 ELSE 0 END as prescriptionRaw
    FROM "Token" t
    JOIN "Patient" p ON p.id = t.patientId
    JOIN "User" u ON u.id = t.doctorId
    LEFT JOIN "Prescription" pr ON pr.tokenId = t.id
    WHERE t.patientId = ? AND t.date = ? ${doctorFilter}
    ORDER BY t.tokenNumber DESC
    LIMIT 1
  `, ...params);
  if (!rows[0]) return null;
  return mapJoinToken(rows[0]);
}

export async function getTokenById(tokenId: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT t.*, p.id as patientObjId, p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber, p.gender as patientGender, p.dateOfBirth as patientDob,
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
  return mapJoinToken(rows[0]);
}

export async function countPriorVisitsThisWeek(
  patientId: string,
  doctorId: string,
  date: string,
): Promise<{ count: number }> {
  if (!patientId || !doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { count: 0 };
  const from = weekVisitFromDate(date);
  const count = await getPrisma().token.count({
    where: {
      patientId,
      doctorId,
      date: { gte: from, lt: date },
      status: { not: 'SKIPPED' },
    },
  });
  return { count };
}

export async function refundTokenFee(id: string, amount?: number) {
  const token = await getTokenById(id);
  if (!token) throw new Error('Token not found.');
  const remaining = tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded);
  if (remaining <= 0) throw new Error('No consultation fee left to refund.');
  const refund =
    amount === undefined || amount === null || Number.isNaN(Number(amount))
      ? remaining
      : mapTokenFee(amount);
  if (!Number.isFinite(refund) || refund <= 0) throw new Error('Refund amount must be greater than 0.');
  if (refund > remaining) throw new Error('Refund cannot exceed the collected consultation fee.');
  const already = mapTokenFee(token.feeRefunded);
  const db = getPrisma();
  await db.$executeRawUnsafe(
    `UPDATE "Token" SET feeRefunded = ?, updatedAt = ? WHERE id = ?`,
    mapTokenFee(already + refund),
    new Date().toISOString(),
    id,
  );
  return getTokenById(id);
}

export async function deleteToken(id: string) {
  const db = getPrisma();
  const token = await db.token.findUnique({ where: { id }, select: { patientId: true, doctorId: true, date: true } });
  if (!token) return { ok: true };
  const dayStart = new Date(`${token.date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${token.date}T23:59:59.999Z`);
  await db.appointment.deleteMany({
    where: { patientId: token.patientId, providerId: token.doctorId, startsAt: { gte: dayStart, lte: dayEnd } },
  });
  await db.$executeRawUnsafe(`DELETE FROM "Prescription" WHERE tokenId = ?`, id);
  await db.$executeRawUnsafe(`UPDATE "LabOrder" SET tokenId = NULL WHERE tokenId = ?`, id);
  await db.token.delete({ where: { id } });
  return { ok: true };
}
