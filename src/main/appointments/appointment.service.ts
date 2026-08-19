import type { AppointmentStatus } from '@prisma/client';
import { getPrisma } from '../database/client';
import { assertDoctorAvailable, assertDoctorAvailableOnDate, getDoctorSchedule } from '../doctors/schedule.service';
import { completeWaitingTokenForVisit } from '../tokens/token.service';

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  notes?: string | null;
  recurrenceRule?: string | null;
  tokenId?: string | null;
}

function parseDate(value: unknown, name: string): Date {
  if (value === undefined || value === null) throw new Error(`${name} is required`);
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`${name} is not a valid date: ${value}`);
  return d;
}

function toData(input: AppointmentInput) {
  return {
    patientId: input.patientId,
    providerId: input.providerId,
    startsAt: parseDate(input.startsAt, 'startsAt'),
    endsAt: parseDate(input.endsAt, 'endsAt'),
    reason: input.reason?.trim() ?? null,
    notes: input.notes?.trim() ?? null,
    recurrenceRule: input.recurrenceRule ?? null,
  };
}

async function assertProviderActive(providerId: string): Promise<void> {
  const doctor = await getPrisma().user.findFirst({
    where: { id: providerId, role: 'DOCTOR' },
    select: { id: true, isActive: true },
  });
  if (!doctor) throw new Error('Doctor not found.');
  if (!doctor.isActive) throw new Error('This doctor is inactive. Activate them in Doctor Schedule first.');
}

export async function listAppointments() {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT a.id, a.patientId, a.providerId, a.startsAt, a.endsAt, a.status,
      a.reason, a.notes, a.recurrenceRule, a.parentId,
      pat.id as patId, pat.firstName as patFirst, pat.lastName as patLast, pat.phone as patPhone,
      prov.id as provId, prov.firstName as provFirst, prov.lastName as provLast, prov.role as provRole,
      dp.avatar as provAvatar,
      (
        SELECT t.tokenNumber FROM "Token" t
        WHERE t.patientId = a.patientId AND t.doctorId = a.providerId
          AND t.date = strftime('%Y-%m-%d', a.startsAt)
        ORDER BY t.tokenNumber DESC LIMIT 1
      ) as tokenNumber
    FROM "Appointment" a
    JOIN "Patient" pat ON pat.id = a.patientId
    JOIN "User" prov ON prov.id = a.providerId
    LEFT JOIN "DoctorProfile" dp ON dp.userId = prov.id
    ORDER BY a.createdAt DESC
  `);
  return rows.map((r) => ({
    id: r.id, patientId: r.patientId, providerId: r.providerId,
    startsAt: r.startsAt, endsAt: r.endsAt, status: r.status,
    reason: r.reason, notes: r.notes, recurrenceRule: r.recurrenceRule, parentId: r.parentId,
    tokenNumber: r.tokenNumber != null ? Number(r.tokenNumber) : null,
    patient: { id: r.patId, firstName: r.patFirst, lastName: r.patLast, role: '', phone: r.patPhone ?? null },
    provider: { id: r.provId, firstName: r.provFirst, lastName: r.provLast, role: r.provRole, avatar: r.provAvatar ?? null },
  }));
}

export async function listAppointmentPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listDoctors() {
  const rows = await getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true, doctorProfile: { select: { avatar: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    avatar: d.doctorProfile?.avatar ?? null,
  }));
}

async function getAppointmentById(id: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT a.id, a.patientId, a.providerId, a.startsAt, a.endsAt, a.status,
      a.reason, a.notes, a.recurrenceRule, a.parentId,
      pat.id as patId, pat.firstName as patFirst, pat.lastName as patLast, pat.phone as patPhone,
      prov.id as provId, prov.firstName as provFirst, prov.lastName as provLast, prov.role as provRole,
      dp.avatar as provAvatar,
      (
        SELECT t.tokenNumber FROM "Token" t
        WHERE t.patientId = a.patientId AND t.doctorId = a.providerId
          AND t.date = strftime('%Y-%m-%d', a.startsAt)
        ORDER BY t.tokenNumber DESC LIMIT 1
      ) as tokenNumber
    FROM "Appointment" a
    JOIN "Patient" pat ON pat.id = a.patientId
    JOIN "User" prov ON prov.id = a.providerId
    LEFT JOIN "DoctorProfile" dp ON dp.userId = prov.id
    WHERE a.id = ?
    LIMIT 1
  `, id);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, patientId: r.patientId, providerId: r.providerId,
    startsAt: r.startsAt, endsAt: r.endsAt, status: r.status,
    reason: r.reason, notes: r.notes, recurrenceRule: r.recurrenceRule, parentId: r.parentId,
    tokenNumber: r.tokenNumber != null ? Number(r.tokenNumber) : null,
    patient: { id: r.patId, firstName: r.patFirst, lastName: r.patLast, role: '', phone: r.patPhone ?? null },
    provider: { id: r.provId, firstName: r.provFirst, lastName: r.provLast, role: r.provRole, avatar: r.provAvatar ?? null },
  };
}

