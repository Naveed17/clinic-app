import { getPrisma } from '../database/client';

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function getReportSummary(): Promise<{
  todaysPatients: number;
  todaysRevenue: number;
  monthlyRevenue: number;
}> {
  const now = new Date();
  const today = atStartOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const database = getPrisma();

  const [appointments, todaysInvoices, monthlyInvoices] = await Promise.all([
    database.appointment.findMany({
      where: { startsAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
      select: { patientId: true },
    }),
    database.invoice.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow } },
      _sum: { total: true },
    }),
    database.invoice.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
  ]);

  return {
    todaysPatients: new Set(appointments.map((appointment) => appointment.patientId)).size,
    todaysRevenue: Number(todaysInvoices._sum.total ?? 0),
    monthlyRevenue: Number(monthlyInvoices._sum.total ?? 0),
  };
}
