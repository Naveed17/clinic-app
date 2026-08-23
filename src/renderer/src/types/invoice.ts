export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
  notes: string | null;
}

export interface InvoicePerson {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  mrNumber?: string | null;
}
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'VOID';
  patient: InvoicePerson;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  notes: string | null;
  createdAt: string;
  items: InvoiceItem[];
}
export interface InvoiceInput {
  patientId: string;
  discount: number;
  notes?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  tokenId?: string | null;
}
export interface InvoiceUpdateInput {
  discount: number;
  notes?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
}
