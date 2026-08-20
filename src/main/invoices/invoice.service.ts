import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}
export interface InvoiceInput {
  patientId: string;
  drFee?: number;
  discount: number;
  notes?: string | null;
  items: InvoiceItemInput[];
  /** When set (pharmacy queue bill), link Rx and mark dispensed. */
  tokenId?: string | null;
}

const include = {
  patient: true,
  items: true,
  payments: { select: { amount: true } },
} satisfies Prisma.InvoiceInclude;

function serializeInvoice(invoice: Prisma.InvoiceGetPayload<{ include: typeof include }>) {
  const amountPaid = Number(invoice.amountPaid);
  const hasRefund = invoice.payments.some((p) => Number(p.amount) < 0);
  const status =
    invoice.status !== 'VOID' && invoice.status !== 'DRAFT' && hasRefund && amountPaid <= 0
      ? 'REFUNDED'
      : invoice.status;
  const { payments: _payments, ...rest } = invoice;
  return {
    ...rest,
    status,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    amountPaid,
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

function toInvoiceData(input: InvoiceInput): Omit<Prisma.InvoiceUncheckedCreateInput, 'id'> {
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.max(0, Math.min(input.discount, subtotal));
  const total = Math.max(0, subtotal - discount);
  return {
    patientId: input.patientId,
    invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`,
    subtotal,
    discount,
    total,
    notes: input.notes?.trim() || null,
  };
}

export async function listInvoices() {
  const invoices = await getPrisma().invoice.findMany({ include, orderBy: { createdAt: 'desc' } });
  return invoices.map(serializeInvoice);
}

export async function invoicePatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' }, 
  });
}

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function statusAfterBalance(total: number, paid: number): 'PAID' | 'PARTIALLY_PAID' | 'ISSUED' {
  if (paid >= total && total > 0) return 'PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  return 'ISSUED';
}

export async function addPayment(invoiceId: string, amount: number, method: string, reference?: string) {
  const pay = roundMoney(amount);
  if (!Number.isFinite(pay) || pay <= 0) throw new Error('Payment amount must be greater than 0.');
  const database = getPrisma();
  return database.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include });
    if (invoice.status === 'VOID') throw new Error('Cannot record payment on a voided invoice.');
    await tx.payment.create({
      data: {
        invoiceId,
        amount: pay,
        method: method as import('@prisma/client').PaymentMethod,
        reference: reference?.trim() || null,
        paidAt: new Date(),
      },
    });
    const totalPaid = roundMoney(Number(invoice.amountPaid) + pay);
    const status = statusAfterBalance(Number(invoice.total), totalPaid);
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: totalPaid, status, issuedAt: invoice.issuedAt ?? new Date() },
      include,
    });
    return serializeInvoice(updated);
  });
}

export async function refundPayment(
  invoiceId: string,
  amount: number,
  method: string,
  reason?: string,
) {
  const refund = roundMoney(amount);
  if (!Number.isFinite(refund) || refund <= 0) throw new Error('Refund amount must be greater than 0.');
  const database = getPrisma();
  return database.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include });
    if (invoice.status === 'VOID') throw new Error('Cannot refund a voided invoice.');
    const paid = roundMoney(Number(invoice.amountPaid));
    if (paid <= 0) throw new Error('Nothing to refund on this invoice.');
    if (refund > paid) throw new Error('Refund cannot exceed the amount paid.');

    const note = reason?.trim() ? `Refund: ${reason.trim()}` : 'Refund';
    await tx.payment.create({
      data: {
        invoiceId,
        amount: -refund,
        method: method as import('@prisma/client').PaymentMethod,
        reference: reason?.trim() || null,
        notes: note,
        paidAt: new Date(),
      },
    });
    const totalPaid = roundMoney(paid - refund);
    const status = statusAfterBalance(Number(invoice.total), totalPaid);
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: totalPaid, status },
      include,
    });
    return serializeInvoice(updated);
  });
}

export async function voidInvoice(id: string) {
  const invoice = await getPrisma().invoice.update({
    where: { id },
    data: { status: 'VOID' },
    include,
  });
  return serializeInvoice(invoice);
}

export async function deleteInvoice(id: string): Promise<void> {
  const database = getPrisma();
  await database.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.delete({ where: { id } });
  });
}

export async function getPayments(invoiceId: string) {
  const payments = await getPrisma().payment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: 'desc' },
  });
  return payments.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    amount: Number(p.amount),
    method: p.method,
    paidAt: p.paidAt.toISOString(),
    reference: p.reference,
    notes: p.notes,
  }));
}

export async function createInvoice(input: InvoiceInput) {
  const data = toInvoiceData(input);
  const database = getPrisma();

  const result = await database.$transaction(async (transaction) => {
    const invoice = await transaction.invoice.create({ data });
    await transaction.invoiceItem.createMany({
      data: input.items.map((item) => ({
        invoiceId: invoice.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
    });

    return serializeInvoice(
      await transaction.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include }),
    );
  });

  return result;
}