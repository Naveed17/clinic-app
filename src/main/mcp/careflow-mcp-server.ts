import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPrisma } from '../database/client';
import { getOpdDailyReport, getClinicStatistics } from '../reports/report.service';
import { listPatients } from '../patients/patient.service';
import { createAppointment } from '../appointments/appointment.service';

function localTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    dayStart: new Date(y, m - 1, d, 0, 0, 0, 0),
    dayEnd: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

// =========================================================================
// DIRECT HANDLER FUNCTIONS (Exposed for MCP Server & IPC Chatbot)
// =========================================================================

export async function getDoctorTodayAppointments(doctorId: string, date?: string) {
  const targetDate = date?.trim() || localTodayYmd();
  const { dayStart, dayEnd } = localDayBounds(targetDate);
  const db = getPrisma();

  const doctor = await db.user.findFirst({
    where: { id: doctorId, role: 'DOCTOR' },
    select: { firstName: true, lastName: true },
  });

  const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName || ''}`.trim() : `Doctor (${doctorId})`;

  const appointments = await db.appointment.findMany({
    where: {
      providerId: doctorId,
      startsAt: { gte: dayStart, lte: dayEnd },
      isDeleted: false,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrNumber: true,
          phone: true,
          gender: true,
        },
      },
    },
    orderBy: { startsAt: 'asc' },
  });

  const items = appointments.map((a) => ({
    id: a.id,
    patientName: `${a.patient.firstName} ${a.patient.lastName || ''}`.trim(),
    mrNumber: a.patient.mrNumber,
    phone: a.patient.phone || 'N/A',
    gender: a.patient.gender || 'N/A',
    time: a.startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    status: a.status,
    reason: a.reason || 'Routine Checkup',
    feeType: a.feeType,
    notes: a.notes || '',
  }));

  return {
    doctor: doctorName,
    date: targetDate,
    totalAppointments: items.length,
    appointments: items,
  };
}

export async function getDoctorQueue(doctorId: string, date?: string) {
  const targetDate = date?.trim() || localTodayYmd();
  const db = getPrisma();

  const tokens = await db.token.findMany({
    where: {
      doctorId,
      date: targetDate,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrNumber: true,
          phone: true,
          gender: true,
        },
      },
    },
    orderBy: { tokenNumber: 'asc' },
  });

  const queue = tokens.map((t) => ({
    tokenNumber: t.tokenNumber,
    patientName: `${t.patient.firstName} ${t.patient.lastName || ''}`.trim(),
    mrNumber: t.patient.mrNumber,
    phone: t.patient.phone || 'N/A',
    status: t.status,
    priority: t.priority,
    reason: t.reason || '',
    consultationFee: Number(t.consultationFee),
    feeDiscount: Number(t.feeDiscount),
    vitals: t.vitals ? JSON.parse(String(t.vitals)) : null,
  }));

  const waiting = queue.filter((q) => q.status === 'WAITING' || q.status === 'CALLED');
  const inConsultation = queue.find((q) => q.status === 'IN_CONSULTATION' || q.status === 'IN_PROGRESS');
  const completed = queue.filter((q) => q.status === 'DONE' || q.status === 'COMPLETED');

  return {
    date: targetDate,
    totalTokens: queue.length,
    waitingCount: waiting.length,
    completedCount: completed.length,
    currentPatient: inConsultation ?? null,
    waitingList: waiting,
    allTokens: queue,
  };
}

export async function getPatientMedicalHistory(search: string) {
  const db = getPrisma();
  const query = search.trim();

  const patient = await db.patient.findFirst({
    where: {
      OR: [
        { id: query },
        { mrNumber: { contains: query } },
        { phone: { contains: query } },
        { firstName: { contains: query } },
        { lastName: { contains: query } },
      ],
      isDeleted: false,
    },
    include: {
      primaryDoctor: {
        select: { firstName: true, lastName: true },
      },
      tokens: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          doctor: { select: { firstName: true, lastName: true } },
        },
      },
      appointments: {
        where: { isDeleted: false },
        orderBy: { startsAt: 'desc' },
        take: 10,
        include: {
          provider: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!patient) return null;

  return {
    id: patient.id,
    mrNumber: patient.mrNumber,
    name: `${patient.firstName} ${patient.lastName || ''}`.trim(),
    phone: patient.phone || 'N/A',
    gender: patient.gender || 'N/A',
    bloodGroup: patient.bloodGroup || 'N/A',
    allergies: patient.allergies || 'None reported',
    chronicConditions: patient.chronicConditions || 'None reported',
    emergencyContact: patient.emergencyContactName
      ? `${patient.emergencyContactName} (${patient.emergencyContactPhone || 'No phone'})`
      : 'N/A',
    primaryDoctor: patient.primaryDoctor
      ? `Dr. ${patient.primaryDoctor.firstName} ${patient.primaryDoctor.lastName || ''}`.trim()
      : 'None',
    recentVisits: patient.tokens.map((t) => ({
      date: t.date,
      tokenNumber: t.tokenNumber,
      doctor: `Dr. ${t.doctor.firstName} ${t.doctor.lastName || ''}`.trim(),
      status: t.status,
      reason: t.reason || '',
      notes: t.notes || '',
    })),
    recentAppointments: patient.appointments.map((a) => ({
      date: a.startsAt.toISOString().slice(0, 10),
      doctor: `Dr. ${a.provider.firstName} ${a.provider.lastName || ''}`.trim(),
      status: a.status,
      reason: a.reason || '',
    })),
  };
}

export async function getDoctorOpdFeeReport(doctorId: string, dateFrom?: string, dateTo?: string) {
  const from = dateFrom?.trim() || localTodayYmd();
  const to = dateTo?.trim() || from;

  const report = await getOpdDailyReport({
    dateFrom: from,
    dateTo: to,
    doctorId,
  });

  const doctorFeeStats = report.fees.byDoctor.find((d) => d.doctorId === doctorId) ?? {
    doctorId,
    doctorName: report.doctorName || 'Doctor',
    tokens: report.fees.count,
    paidCount: report.fees.paidCount,
    halfCount: report.fees.halfCount,
    freeCount: report.fees.freeCount,
    collected: report.fees.collected,
    discounted: report.fees.discounted,
    refunded: report.fees.refunded,
    net: report.fees.net,
  };

  return {
    doctorId,
    doctorName: report.doctorName || doctorFeeStats.doctorName,
    dateRange: report.date,
    totalPatientsSeen: doctorFeeStats.tokens,
    feeBreakdown: {
      paidPatients: doctorFeeStats.paidCount,
      halfFeePatients: doctorFeeStats.halfCount,
      freePatients: doctorFeeStats.freeCount,
    },
    financials: {
      grossConsultationFees: doctorFeeStats.collected + doctorFeeStats.discounted,
      totalDiscount: doctorFeeStats.discounted,
      totalRefunded: doctorFeeStats.refunded,
      netDoctorEarnings: doctorFeeStats.net,
    },
    patientListSample: report.fees.rows.slice(0, 50).map((r) => ({
      token: r.tokenNumber,
      patient: r.patientName,
      feeType: r.feeType,
      fee: r.consultationFee,
      discount: r.feeDiscount,
      net: r.net,
    })),
  };
}

export async function getReceptionDailyReport(date?: string, dateFrom?: string, dateTo?: string) {
  const from = dateFrom?.trim() || date?.trim() || localTodayYmd();
  const to = dateTo?.trim() || from;

  const report = await getOpdDailyReport({
    dateFrom: from,
    dateTo: to,
  });

  return {
    dateRange: report.date,
    opdDoctorFees: {
      totalTokens: report.fees.count,
      paidTokens: report.fees.paidCount,
      halfFeeTokens: report.fees.halfCount,
      freeTokens: report.fees.freeCount,
      totalCollected: report.fees.collected,
      totalDiscount: report.fees.discounted,
      totalRefunded: report.fees.refunded,
      netOpdCollected: report.fees.net,
      byDoctor: report.fees.byDoctor.map((d) => ({
        doctorName: d.doctorName,
        patients: d.tokens,
        netCollected: d.net,
      })),
    },
    clinicInvoices: {
      totalInvoicesCount: report.invoices.count,
      totalBilled: report.invoices.billed,
      totalCollected: report.invoices.collected,
      totalRefunded: report.invoices.refunded,
      outstandingPendingBalance: report.invoices.outstanding,
    },
    totalCashDeskPosition: {
      opdFeesNet: report.fees.net,
      invoicesCollected: report.invoices.collected,
      totalCashInHandEstimated: report.fees.net + report.invoices.collected,
    },
  };
}

export async function getReceptionDoctorAvailability(date?: string, doctorId?: string) {
  const targetDate = date?.trim() || localTodayYmd();
  const [y, m, d] = targetDate.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  const db = getPrisma();

  const doctors = await db.user.findMany({
    where: {
      role: 'DOCTOR',
      isActive: true,
      ...(doctorId ? { id: doctorId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      doctorProfile: {
        select: {
          specialization: true,
          qualification: true,
          consultationFee: true,
          experienceYears: true,
        },
      },
      schedules: {
        where: { dayOfWeek, isActive: true },
      },
      attendance: {
        where: { date: targetDate },
      },
    },
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const result = doctors.map((doc) => {
    const schedule = doc.schedules[0];
    const attendance = doc.attendance[0];
    const isScheduledToday = Boolean(schedule);
    const hasCheckedIn = Boolean(attendance?.checkInAt);
    const hasCheckedOut = Boolean(attendance?.checkOutAt);

    let statusText = 'Not Scheduled Today';
    if (isScheduledToday) {
      if (hasCheckedOut) {
        statusText = 'Checked Out for the day';
      } else if (hasCheckedIn) {
        statusText = 'Available / Checked In';
      } else {
        statusText = `Scheduled (${schedule.startTime} - ${schedule.endTime}), Not Checked In Yet`;
      }
    }

    return {
      id: doc.id,
      name: `Dr. ${doc.firstName} ${doc.lastName || ''}`.trim(),
      specialization: doc.doctorProfile?.specialization || 'General Physician',
      qualification: doc.doctorProfile?.qualification || '',
      consultationFee: Number(doc.doctorProfile?.consultationFee ?? 0),
      scheduledToday: isScheduledToday,
      timing: schedule ? `${schedule.startTime} - ${schedule.endTime}` : 'No slots',
      status: statusText,
    };
  });

  return {
    date: targetDate,
    day: dayNames[dayOfWeek],
    doctors: result,
  };
}

export async function getReceptionPatientSearch(query: string) {
  const res = await listPatients({
    page: 1,
    pageSize: 15,
    search: query.trim(),
  });

  return {
    totalFound: res.total,
    patients: res.data.map((p) => ({
      id: p.id,
      mrNumber: p.mrNumber,
      name: `${p.firstName} ${p.lastName || ''}`.trim(),
      phone: p.phone || 'N/A',
      gender: p.gender || 'N/A',
      address: p.address || 'N/A',
    })),
  };
}

export async function getReceptionQueueSummary(date?: string) {
  const targetDate = date?.trim() || localTodayYmd();
  const db = getPrisma();

  const tokens = await db.token.findMany({
    where: { date: targetDate },
    include: {
      doctor: { select: { firstName: true, lastName: true } },
      patient: { select: { firstName: true, lastName: true, mrNumber: true } },
    },
    orderBy: { tokenNumber: 'asc' },
  });

  const byDoctor: Record<string, { doctorName: string; total: number; waiting: number; inConsultation: number; completed: number }> = {};

  for (const t of tokens) {
    const docName = `Dr. ${t.doctor.firstName} ${t.doctor.lastName || ''}`.trim();
    if (!byDoctor[t.doctorId]) {
      byDoctor[t.doctorId] = {
        doctorName: docName,
        total: 0,
        waiting: 0,
        inConsultation: 0,
        completed: 0,
      };
    }
    byDoctor[t.doctorId].total += 1;
    if (t.status === 'WAITING' || t.status === 'CALLED') byDoctor[t.doctorId].waiting += 1;
    else if (t.status === 'IN_CONSULTATION' || t.status === 'IN_PROGRESS') byDoctor[t.doctorId].inConsultation += 1;
    else if (t.status === 'DONE' || t.status === 'COMPLETED') byDoctor[t.doctorId].completed += 1;
  }

  return {
    date: targetDate,
    totalTokensToday: tokens.length,
    clinicSummary: Object.values(byDoctor),
  };
}

export async function getAdminFullOpdAndRevenueReport(dateFrom?: string, dateTo?: string, doctorId?: string) {
  const from = dateFrom?.trim() || localTodayYmd();
  const to = dateTo?.trim() || from;

  const report = await getOpdDailyReport({
    dateFrom: from,
    dateTo: to,
    doctorId: doctorId?.trim() || null,
  });

  return {
    reportPeriod: report.date,
    doctorConsultationFeesSummary: {
      totalTokens: report.fees.count,
      paidTokens: report.fees.paidCount,
      halfFeeTokens: report.fees.halfCount,
      freeTokens: report.fees.freeCount,
      grossConsultationBilled: report.fees.collected + report.fees.discounted,
      totalDiscountsGiven: report.fees.discounted,
      totalRefunds: report.fees.refunded,
      netConsultationCollected: report.fees.net,
      doctorsBreakdown: report.fees.byDoctor.map((doc) => ({
        doctorId: doc.doctorId,
        doctorName: doc.doctorName,
        patientsCount: doc.tokens,
        paidCount: doc.paidCount,
        halfCount: doc.halfCount,
        freeCount: doc.freeCount,
        grossFee: doc.collected + doc.discounted,
        discount: doc.discounted,
        refunded: doc.refunded,
        netCollected: doc.net,
      })),
    },
    clinicInvoicesAndBilling: {
      invoicesCount: report.invoices.count,
      totalBilled: report.invoices.billed,
      totalCollected: report.invoices.collected,
      totalRefunded: report.invoices.refunded,
      totalOutstandingBalance: report.invoices.outstanding,
    },
    combinedFinancialPerformance: {
      totalClinicCollections: report.fees.net + report.invoices.collected,
      totalOutstandingDues: report.invoices.outstanding,
      totalDiscountsGranted: report.fees.discounted,
    },
  };
}

export async function getAdminClinicStats() {
  return getClinicStatistics();
}

export async function getAdminUnpaidInvoices(limit = 50) {
  const db = getPrisma();
  const take = limit && limit > 0 ? limit : 50;

  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      isDeleted: false,
    },
    include: {
      patient: {
        select: { firstName: true, lastName: true, mrNumber: true, phone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
  });

  const list = invoices.map((inv) => {
    const total = Number(inv.total);
    const paid = Number(inv.amountPaid);
    const outstanding = Math.max(0, total - paid);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.createdAt.toISOString().slice(0, 10),
      patientName: `${inv.patient.firstName} ${inv.patient.lastName || ''}`.trim(),
      mrNumber: inv.patient.mrNumber,
      phone: inv.patient.phone || 'N/A',
      status: inv.status,
      totalAmount: total,
      amountPaid: paid,
      balanceDue: Math.round(outstanding * 100) / 100,
    };
  });

  const totalOutstanding = list.reduce((sum, i) => sum + i.balanceDue, 0);

  return {
    unpaidCount: list.length,
    totalPendingRecovery: Math.round(totalOutstanding * 100) / 100,
    invoices: list,
  };
}

export async function getPharmacyMedicineSearch(query: string) {
  const db = getPrisma();
  const q = query.trim();
  const medicines = await db.medicine.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { genericName: { contains: q } },
      ],
      isDeleted: false,
    },
    include: {
      batches: {
        where: { quantity: { gt: 0 } },
        select: { quantity: true, salePrice: true, expiryDate: true },
      },
    },
    take: 10,
  });

  return {
    query: q,
    count: medicines.length,
    medicines: medicines.map((m) => {
      const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
      const latestPrice = m.batches[0]?.salePrice ? Number(m.batches[0].salePrice) : 0;
      return {
        id: m.id,
        name: m.name,
        mg: m.mg,
        unit: m.unit,
        genericName: m.genericName || 'N/A',
        totalStock,
        price: latestPrice,
        inStock: totalStock > 0,
      };
    }),
  };
}

export async function searchDoctorByName(nameQuery: string) {
  const db = getPrisma();
  const q = nameQuery.trim();
  const doctors = await db.user.findMany({
    where: {
      role: 'DOCTOR',
      isActive: true,
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ],
    },
    include: {
      doctorProfile: true,
      schedules: { where: { isActive: true } },
    },
  });

  return doctors.map((d) => ({
    id: d.id,
    name: `Dr. ${d.firstName} ${d.lastName || ''}`.trim(),
    firstName: d.firstName,
    lastName: d.lastName,
    specialization: d.doctorProfile?.specialization || 'General Physician',
    qualification: d.doctorProfile?.qualification || '',
    consultationFee: Number(d.doctorProfile?.consultationFee || 0),
    schedules: d.schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      timing: `${s.startTime} - ${s.endTime}`,
    })),
  }));
}

export async function bookPatientAppointment(params: {
  patientSearch: string;
  doctorSearch?: string;
  date?: string;
  time?: string;
  reason?: string;
}) {
  const db = getPrisma();

  // 1. Find Patient
  const pQuery = params.patientSearch.trim();
  const patient = await db.patient.findFirst({
    where: {
      OR: [
        { id: pQuery },
        { mrNumber: { contains: pQuery } },
        { phone: { contains: pQuery } },
        { firstName: { contains: pQuery } },
        { lastName: { contains: pQuery } },
      ],
      isDeleted: false,
    },
  });

  if (!patient) {
    return {
      success: false,
      error: `Patient "${pQuery}" was not found in the clinic records.`,
      patient: null,
      appointment: null,
    };
  }

  // 2. Find Doctor
  let doctor: any = null;
  if (params.doctorSearch && params.doctorSearch.trim()) {
    const dQuery = params.doctorSearch.replace(/\b(dr\.?|doctor)\b/gi, '').trim();
    if (dQuery.length > 0) {
      doctor = await db.user.findFirst({
        where: {
          role: 'DOCTOR',
          isActive: true,
          OR: [
            { id: dQuery },
            { firstName: { contains: dQuery } },
            { lastName: { contains: dQuery } },
          ],
        },
        include: { doctorProfile: true },
      });
    }
  }

  if (!doctor) {
    // Pick the primary doctor or the first active doctor
    doctor = await db.user.findFirst({
      where: { role: 'DOCTOR', isActive: true },
      include: { doctorProfile: true },
    });
  }

  if (!doctor) {
    return {
      success: false,
      error: 'No active doctor is currently available at the clinic.',
      patient,
      appointment: null,
    };
  }

  // 3. Determine Appointment Date & Time
  const now = new Date();
  let appointmentDate = new Date();
  if (params.date) {
    const [y, m, d] = params.date.split('-').map(Number);
    appointmentDate = new Date(y, m - 1, d);
  }

  let hours = now.getHours();
  let minutes = 0;
  if (params.time) {
    const [h, min] = params.time.split(':').map(Number);
    hours = h;
    minutes = min || 0;
  } else {
    // Schedule in next available 15-min bucket from now
    const slotTime = new Date(now.getTime() + 15 * 60 * 1000);
    hours = slotTime.getHours();
    minutes = Math.ceil(slotTime.getMinutes() / 15) * 15;
    if (minutes >= 60) {
      hours += 1;
      minutes = 0;
    }
  }

  // Ensure within doctor schedule or normal clinic hours (09:00 - 21:00)
  if (hours < 9) hours = 9;
  if (hours >= 21) {
    // If clinic is closed for today, schedule for tomorrow 09:00
    appointmentDate.setDate(appointmentDate.getDate() + 1);
    hours = 9;
    minutes = 0;
  }

  const startsAt = new Date(
    appointmentDate.getFullYear(),
    appointmentDate.getMonth(),
    appointmentDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  // 4. Create Appointment using createAppointment service
  const appt = await createAppointment({
    patientId: patient.id,
    providerId: doctor.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reason: params.reason || 'General OPD Consultation (AI Booking)',
    feeType: 'PAID',
  });

  const timeFormatted = `${startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const dateFormatted = startsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  if (!appt) {
    return {
      success: false,
      error: 'Failed to create appointment in database.',
      patient,
      appointment: null,
    };
  }

  return {
    success: true,
    patientName: `${patient.firstName} ${patient.lastName || ''}`.trim(),
    mrNumber: patient.mrNumber,
    phone: patient.phone || 'N/A',
    doctorName: `Dr. ${doctor.firstName} ${doctor.lastName || ''}`.trim(),
    specialization: doctor.doctorProfile?.specialization || 'General Physician',
    consultationFee: Number(doctor.doctorProfile?.consultationFee || 0),
    dateFormatted,
    timeFormatted,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    status: appt.status,
    appointmentId: appt.id,
  };
}

