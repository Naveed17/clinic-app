export interface SearchPatient {
  id: string;
  mrNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  bloodGroup: string | null;
  createdAt: string;
}

export interface SearchAppointment {
  id: string;
  reason: string | null;
  status: string;
  startsAt: string;
  patientId: string;
  patientName: string;
  patientMrNumber: string;
  providerName: string;
}

export interface SearchInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  patientId: string;
  patientName: string;
  patientMrNumber: string;
  createdAt: string;
}

export interface SearchLabOrder {
  id: string;
  test: string;
  status: string;
  patientId: string;
  patientName: string;
  patientMrNumber: string;
  orderedAt: string;
}

export interface GlobalSearchResult {
  patients: SearchPatient[];
  appointments: SearchAppointment[];
  invoices: SearchInvoice[];
  labOrders: SearchLabOrder[];
}
