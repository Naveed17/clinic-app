import { getPrisma } from '../database/client';

export async function markCheckIn(doctorId: string, date: string) {
  return getPrisma().doctorAttendance.upsert({
    where: { doctorId_date: { doctorId, date } },
    create: { doctorId, date, checkInAt: new Date() },
    update: {},
  });
}

export async function markCheckOut(doctorId: string, date: string) {
  return getPrisma().doctorAttendance.updateMany({
    where: { doctorId, date },
    data: { checkOutAt: new Date() },
  });
}

export async function getAttendance(doctorId: string, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return getPrisma().doctorAttendance.findMany({
    where: { doctorId, date: { gte: from, lte: to } },
    orderBy: { date: 'desc' },
  });
}