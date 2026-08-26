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
