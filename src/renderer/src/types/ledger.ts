export type LedgerEntryType = 'consultation' | 'invoice' | 'payment' | 'refund';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  description: string;
  reference: string | null;
  /** Billed to the patient on this line. */
  charge: number;
  /** Paid by the patient on this line (negative = refund). */
  credit: number;
  /** Running balance after this line (positive = patient owes the clinic). */
  balance: number;
  invoiceId: string | null;
  method: string | null;
  /** Consultation rows: the token, and how much of its fee is still unpaid. */
  tokenId: string | null;
  tokenDue: number;
}

export interface PatientLedger {
  patientId: string;
  totals: {
    billed: number;
    paid: number;
    /** Positive = dues; negative = advance / credit. */
    due: number;
    openInvoices: number;
    unpaidVisits: number;
  };
  /** Oldest first. */
  entries: LedgerEntry[];
}
