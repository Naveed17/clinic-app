import { getPrisma } from '../database/client';

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function assertValidSlot(slot: ScheduleInput, index: number): void {
  if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
    throw new Error(`Invalid dayOfWeek at slot ${index + 1} (expected 0–6).`);
  }
  if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
    throw new Error(`Invalid time on ${DAY_NAMES[slot.dayOfWeek]} (use HH:MM).`);
  }
  if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
    throw new Error(`On ${DAY_NAMES[slot.dayOfWeek]}, start time must be before end time.`);
  }
}

export async function getDoctorSchedule(doctorId: string) {
  return getPrisma().doctorSchedule.findMany({
    where: { doctorId },
    orderBy: { dayOfWeek: 'asc' },
  });
}

export async function upsertDoctorSchedule(doctorId: string, slots: ScheduleInput[]) {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('Schedule slots are required.');
  }
  slots.forEach((slot, i) => assertValidSlot(slot, i));

  const doctor = await getPrisma().user.findFirst({
    where: { id: doctorId, role: 'DOCTOR' },
    select: { id: true },
  });
  if (!doctor) throw new Error('Doctor not found.');

  const prisma = getPrisma();
  await prisma.$transaction(
    slots.map((slot) =>
      prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: slot.dayOfWeek } },
        create: { doctorId, ...slot },
        update: { startTime: slot.startTime, endTime: slot.endTime, isActive: slot.isActive },
      }),
    ),
  );
  return getDoctorSchedule(doctorId);
}

/**
 * Enforce weekly DoctorSchedule for a timed visit.
 * If the doctor has no schedule rows yet, allow (not configured).
 */
export async function assertDoctorAvailable(
  doctorId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Invalid appointment date/time.');
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error('Appointment end must be after start.');
  }

  const slots = await getDoctorSchedule(doctorId);
  if (slots.length === 0) return;

  if (startsAt.toDateString() !== endsAt.toDateString()) {
    throw new Error('Appointment must stay within a single day inside doctor hours.');
  }

  const day = startsAt.getDay();
  const dayName = DAY_NAMES[day];
  const slot = slots.find((s) => s.dayOfWeek === day);

  if (!slot || !slot.isActive) {
    throw new Error(
      `Doctor is not available on ${dayName}. Update Doctor Schedule or choose another day.`,
    );
  }

  const startM = timeToMinutes(formatHm(startsAt));
  const endM = timeToMinutes(formatHm(endsAt));
  const slotStart = timeToMinutes(slot.startTime);
  const slotEnd = timeToMinutes(slot.endTime);

  if (startM < slotStart || endM > slotEnd) {
    throw new Error(
      `Appointment must be within doctor hours ${slot.startTime}–${slot.endTime} on ${dayName}.`,
    );
  }
}

/**
 * Day-level check for tokens (no specific clock time).
 * If schedule is configured and the day is off, block.
 */
export async function assertDoctorAvailableOnDate(doctorId: string, dateStr: string): Promise<void> {
  const slots = await getDoctorSchedule(doctorId);
  if (slots.length === 0) return;

  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid token date.');

  const day = d.getDay();
  const slot = slots.find((s) => s.dayOfWeek === day);
  if (!slot || !slot.isActive) {
    throw new Error(
      `Doctor is not available on ${DAY_NAMES[day]}. Update Doctor Schedule or choose another day.`,
    );
  }
}