const SLOT_STEP_MS = 30 * 60 * 1000;

/** Machine-local calendar day containing `date` (not UTC — avoids midnight PKT duplicates). */
function localDayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { dayStart, dayEnd };
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

async function findClash(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  return getPrisma().appointment.findFirst({
    where: {
      providerId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, startsAt: true, endsAt: true },
    orderBy: { endsAt: 'asc' },
  });
}

async function assertSlotFree(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<void> {
  const clash = await findClash(providerId, startsAt, endsAt, excludeId);
  if (clash) {
    throw new Error('This time slot is busy. The next free slot is 30 minutes later or after the current visit ends.');
  }
}

/** Walk-in / token: if this start is taken, jump +30 min or to the overlapping visit end. */
async function resolveFreeSlot(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<{ startsAt: Date; endsAt: Date }> {
  const durationMs = Math.max(endsAt.getTime() - startsAt.getTime(), 15 * 60 * 1000);
  const { dayEnd } = localDayBounds(startsAt);
  let windowStart = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate(), 0, 0, 0, 0);
  let windowEnd = dayEnd;

  const y = startsAt.getFullYear();
  const m = String(startsAt.getMonth() + 1).padStart(2, '0');
  const d = String(startsAt.getDate()).padStart(2, '0');
  await assertDoctorAvailableOnDate(providerId, `${y}-${m}-${d}`);
  const slots = await getDoctorSchedule(providerId);
  const slot = slots.find((s) => s.dayOfWeek === startsAt.getDay());
  if (slot?.isActive) {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    windowStart = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate(), sh, sm, 0, 0);
    windowEnd = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate(), eh, em, 0, 0);
  }

  let cursor = startsAt.getTime() > windowStart.getTime() ? new Date(startsAt.getTime()) : windowStart;

  for (let i = 0; i < 48; i++) {
    const candidateEnd = new Date(cursor.getTime() + durationMs);
    if (candidateEnd.getTime() > windowEnd.getTime()) {
      throw new Error('No free slot left in doctor hours today. Pick another time or doctor.');
    }
    const clash = await findClash(providerId, cursor, candidateEnd, excludeId);
    if (!clash) return { startsAt: cursor, endsAt: candidateEnd };
    const afterHit = asDate(clash.endsAt).getTime();
    const plusStep = cursor.getTime() + SLOT_STEP_MS;
    cursor = new Date(Math.max(afterHit, plusStep));
  }
  throw new Error('This time slot is busy. No free slot found today.');
}

