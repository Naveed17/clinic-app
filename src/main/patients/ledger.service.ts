import { getPrisma } from '../database/client';

/**
 * Patient ledger: every charge and payment for one patient in date order, with a running
 * balance and the outstanding dues.
 *
 * Sources
 *  - OPD tokens: consultation fee − discount − refunded is the charge. The payment is what was
 *    taken at the counter (feePaid; NULL = paid in full, which is every older token) plus any
 *    later collection (feeCollected, shown as its own line on feeCollectedAt).
 *  - Invoices (all statuses except VOID, not deleted — new invoices stay DRAFT until the first
 *    payment, but they are still owed): one charge line for the invoice total.
 *  - Invoice payments: one credit line each (refunds are stored as negative payments).
 */

export type LedgerEntryType = 'consultation' | 'invoice' | 'payment' | 'refund';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  description: string;
  reference: string | null;
  /** Amount billed to the patient on this line. */
  charge: number;
  /** Amount paid by the patient on this line (negative for refunds). */
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
    /** billed − paid. Positive = dues; negative = advance / credit with the clinic. */
    due: number;
    openInvoices: number;
    /** Tokens whose consultation fee is not fully paid yet. */
    unpaidVisits: number;
  };
  /** Oldest first, so the running balance reads top to bottom. */
  entries: LedgerEntry[];
}

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function toIso(value: unknown, fallback?: string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'bigint') return new Date(Number(value)).toISOString();
  if (typeof value === 'string' && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback ?? new Date(0).toISOString();
}

type TokenRow = {
  id: string;
  tokenNumber: number | bigint | null;
  date: string | null;
  status: string | null;
  consultationFee: number | null;
  feeDiscount: number | null;
  feeRefunded: number | null;
  feePaid: number | null;
  feeCollected: number | null;
  feeCollectedAt: unknown;
  createdAt: unknown;
  firstName: string | null;
  lastName: string | null;
};

