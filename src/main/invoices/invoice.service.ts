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
  discount: number;
  notes?: string | null;
  items: InvoiceItemInput[];
}

const include = { patient: true, items: true } satisfies Prisma.InvoiceInclude;

function serializeInvoice(invoice: Prisma.InvoiceGetPayload<{ include: typeof include }>) {
  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
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
  const total = subtotal - discount;
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
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}
export async function addPayment(invoiceId: string, amount: number, method: string, reference?: string) {
  const database = getPrisma();
  return database.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId,
        amount,
        method: method as import('@prisma/client').PaymentMethod,
        reference: reference?.trim() || null,
        paidAt: new Date(),
      },
    });
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include });
    const totalPaid = Number(invoice.amountPaid) + amount;
    const total = Number(invoice.total);
    const status = totalPaid >= total ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: totalPaid, status, issuedAt: invoice.issuedAt ?? new Date() },
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

export async function getPayments(invoiceId: string) {
  return getPrisma().payment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: 'asc' },
  });
}

export async function createInvoice(input: InvoiceInput) {
  const data = toInvoiceData(input);
  const database = getPrisma();

  return database.$transaction(async (transaction) => {
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

    const result = await transaction.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include });
    return serializeInvoice(result);
  });
}
