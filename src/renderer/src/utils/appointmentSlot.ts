import type { Appointment } from '@/types/appointment';

export type DoctorDaySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

const STEP_MIN = 30;
const SEARCH_DAYS = 14;

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function localDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function atLocal(dateStr: string, hm: string): Date {
  return new Date(`${dateStr}T${hm}:00`);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function slotForDate(schedule: DoctorDaySlot[], dateStr: string): DoctorDaySlot | undefined {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  const slot = schedule.find((s) => s.dayOfWeek === day);
  if (!slot || !slot.isActive) return undefined;
  return slot;
}

/** Null when the doctor has no working hours that calendar day (including unsaved / all-Off schedule). */
export function doctorOfflineReason(schedule: DoctorDaySlot[], dateStr: string): string | null {
  if (!dateStr) return null;
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  if (Number.isNaN(day)) return null;
  if (slotForDate(schedule, dateStr)) return null;
  return `Doctor is offline on ${DAY_NAMES[day]}. Turn that day on in Doctor Schedule, then try again.`;
}

function dayAppointments(
  appointments: Appointment[],
  providerId: string,
  dateStr: string,
  excludeId?: string,
): Appointment[] {
  return appointments
    .filter((a) => a.providerId === providerId)
    .filter((a) => a.id !== excludeId)
    .filter((a) => !['CANCELLED', 'NO_SHOW'].includes(a.status))
    .filter((a) => new Date(a.startsAt).toLocaleDateString('en-CA') === dateStr)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function overlaps(start: Date, end: Date, appt: Appointment): boolean {
  return start.getTime() < new Date(appt.endsAt).getTime()
    && end.getTime() > new Date(appt.startsAt).getTime();
}

function findTimeOnDay(opts: {
  dateStr: string;
  schedule: DoctorDaySlot[];
  appointments: Appointment[];
  providerId: string;
  durationMin: number;
  earliest: Date;
  excludeId?: string;
}): string | null {
  const { dateStr, schedule, appointments, providerId, durationMin, earliest, excludeId } = opts;
  const slot = slotForDate(schedule, dateStr);
  if (!slot) return null;
  const windowStart = atLocal(dateStr, slot.startTime);
  const windowEnd = atLocal(dateStr, slot.endTime);
  const booked = dayAppointments(appointments, providerId, dateStr, excludeId);
  const durMs = durationMin * 60_000;
  const stepMs = STEP_MIN * 60_000;

  let cursor = windowStart.getTime() > earliest.getTime() ? windowStart : earliest;

  while (cursor.getTime() + durMs <= windowEnd.getTime()) {
    const start = cursor;
    const end = new Date(start.getTime() + durMs);
    const hit = booked.find((a) => overlaps(start, end, a));
    if (!hit) {
      return minutesToHm(start.getHours() * 60 + start.getMinutes());
    }
    const afterHit = new Date(hit.endsAt);
    const plusStep = new Date(start.getTime() + stepMs);
    cursor = afterHit.getTime() > plusStep.getTime() ? afterHit : plusStep;
  }
  return null;
}

/** Next free slot: after previous visit end, within hours; off-day / time-up → next working day. Busy → +30 min. */
export type SlotAdjustReason = 'busy' | 'schedule';

export function nextFreeSlot(opts: {
  schedule: DoctorDaySlot[];
  appointments: Appointment[];
  providerId: string;
  durationMin: number;
  from?: Date;
  excludeId?: string;
}): { date: string; time: string; reason: SlotAdjustReason | null } | null {
  const from = opts.from ?? new Date();
  const durationMin = Math.max(15, opts.durationMin || 30);
  const fromDate = localDateStr(from);
  const fromEnd = new Date(from.getTime() + durationMin * 60_000);
  const requestedBusy = dayAppointments(opts.appointments, opts.providerId, fromDate, opts.excludeId)
    .some((a) => overlaps(from, fromEnd, a));
  const requestedSlot = slotForDate(opts.schedule, fromDate);
  const outsideHours = opts.schedule.length > 0 && (
    !requestedSlot
    || from < atLocal(fromDate, requestedSlot.startTime)
    || fromEnd > atLocal(fromDate, requestedSlot.endTime)
  );

  for (let i = 0; i < SEARCH_DAYS; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const dateStr = localDateStr(day);
    if (!slotForDate(opts.schedule, dateStr)) continue;
    const earliest = i === 0 ? from : atLocal(dateStr, '00:00');
    const time = findTimeOnDay({
      dateStr,
      schedule: opts.schedule,
      appointments: opts.appointments,
      providerId: opts.providerId,
      durationMin,
      earliest,
      excludeId: opts.excludeId,
    });
    if (!time) continue;
    const sameSlot = dateStr === fromDate && time === minutesToHm(from.getHours() * 60 + from.getMinutes());
    let reason: SlotAdjustReason | null = null;
    if (!sameSlot) {
      reason = requestedBusy && !outsideHours ? 'busy' : 'schedule';
      if (requestedBusy && i === 0) reason = 'busy';
    }
    return { date: dateStr, time, reason };
  }
  return null;
}