export async function createAppointment(input: AppointmentInput) {
  await assertProviderActive(input.providerId);
  const startsAt = parseDate(input.startsAt, 'startsAt');
  const endsAt = parseDate(input.endsAt, 'endsAt');
  await assertDoctorAvailable(input.providerId, startsAt, endsAt);
  await assertSlotFree(input.providerId, startsAt, endsAt);

  if (input.recurrenceRule) {
    const [freq, countStr] = input.recurrenceRule.split(':');
    const count = parseInt(countStr ?? '1', 10);
    if (freq === 'WEEKLY' && count > 1) {
      const durationMs = endsAt.getTime() - startsAt.getTime();
      for (let i = 1; i < count; i++) {
        const occStart = new Date(startsAt.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const occEnd = new Date(occStart.getTime() + durationMs);
        await assertDoctorAvailable(input.providerId, occStart, occEnd);
        await assertSlotFree(input.providerId, occStart, occEnd);
      }
    }
  }

  const first = await getPrisma().appointment.create({ data: toData(input) });

  if (input.recurrenceRule) {
    const [freq, countStr] = input.recurrenceRule.split(':');
    const count = parseInt(countStr ?? '1', 10);
    if (freq === 'WEEKLY' && count > 1) {
      const durationMs = endsAt.getTime() - startsAt.getTime();
      for (let i = 1; i < count; i++) {
        const occStartsAt = new Date(startsAt.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        await getPrisma().appointment.create({
          data: {
            ...toData({
              ...input,
              startsAt: occStartsAt.toISOString(),
              endsAt: new Date(occStartsAt.getTime() + durationMs).toISOString(),
            }),
            parentId: first.id,
            recurrenceRule: null,
          },
        });
      }
    }
  }

  return getAppointmentById(first.id);
}

/**
 * Token / walk-in: same patient + doctor + day → update existing appointment
 * instead of inserting a duplicate card (same token #).
 * New walk-ins auto-shift to the next free 30-min slot (or after the overlapping visit).
 */
export async function ensureSameDayAppointment(input: AppointmentInput) {
  await assertProviderActive(input.providerId);
  const startsAt = parseDate(input.startsAt, 'startsAt');
  const endsAt = parseDate(input.endsAt, 'endsAt');

  const { dayStart, dayEnd } = localDayBounds(startsAt);

  const existing = await getPrisma().appointment.findMany({
    where: {
      patientId: input.patientId,
      providerId: input.providerId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    orderBy: { startsAt: 'desc' },
  });

  const open = existing.find((a) => a.status === 'SCHEDULED' || a.status === 'CHECKED_IN');
  const target = open ?? existing[0];

  if (target) {
    const nextStatus: AppointmentStatus =
      target.status === 'COMPLETED' ? 'SCHEDULED' : (target.status as AppointmentStatus);
    await getPrisma().appointment.update({
      where: { id: target.id },
      data: {
        startsAt,
        endsAt,
        reason: input.reason?.trim() ?? target.reason,
        notes: input.notes?.trim() ?? target.notes,
        status: nextStatus,
      },
    });
    // One visit card per patient+doctor+day — cancel leftover duplicates (e.g. UTC-bound bug).
    const extras = existing.filter((a) => a.id !== target.id);
    if (extras.length > 0) {
      await getPrisma().appointment.updateMany({
        where: { id: { in: extras.map((a) => a.id) } },
        data: { status: 'CANCELLED' },
      });
    }
    return getAppointmentById(target.id);
  }

  const resolved = await resolveFreeSlot(input.providerId, startsAt, endsAt);
  return createAppointment({
    ...input,
    startsAt: resolved.startsAt.toISOString(),
    endsAt: resolved.endsAt.toISOString(),
    recurrenceRule: null,
  });
}

export async function updateAppointment(id: string, input: AppointmentInput) {
  await assertProviderActive(input.providerId);
  const startsAt = parseDate(input.startsAt, 'startsAt');
  const endsAt = parseDate(input.endsAt, 'endsAt');
  await assertDoctorAvailable(input.providerId, startsAt, endsAt);
  await assertSlotFree(input.providerId, startsAt, endsAt, id);
  await getPrisma().appointment.update({ where: { id }, data: toData(input) });
  return getAppointmentById(id);
}

export async function cancelAppointment(id: string) {
  await getPrisma().appointment.update({ where: { id }, data: { status: 'CANCELLED' satisfies AppointmentStatus } });
  return getAppointmentById(id);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  await getPrisma().appointment.update({ where: { id }, data: { status } });
  const appointment = await getAppointmentById(id);
  if (status === 'COMPLETED' && appointment) {
    const visitAt = appointment.startsAt instanceof Date
      ? appointment.startsAt
      : new Date(String(appointment.startsAt));
    if (!Number.isNaN(visitAt.getTime())) {
      await completeWaitingTokenForVisit(
        String(appointment.patientId),
        String(appointment.providerId),
        visitAt,
      );
    }
  }
  return appointment;
}

export async function deleteAppointment(id: string) {
  return getPrisma().appointment.delete({ where: { id } });
}