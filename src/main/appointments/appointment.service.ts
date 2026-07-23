import type { AppointmentStatus, Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  notes?: string | null;
  recurrenceRule?: string | null; // e.g. "WEEKLY:4"
}

function parseDate(value: unknown, name: string): Date {
  if (value === undefined || value === null) throw new Error(`${name} is required`);
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`${name} is not a valid date: ${value}`);
  return d;
}

function toData(input: AppointmentInput): Prisma.AppointmentUncheckedCreateInput {
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

const appointmentInclude = { patient: true, provider: true } satisfies Prisma.AppointmentInclude;

export async function listAppointments(): Promise<
  Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>[]
> {
  return getPrisma().appointment.findMany({
    include: appointmentInclude,
    orderBy: { startsAt: 'asc' },
  });
}

export async function listAppointmentPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function listDoctors() {
  return getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function createAppointment(input: AppointmentInput) {
  const first = await getPrisma().appointment.create({ data: toData(input), include: appointmentInclude });

  // Handle recurrence
  if (input.recurrenceRule) {
    const [freq, countStr] = input.recurrenceRule.split(':');
    const count = parseInt(countStr ?? '1', 10);
    if (freq === 'WEEKLY' && count > 1) {
      const durationMs = new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime();
      for (let i = 1; i < count; i++) {
        const startsAt = new Date(new Date(input.startsAt).getTime() + i * 7 * 24 * 60 * 60 * 1000);
        await getPrisma().appointment.create({
          data: {
            ...toData({ ...input, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + durationMs).toISOString() }),
            parentId: first.id,
            recurrenceRule: null,
          },
          include: appointmentInclude,
        });
      }
    }
  }

  return first;
}

export async function updateAppointment(id: string, input: AppointmentInput) {
  return getPrisma().appointment.update({
    where: { id },
    data: toData(input),
    include: appointmentInclude,
  });
}

export async function cancelAppointment(id: string) {
  return getPrisma().appointment.update({
    where: { id },
    data: { status: 'CANCELLED' satisfies AppointmentStatus },
    include: appointmentInclude,
  });
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  return getPrisma().appointment.update({
    where: { id },
    data: { status },
    include: appointmentInclude,
  });
}