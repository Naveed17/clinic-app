import { getPrisma } from '../database/client';

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export async function getDoctorSchedule(doctorId: string) {
  return getPrisma().doctorSchedule.findMany({
    where: { doctorId },
    orderBy: { dayOfWeek: 'asc' },
  });
}

export async function upsertDoctorSchedule(doctorId: string, slots: ScheduleInput[]) {
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
