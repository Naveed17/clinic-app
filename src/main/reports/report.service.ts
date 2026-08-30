import type { Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseReportDate(dateStr: string | undefined): string {
  const s = String(dateStr || localTodayYmd()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid date. Use YYYY-MM-DD.');
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw new Error('Invalid date.');
  }
  return s;
}

function localDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    dayStart: new Date(y, m - 1, d, 0, 0, 0, 0),
    dayEnd: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function personName(person: { firstName: string; lastName?: string | null }): string {
  return `${person.firstName} ${person.lastName || ''}`.trim();
}

function displayInvoiceStatus(status: string, _amountPaid: number, hasRefund: boolean): string {
  if (status !== 'VOID' && status !== 'DRAFT' && hasRefund) return 'REFUNDED';
  return status;
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

export interface OpdReportInput {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  doctorId?: string | null;
}

function resolveReportDateRange(input: OpdReportInput = {}): { dateFrom: string; dateTo: string } {
  const legacy = input.date ? parseReportDate(input.date) : null;
  const dateFrom = parseReportDate(input.dateFrom ?? legacy ?? undefined);
  const dateTo = parseReportDate(input.dateTo ?? legacy ?? dateFrom);
  if (dateFrom > dateTo) throw new Error('Start date cannot be after end date.');
  return { dateFrom, dateTo };
}

export async function getOpdDailyReport(input: OpdReportInput = {}) {
  const { dateFrom, dateTo } = resolveReportDateRange(input);
  const doctorId = String(input.doctorId || '').trim() || null;
  const { dayStart: rangeStart } = localDayBounds(dateFrom);
  const { dayEnd: rangeEnd } = localDayBounds(dateTo);
  const database = getPrisma();

  let doctorName: string | null = null;
  if (doctorId) {
    const doctor = await database.user.findFirst({
      where: { id: doctorId, role: 'DOCTOR' },
      select: { firstName: true, lastName: true },
    });
    if (!doctor) throw new Error('Doctor not found.');
    doctorName = personName(doctor);
  }

  type TokenReportRow = {
    id: string;
    tokenNumber: number;
    date: string;
    status: string;
    consultationFee: unknown;
    feeDiscount: unknown;
    feeRefunded: unknown;
    patientId: string;
    doctorId: string;
    createdAt: Date | string;
    patientFirstName: string;
    patientLastName: string;
    patientMrNumber: string | null;
    doctorFirstName: string;
    doctorLastName: string;
    doctorConsultationFee: unknown;
    appointmentFeeType: string | null;
  };

  const tokens = doctorId
    ? await database.$queryRawUnsafe<TokenReportRow[]>(
        `
        SELECT t.id, t.tokenNumber, t.date, t.status, t.consultationFee, t.feeDiscount, t.feeRefunded,
          t.patientId, t.doctorId, t.createdAt,
          p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
          u.firstName as doctorFirstName, u.lastName as doctorLastName,
          dp.consultationFee as doctorConsultationFee,
          (
            SELECT a.feeType FROM "Appointment" a
            WHERE a.patientId = t.patientId AND a.providerId = t.doctorId AND a.startsAt LIKE (t.date || '%')
            ORDER BY a.createdAt DESC LIMIT 1
          ) as appointmentFeeType
        FROM "Token" t
        JOIN "Patient" p ON p.id = t.patientId
        JOIN "User" u ON u.id = t.doctorId
        LEFT JOIN "DoctorProfile" dp ON dp.userId = t.doctorId
        WHERE t.date >= ? AND t.date <= ? AND t.doctorId = ?
        ORDER BY t.date DESC, t.tokenNumber DESC
        `,
        dateFrom,
        dateTo,
        doctorId,
      )
    : await database.$queryRawUnsafe<TokenReportRow[]>(
        `
        SELECT t.id, t.tokenNumber, t.date, t.status, t.consultationFee, t.feeDiscount, t.feeRefunded,
          t.patientId, t.doctorId, t.createdAt,
          p.firstName as patientFirstName, p.lastName as patientLastName, p.mrNumber as patientMrNumber,
          u.firstName as doctorFirstName, u.lastName as doctorLastName,
          dp.consultationFee as doctorConsultationFee,
          (
            SELECT a.feeType FROM "Appointment" a
            WHERE a.patientId = t.patientId AND a.providerId = t.doctorId AND a.startsAt LIKE (t.date || '%')
            ORDER BY a.createdAt DESC LIMIT 1
          ) as appointmentFeeType
        FROM "Token" t
        JOIN "Patient" p ON p.id = t.patientId
        JOIN "User" u ON u.id = t.doctorId
        LEFT JOIN "DoctorProfile" dp ON dp.userId = t.doctorId
        WHERE t.date >= ? AND t.date <= ?
        ORDER BY t.date DESC, t.tokenNumber DESC
        `,
        dateFrom,
        dateTo,
      );

  const patientDoctors = new Map<string, Set<string>>();
  for (const token of tokens) {
    const name = personName({ firstName: token.doctorFirstName, lastName: token.doctorLastName });
    if (!patientDoctors.has(token.patientId)) patientDoctors.set(token.patientId, new Set());
    patientDoctors.get(token.patientId)!.add(name);
  }

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    createdAt: { gte: rangeStart, lte: rangeEnd },
  };
  if (doctorId) {
    const tokenPatientIds = [...new Set(tokens.map((token) => token.patientId))].slice(0, 500);
    const or: Prisma.InvoiceWhereInput[] = [{ appointment: { providerId: doctorId } }];
    if (tokenPatientIds.length) or.push({ patientId: { in: tokenPatientIds } });
    invoiceWhere.OR = or;
  }

  const invoices = await database.invoice.findMany({
    where: invoiceWhere,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      total: true,
      amountPaid: true,
      createdAt: true,
      patientId: true,
      patient: { select: { firstName: true, lastName: true } },
      appointment: { select: { provider: { select: { firstName: true, lastName: true } } } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const invoiceRows = invoices.map((invoice) => {
    const amountPaid = roundMoney(Number(invoice.amountPaid));
    const refunded = roundMoney(
      invoice.payments.reduce((sum, payment) => sum + (Number(payment.amount) < 0 ? -Number(payment.amount) : 0), 0),
    );
    const total = roundMoney(Number(invoice.total));
    const hasRefund = invoice.payments.some((payment) => Number(payment.amount) < 0);
    const status = displayInvoiceStatus(invoice.status, amountPaid, hasRefund);
    const names = new Set<string>();
    if (invoice.appointment?.provider) names.add(personName(invoice.appointment.provider));
    for (const name of patientDoctors.get(invoice.patientId) ?? []) names.add(name);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientName: personName(invoice.patient),
      doctors: [...names].join(', ') || '—',
      status,
      total,
      amountPaid,
      refunded,
      outstanding: roundMoney(Math.max(0, total - amountPaid)),
      createdAt: invoice.createdAt.toISOString(),
    };
  });

  const countableInvoices = invoiceRows.filter((row) => row.status !== 'VOID' && row.status !== 'DRAFT');
  const invoiceBilled = roundMoney(countableInvoices.reduce((sum, row) => sum + row.total, 0));
  const invoiceCollected = roundMoney(countableInvoices.reduce((sum, row) => sum + row.amountPaid, 0));
  const invoiceRefunded = roundMoney(countableInvoices.reduce((sum, row) => sum + row.refunded, 0));

  const feeRows = tokens.map((token) => {
    const rawGross = roundMoney(Number(token.consultationFee));
    const doctorDefaultFee = roundMoney(Number(token.doctorConsultationFee));
    const apptType = String(token.appointmentFeeType || '').toUpperCase();

    let feeType: 'PAID' | 'FREE' | 'HALF' | 'DISCOUNTED';
    let gross: number;
    let discounted = roundMoney(Number(token.feeDiscount));
    const refunded = roundMoney(Number(token.feeRefunded));

    if (apptType === 'FREE' || (rawGross === 0 && !token.consultationFee && doctorDefaultFee === 0)) {
      feeType = 'FREE';
      gross = 0;
      discounted = 0;
    } else if (apptType === 'HALF') {
      feeType = 'HALF';
      gross = rawGross > 0 ? rawGross : (doctorDefaultFee > 0 ? doctorDefaultFee : 1000);
      if (discounted === 0) discounted = roundMoney(gross / 2);
    } else if (apptType === 'DISCOUNTED') {
      gross = rawGross > 0 ? rawGross : (doctorDefaultFee > 0 ? doctorDefaultFee : 1000);
      feeType = 'DISCOUNTED';
    } else if (rawGross === 0 && (token.consultationFee !== null && token.consultationFee !== undefined)) {
      // Specifically recorded with 0 fee (e.g. walk-in free checkup)
      feeType = 'FREE';
      gross = 0;
      discounted = 0;
    } else if (rawGross > 0) {
      gross = rawGross;
      const isHalf = discounted > 0 && Math.abs(discounted - gross / 2) <= 1;
      feeType = discounted >= gross ? 'FREE' : isHalf ? 'HALF' : discounted > 0 ? 'DISCOUNTED' : 'PAID';
    } else if (doctorDefaultFee > 0 && apptType === 'PAID') {
      gross = doctorDefaultFee;
      const isHalf = discounted > 0 && Math.abs(discounted - gross / 2) <= 1;
      feeType = discounted >= gross ? 'FREE' : isHalf ? 'HALF' : discounted > 0 ? 'DISCOUNTED' : 'PAID';
    } else {
      gross = 0;
      feeType = 'FREE';
    }

    const collected = roundMoney(Math.max(0, gross - discounted));

    return {
      id: token.id,
      tokenNumber: Number(token.tokenNumber),
      date: String(token.date),
      patientName: personName({ firstName: token.patientFirstName, lastName: token.patientLastName }),
      mrNumber: token.patientMrNumber || null,
      doctorId: token.doctorId,
      doctorName: personName({ firstName: token.doctorFirstName, lastName: token.doctorLastName }),
      status: token.status,
      feeType,
      consultationFee: gross,
      feeDiscount: discounted,
      feeRefunded: refunded,
      net: roundMoney(Math.max(0, collected - refunded)),
      createdAt: token.createdAt instanceof Date ? token.createdAt.toISOString() : String(token.createdAt),
    };
  });

  const byDoctorMap = new Map<
    string,
    {
      doctorId: string;
      doctorName: string;
      tokens: number;
      paidCount: number;
      halfCount: number;
      freeCount: number;
      collected: number;
      discounted: number;
      refunded: number;
      net: number;
    }
  >();
  for (const row of feeRows) {
    const current = byDoctorMap.get(row.doctorId) ?? {
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      tokens: 0,
      paidCount: 0,
      halfCount: 0,
      freeCount: 0,
      collected: 0,
      discounted: 0,
      refunded: 0,
      net: 0,
    };
    current.tokens += 1;
    if (row.feeType === 'FREE') {
      current.freeCount += 1;
    } else if (row.feeType === 'HALF') {
      current.halfCount += 1;
    } else {
      current.paidCount += 1;
    }
    current.collected = roundMoney(current.collected + (row.consultationFee - row.feeDiscount));
    current.discounted = roundMoney(current.discounted + row.feeDiscount);
    current.refunded = roundMoney(current.refunded + row.feeRefunded);
    current.net = roundMoney(current.net + row.net);
    byDoctorMap.set(row.doctorId, current);
  }

  const overallPaidCount = feeRows.filter((r) => r.feeType === 'PAID').length;
  const overallHalfCount = feeRows.filter((r) => r.feeType === 'HALF').length;
  const overallFreeCount = feeRows.filter((r) => r.feeType === 'FREE').length;

  return {
    date: dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`,
    dateFrom,
    dateTo,
    doctorId,
    doctorName,
    invoices: {
      rows: invoiceRows,
      count: countableInvoices.length,
      billed: invoiceBilled,
      collected: invoiceCollected,
      refunded: invoiceRefunded,
      outstanding: roundMoney(Math.max(0, invoiceBilled - invoiceCollected)),
    },
    fees: {
      rows: feeRows,
      byDoctor: [...byDoctorMap.values()],
      count: feeRows.length,
      paidCount: overallPaidCount,
      halfCount: overallHalfCount,
      freeCount: overallFreeCount,
      collected: roundMoney(feeRows.reduce((sum, row) => sum + (row.consultationFee - row.feeDiscount), 0)),
      discounted: roundMoney(feeRows.reduce((sum, row) => sum + row.feeDiscount, 0)),
      refunded: roundMoney(feeRows.reduce((sum, row) => sum + row.feeRefunded, 0)),
      net: roundMoney(feeRows.reduce((sum, row) => sum + row.net, 0)),
    },
  };
}
