export interface ReportSummary {
  todaysPatients: number;
  todaysRevenue: number;
  monthlyRevenue: number;
}

export interface OpdInvoiceRow {
  id: string;
  invoiceNumber: string;
  patientName: string;
  doctors: string;
  status: string;
  total: number;
  amountPaid: number;
  refunded: number;
  outstanding: number;
  createdAt: string;
}

export interface OpdFeeRow {
  id: string;
  tokenNumber: number;
  date: string;
  patientName: string;
  mrNumber: string | null;
  doctorId: string;
  doctorName: string;
  status: string;
  feeType: 'PAID' | 'FREE' | 'HALF' | 'DISCOUNTED' | string;
  consultationFee: number;
  feeDiscount: number;
  feeRefunded: number;
  net: number;
  createdAt: string;
}

export interface OpdDoctorFeeSummary {
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

export interface OpdDailyReport {
  date: string;
  dateFrom: string;
  dateTo: string;
  doctorId: string | null;
  doctorName: string | null;
  invoices: {
    rows: OpdInvoiceRow[];
    count: number;
    billed: number;
    collected: number;
    refunded: number;
    outstanding: number;
  };
  fees: {
    rows: OpdFeeRow[];
    byDoctor: OpdDoctorFeeSummary[];
    count: number;
    paidCount: number;
    halfCount: number;
    freeCount: number;
    collected: number;
    discounted: number;
    refunded: number;
    net: number;
  };
}

export interface OpdReportInput {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  doctorId?: string;
}

export interface ClinicStatisticsOverviewPoint {
  label: string;
  appointments: number;
  revenue: number;
}

export interface ClinicStatisticsReasonPoint {
  label: string;
  fullLabel: string;
  total: number;
  topReason: string;
  topCount: number;
}

export interface ClinicStatistics {
  totalAppointments: number;
  completedAppointments: number;
  completionRate: number;
  totalRevenue: number;
  totalPatients: number;
  overview: {
    weekly: ClinicStatisticsOverviewPoint[];
    monthly: ClinicStatisticsOverviewPoint[];
    yearly: ClinicStatisticsOverviewPoint[];
  };
  monthlyAppointments: { month: string; appointments: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  statusCounts: Record<string, number>;
  reasonYears: number[];
  reasonTrends: {
    byYear: Record<number, ClinicStatisticsReasonPoint[]>;
    byMonth: Record<number, ClinicStatisticsReasonPoint[]>;
  };
}
