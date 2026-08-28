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

export async function listAppointments(date?: string) {
  const db = getPrisma();
  let whereClause = {};
  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    whereClause = {
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };
  }

  const appointments = await db.appointment.findMany({
    where: whereClause,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      provider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
          doctorProfile: { select: { avatar: true } },
        },
      },
    },
    orderBy: [
      { startsAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: date ? undefined : 200,
  });

  const tokens = await db.token.findMany({
    where: date ? { date } : undefined,
    select: { id: true, tokenNumber: true, patientId: true, doctorId: true, date: true },
  });

  const tokenMap = new Map<string, { id: string; tokenNumber: number }>();
  for (const t of tokens) {
    tokenMap.set(`${t.patientId}_${t.doctorId}_${t.date}`, { id: t.id, tokenNumber: t.tokenNumber });
  }

  return appointments.map((a) => {
    const dateStr = a.startsAt.toISOString().slice(0, 10);
    const token = tokenMap.get(`${a.patientId}_${a.providerId}_${dateStr}`);
    return {
      id: a.id,
      patientId: a.patientId,
      providerId: a.providerId,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status,
      reason: a.reason,
      notes: a.notes,
      recurrenceRule: a.recurrenceRule,
      parentId: a.parentId,
      tokenId: token?.id ?? null,
      tokenNumber: token?.tokenNumber ?? null,
      patient: {
        id: a.patient.id,
        firstName: a.patient.firstName,
        lastName: a.patient.lastName,
        role: 'patient',
        phone: a.patient.phone ?? null,
      },
      provider: {
        id: a.provider.id,
        firstName: a.provider.firstName,
        lastName: a.provider.lastName,
        role: String(a.provider.role),
        avatar: a.provider.avatar || a.provider.doctorProfile?.avatar || null,
      },
    };
  });
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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      doctorProfile: { select: { avatar: true, consultationFee: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    avatar: d.avatar || d.doctorProfile?.avatar || null,
    consultationFee: Number(d.doctorProfile?.consultationFee ?? 0),
  }));
}

async function getAppointmentById(id: string) {
  const db = getPrisma();
  const a = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      provider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
          doctorProfile: { select: { avatar: true } },
        },
      },
    },
  });
  if (!a) return null;

  const dateStr = a.startsAt.toISOString().slice(0, 10);
  const token = await db.token.findFirst({
    where: { patientId: a.patientId, doctorId: a.providerId, date: dateStr },
    orderBy: { tokenNumber: 'desc' },
  });

  return {
    id: a.id,
    patientId: a.patientId,
    providerId: a.providerId,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    reason: a.reason,
    notes: a.notes,
    recurrenceRule: a.recurrenceRule,
    parentId: a.parentId,
    tokenId: token?.id ?? null,
    tokenNumber: token?.tokenNumber ?? null,
    patient: {
      id: a.patient.id,
      firstName: a.patient.firstName,
      lastName: a.patient.lastName,
      role: 'patient',
      phone: a.patient.phone ?? null,
    },
    provider: {
      id: a.provider.id,
      firstName: a.provider.firstName,
      lastName: a.provider.lastName,
      role: String(a.provider.role),
      avatar: a.provider.avatar || a.provider.doctorProfile?.avatar || null,
    },
  };
}

export async function getAppointment(id: string) {
  return getAppointmentById(id);
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

/**
 * Walk-in / token: prefer the next free 30-min slot inside doctor hours.
 * If the day is packed or hours have ended, keep the requested time so the queue
 * still works (overbook / after-hours walk-in). Never throws for a full calendar.
 */
async function resolveWalkInSlot(
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
  try {
    await assertDoctorAvailableOnDate(providerId, `${y}-${m}-${d}`);
  } catch {
    /* Walk-in visit: allow slot creation even if schedule is unconfigured for the day */
  }
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
    if (candidateEnd.getTime() > windowEnd.getTime()) break;
    const clash = await findClash(providerId, cursor, candidateEnd, excludeId);
    if (!clash) return { startsAt: cursor, endsAt: candidateEnd };
    const afterHit = asDate(clash.endsAt).getTime();
    const plusStep = cursor.getTime() + SLOT_STEP_MS;
    cursor = new Date(Math.max(afterHit, plusStep));
  }
  return { startsAt, endsAt };
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
 * New walk-ins prefer the next free 30-min slot; if none remain, still create
 * the visit so issuing a token never fails on a full calendar.
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

  const resolved = await resolveWalkInSlot(input.providerId, startsAt, endsAt);
  const created = await getPrisma().appointment.create({
    data: toData({
      ...input,
      startsAt: resolved.startsAt.toISOString(),
      endsAt: resolved.endsAt.toISOString(),
      recurrenceRule: null,
    }),
  });
  return getAppointmentById(created.id);
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
    const visitAt = new Date(appointment.startsAt);
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