export async function getPatientLedger(patientId: string): Promise<PatientLedger> {
  const db = getPrisma();
  const raw: Omit<LedgerEntry, 'balance'>[] = [];

  // 1. OPD consultations (raw SQL: fee columns are added by migrations, not in the Prisma model).
  const tokens = await db.$queryRawUnsafe<TokenRow[]>(
    `SELECT t.id, t."tokenNumber", t."date", t."status", t."consultationFee", t."feeDiscount", t."feeRefunded",
            t."feePaid", t."feeCollected", t."feeCollectedAt", t."createdAt", u."firstName", u."lastName"
       FROM "Token" t
       LEFT JOIN "User" u ON u.id = t."doctorId"
      WHERE t."patientId" = ? AND COALESCE(t."status", '') <> 'CANCELLED'`,
    patientId,
  );
  for (const t of tokens) {
    const fee = round(Number(t.consultationFee) || 0);
    const discount = round(Number(t.feeDiscount) || 0);
    const refunded = round(Number(t.feeRefunded) || 0);
    const net = round(Math.max(0, fee - discount - refunded));
    if (fee <= 0 && refunded <= 0) continue; // free visit: nothing to show in the money ledger
    const doctor = [t.firstName, t.lastName].filter(Boolean).join(' ').trim();
    const extras = [
      discount > 0 ? `discount Rs ${discount}` : '',
      refunded > 0 ? `refunded Rs ${refunded}` : '',
    ].filter(Boolean);
    // Token "date" is the visit day (YYYY-MM-DD); keep createdAt's time for ordering within that day.
    const created = toIso(t.createdAt);
    const date = t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && !created.startsWith(t.date)
      ? new Date(`${t.date}T09:00:00`).toISOString()
      : created;
    const paidAtIssue = t.feePaid === null || t.feePaid === undefined ? net : round(Math.min(net, Number(t.feePaid) || 0));
    const collected = round(Math.min(Math.max(0, net - paidAtIssue), Number(t.feeCollected) || 0));
    const tokenDue = round(Math.max(0, net - paidAtIssue - collected));
    const tokenRef = t.tokenNumber != null ? `Token #${Number(t.tokenNumber)}` : null;
    if (paidAtIssue < net) extras.push(paidAtIssue > 0 ? `paid Rs ${paidAtIssue} at visit` : 'unpaid at visit');
    raw.push({
      id: `token-${t.id}`,
      date,
      type: 'consultation',
      description: `Consultation${doctor ? ` — Dr. ${doctor}` : ''}${extras.length ? ` (${extras.join(', ')})` : ''}`,
      reference: tokenRef,
      charge: net,
      credit: paidAtIssue,
      invoiceId: null,
      method: paidAtIssue > 0 ? 'CASH' : null,
      tokenId: t.id,
      tokenDue,
    });
    if (collected > 0) {
      raw.push({
        id: `token-collect-${t.id}`,
        // Never before the visit itself, so the running balance stays in order.
        date: (() => {
          const at = toIso(t.feeCollectedAt, date);
          return at < date ? date : at;
        })(),
        type: 'payment',
        description: 'Consultation fee collected',
        reference: tokenRef,
        charge: 0,
        credit: collected,
        invoiceId: null,
        method: 'CASH',
        tokenId: t.id,
        tokenDue: 0,
      });
    }
  }

  // 2. Invoices + their payments.
  const invoices = await db.invoice.findMany({
    where: { patientId, isDeleted: false, status: { not: 'VOID' } },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      items: { select: { description: true } },
      payments: { select: { id: true, amount: true, method: true, paidAt: true, reference: true, notes: true } },
    },
  });
  let openInvoices = 0;
  for (const inv of invoices) {
    const total = round(Number(inv.total));
    const paid = round(inv.payments.reduce((s, p) => s + Number(p.amount), 0));
    if (total - paid > 0.009) openInvoices++;
    const items = inv.items.map((i) => i.description).filter(Boolean);
    raw.push({
      id: `invoice-${inv.id}`,
      date: toIso(inv.issuedAt ?? inv.createdAt),
      type: 'invoice',
      description: items.length
        ? `Invoice — ${items.slice(0, 3).join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`
        : 'Invoice',
      reference: inv.invoiceNumber,
      charge: total,
      credit: 0,
      invoiceId: inv.id,
      method: null,
      tokenId: null,
      tokenDue: 0,
    });
    for (const p of inv.payments) {
      const amount = round(Number(p.amount));
      const isRefund = amount < 0;
      raw.push({
        id: `payment-${p.id}`,
        date: toIso(p.paidAt),
        type: isRefund ? 'refund' : 'payment',
        description: isRefund ? p.notes || 'Refund' : `Payment for ${inv.invoiceNumber}`,
        reference: p.reference || inv.invoiceNumber,
        charge: 0,
        credit: amount,
        invoiceId: inv.id,
        method: p.method ?? null,
        tokenId: null,
        tokenDue: 0,
      });
    }
  }

  // 3. Oldest first; on the same timestamp put charges before their payments.
  const typeOrder: Record<LedgerEntryType, number> = { invoice: 0, consultation: 1, payment: 2, refund: 3 };
  raw.sort((a, b) => a.date.localeCompare(b.date) || typeOrder[a.type] - typeOrder[b.type]);

  let balance = 0;
  let billed = 0;
  let paid = 0;
  const entries: LedgerEntry[] = raw.map((e) => {
    billed += e.charge;
    paid += e.credit;
    balance = round(balance + e.charge - e.credit);
    return { ...e, balance };
  });

  const unpaidVisits = entries.filter((e) => e.type === 'consultation' && e.tokenDue > 0).length;
  return {
    patientId,
    totals: { billed: round(billed), paid: round(paid), due: round(billed - paid), openInvoices, unpaidVisits },
    entries,
  };
}
