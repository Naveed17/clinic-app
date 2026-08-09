import type { AppointmentStatus } from '@prisma/client';
import { getPrisma } from '../database/client';
import { assertDoctorAvailable } from '../doctors/schedule.service';

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
      (
        SELECT t.tokenNumber FROM "Token" t
        WHERE t.patientId = a.patientId AND t.doctorId = a.providerId
          AND t.date = strftime('%Y-%m-%d', a.startsAt)
        ORDER BY t.tokenNumber DESC LIMIT 1
      ) as tokenNumber
    FROM "Appointment" a
    JOIN "Patient" pat ON pat.id = a.patientId
    JOIN "User" prov ON prov.id = a.providerId
    ORDER BY a.createdAt DESC
  `);
  return rows.map((r) => ({
    id: r.id, patientId: r.patientId, providerId: r.providerId,
    startsAt: r.startsAt, endsAt: r.endsAt, status: r.status,
    reason: r.reason, notes: r.notes, recurrenceRule: r.recurrenceRule, parentId: r.parentId,
    tokenNumber: r.tokenNumber != null ? Number(r.tokenNumber) : null,
    patient: { id: r.patId, firstName: r.patFirst, lastName: r.patLast, role: '', phone: r.patPhone ?? null },
    provider: { id: r.provId, firstName: r.provFirst, lastName: r.provLast, role: r.provRole },
  }));
}

export async function listAppointmentPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listDoctors() {
  return getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getAppointmentById(id: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT a.id, a.patientId, a.providerId, a.startsAt, a.endsAt, a.status,
      a.reason, a.notes, a.recurrenceRule, a.parentId,
      pat.id as patId, pat.firstName as patFirst, pat.lastName as patLast, pat.phone as patPhone,
      prov.id as provId, prov.firstName as provFirst, prov.lastName as provLast, prov.role as provRole,
      (
        SELECT t.tokenNumber FROM "Token" t
        WHERE t.patientId = a.patientId AND t.doctorId = a.providerId
          AND t.date = strftime('%Y-%m-%d', a.startsAt)
        ORDER BY t.tokenNumber DESC LIMIT 1
      ) as tokenNumber
    FROM "Appointment" a
    JOIN "Patient" pat ON pat.id = a.patientId
    JOIN "User" prov ON prov.id = a.providerId
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
    provider: { id: r.provId, firstName: r.provFirst, lastName: r.provLast, role: r.provRole },
  };
}

export async function createAppointment(input: AppointmentInput) {
  await assertProviderActive(input.providerId);
  const startsAt = parseDate(input.startsAt, 'startsAt');
  const endsAt = parseDate(input.endsAt, 'endsAt');
  await assertDoctorAvailable(input.providerId, startsAt, endsAt);

  if (input.recurrenceRule) {
    const [freq, countStr] = input.recurrenceRule.split(':');
    const count = parseInt(countStr ?? '1', 10);
    if (freq === 'WEEKLY' && count > 1) {
      const durationMs = endsAt.getTime() - startsAt.getTime();
      for (let i = 1; i < count; i++) {
        const occStart = new Date(startsAt.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const occEnd = new Date(occStart.getTime() + durationMs);
        await assertDoctorAvailable(input.providerId, occStart, occEnd);
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

export async function updateAppointment(id: string, input: AppointmentInput) {
  await assertProviderActive(input.providerId);
  await assertDoctorAvailable(
    input.providerId,
    parseDate(input.startsAt, 'startsAt'),
    parseDate(input.endsAt, 'endsAt'),
  );
  await getPrisma().appointment.update({ where: { id }, data: toData(input) });
  return getAppointmentById(id);
}

export async function cancelAppointment(id: string) {
  await getPrisma().appointment.update({ where: { id }, data: { status: 'CANCELLED' satisfies AppointmentStatus } });
  return getAppointmentById(id);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  await getPrisma().appointment.update({ where: { id }, data: { status } });
  return getAppointmentById(id);
}

export async function deleteAppointment(id: string) {
  return getPrisma().appointment.delete({ where: { id } });
}