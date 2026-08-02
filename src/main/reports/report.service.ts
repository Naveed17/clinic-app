import { getPrisma } from '../database/client';

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDateKey(d: Date): string {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export interface DetailedReportRow {
  date: string;
  patients: number;
  appointments: number;
  revenue: number;
  invoices: number;
}

export async function getDetailedReport(from: string, to: string): Promise<DetailedReportRow[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setDate(toDate.getDate() + 1); // inclusive
  const database = getPrisma();

  const [appointments, invoices] = await Promise.all([
    database.appointment.findMany({
      where: { startsAt: { gte: fromDate, lt: toDate }, status: { not: 'CANCELLED' } },
      select: { patientId: true, startsAt: true },
    }),
    database.invoice.findMany({
      where: { createdAt: { gte: fromDate, lt: toDate } },
      select: { createdAt: true, total: true },
    }),
  ]);

  // Build day-by-day map
  const map = new Map<string, { patientIds: Set<string>; appointments: number; revenue: number; invoices: number }>();

  const cursor = new Date(fromDate);
  while (cursor < toDate) {
    const key = toLocalDateKey(cursor);
    map.set(key, { patientIds: new Set(), appointments: 0, revenue: 0, invoices: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const appt of appointments) {
    const key = toLocalDateKey(appt.startsAt);
    const row = map.get(key);
    if (row) { row.patientIds.add(appt.patientId); row.appointments += 1; }
  }
  for (const inv of invoices) {
    const key = toLocalDateKey(inv.createdAt);
    const row = map.get(key);
    if (row) { row.revenue += Number(inv.total); row.invoices += 1; }
  }

  return Array.from(map.entries())
    .map(([date, row]) => ({
      date,
      patients: row.patientIds.size,
      appointments: row.appointments,
      revenue: row.revenue,
      invoices: row.invoices,
    }))
    .reverse();
}

export interface DoctorRevenueRow {
  doctorId: string;
  doctorName: string;
  appointments: number;
  revenue: number;
}

export async function getDoctorRevenue(from: string, to: string): Promise<DoctorRevenueRow[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setDate(toDate.getDate() + 1);
  const database = getPrisma();

  const appointments = await database.appointment.findMany({
    where: { startsAt: { gte: fromDate, lt: toDate }, status: { not: 'CANCELLED' } },
    select: {
      providerId: true,
      provider: { select: { firstName: true, lastName: true } },
      invoice: { select: { total: true } },
    },
  });

  const map = new Map<string, DoctorRevenueRow>();
  for (const appt of appointments) {
    const existing = map.get(appt.providerId);
    const revenue = Number(appt.invoice?.total ?? 0);
    if (existing) {
      existing.appointments += 1;
      existing.revenue += revenue;
    } else {
      map.set(appt.providerId, {
        doctorId: appt.providerId,
        doctorName: `${appt.provider.firstName} ${appt.provider.lastName}`,
        appointments: 1,
        revenue,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}