// =========================================================================
// MCP SERVER INITIALIZER
// =========================================================================

export function createCareFlowMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'careflow-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.tool(
    'doctor_get_today_appointments',
    'Get scheduled appointments for a doctor on a specific date (defaults to today). Returns patient name, MR number, time, reason, and status.',
    {
      doctorId: z.string().describe('The user ID of the doctor'),
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
    },
    async ({ doctorId, date }) => {
      const result = await getDoctorTodayAppointments(doctorId, date);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'doctor_get_queue',
    'Get real-time token queue for a doctor on a specific date (defaults to today). Shows waiting tokens, current consultation, and completed patients.',
    {
      doctorId: z.string().describe('The user ID of the doctor'),
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
    },
    async ({ doctorId, date }) => {
      const result = await getDoctorQueue(doctorId, date);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'doctor_get_patient_history',
    'Get medical record, demographics, and previous consultations/visits for a patient by ID, MR Number, or Phone.',
    {
      search: z.string().describe('Patient ID, MR Number (e.g. MR-00001), or Phone number'),
    },
    async ({ search }) => {
      const result = await getPatientMedicalHistory(search);
      if (!result) {
        return { content: [{ type: 'text', text: `No patient found matching "${search}".` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'doctor_get_opd_fee_report',
    'Get OPD consultation fees report for a specific doctor. Returns total patients, breakdown of Paid/Half/Free consultations, discounts, refunds, and net earnings for any date range.',
    {
      doctorId: z.string().describe('User ID of the doctor'),
      dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD). Defaults to today.'),
      dateTo: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to dateFrom.'),
    },
    async ({ doctorId, dateFrom, dateTo }) => {
      const result = await getDoctorOpdFeeReport(doctorId, dateFrom, dateTo);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reception_get_daily_report',
    'Get daily shift collection report for the reception desk. Returns BOTH doctor-wise OPD consultation fees collected and clinic invoices billed/collected/outstanding.',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
      dateFrom: z.string().optional().describe('Start date for a range (YYYY-MM-DD)'),
      dateTo: z.string().optional().describe('End date for a range (YYYY-MM-DD)'),
    },
    async ({ date, dateFrom, dateTo }) => {
      const result = await getReceptionDailyReport(date, dateFrom, dateTo);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reception_check_doctor_availability',
    'Check active doctors, their schedules, consultation fees, and attendance status for a given date.',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
      doctorId: z.string().optional().describe('Optional specific doctor ID to check'),
    },
    async ({ date, doctorId }) => {
      const result = await getReceptionDoctorAvailability(date, doctorId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reception_search_patient',
    'Search patient records by name, phone number, or MR number for quick booking or registration lookups.',
    {
      query: z.string().describe('Search query (name, phone, or MR number)'),
    },
    async ({ query }) => {
      const result = await getReceptionPatientSearch(query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reception_get_queue_summary',
    'Get high-level clinic queue status for today: waiting patients, active consultations, completed visits, grouped per doctor.',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
    },
    async ({ date }) => {
      const result = await getReceptionQueueSummary(date);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'admin_get_full_opd_and_revenue_report',
    'Get full comprehensive clinic OPD & revenue report: doctor-wise consultation fees, clinic invoices, payments, refunds, and outstanding receivables for any date range.',
    {
      dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD). Defaults to today.'),
      dateTo: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to dateFrom.'),
      doctorId: z.string().optional().describe('Optional doctor ID filter'),
    },
    async ({ dateFrom, dateTo, doctorId }) => {
      const result = await getAdminFullOpdAndRevenueReport(dateFrom, dateTo, doctorId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'admin_get_clinic_stats',
    'Get overall clinic key performance indicators (KPIs): total appointments, completion rate, monthly revenue, total patients, and top consultation reasons.',
    {},
    async () => {
      const result = await getAdminClinicStats();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'admin_get_unpaid_invoices',
    'Get list of all pending / unpaid or partially paid invoices with patient contact details for follow-up and balance recovery.',
    {
      limit: z.number().optional().describe('Maximum records to return (defaults to 50)'),
    },
    async ({ limit }) => {
      const result = await getAdminUnpaidInvoices(limit);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'pharmacy_search_medicine',
    'Search medicines in the pharmacy inventory by brand name or generic name. Returns available stock, dosage unit, and price.',
    {
      query: z.string().describe('Medicine name (e.g. Panadol, Paracetamol)'),
    },
    async ({ query }) => {
      const result = await getPharmacyMedicineSearch(query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'clinic_search_doctor',
    'Search registered clinic doctors by name, specialization, consultation fees, and weekly schedule.',
    {
      nameQuery: z.string().describe('Doctor name or keyword'),
    },
    async ({ nameQuery }) => {
      const result = await searchDoctorByName(nameQuery);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reception_create_appointment',
    'Book / schedule an appointment for a patient with a specific or available doctor. Automatically resolves conflicting time slots.',
    {
      patientSearch: z.string().describe('Patient name, phone number, or MR number'),
      doctorSearch: z.string().optional().describe('Doctor name or keyword. If omitted, uses active available doctor.'),
      date: z.string().optional().describe('Appointment date (YYYY-MM-DD). Defaults to today.'),
      time: z.string().optional().describe('Appointment time in HH:mm format (e.g. 14:30)'),
      reason: z.string().optional().describe('Consultation reason'),
    },
    async ({ patientSearch, doctorSearch, date, time, reason }) => {
      const result = await bookPatientAppointment({
        patientSearch,
        doctorSearch,
        date,
        time,
        reason,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}
