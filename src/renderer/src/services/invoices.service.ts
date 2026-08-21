import type { InvoiceInput } from '@/types/invoice';
export const invoicesService = {
  list: () => window.clinic.invoices.list(),
  get: (id: string) => window.clinic.invoices.get(id),
  patients: () => window.clinic.invoices.patients(),
  create: (input: InvoiceInput) => window.clinic.invoices.create(input),
  addPayment: (invoiceId: string, amount: number, method: string, reference?: string) =>
    window.clinic.invoices.addPayment(invoiceId, amount, method, reference),
  refund: (invoiceId: string, amount: number, method: string, reason?: string) =>
    window.clinic.invoices.refund(invoiceId, amount, method, reason),
  void: (id: string) => window.clinic.invoices.void(id),
  delete: (id: string) => window.clinic.invoices.delete(id),
  payments: (invoiceId: string) => window.clinic.invoices.payments(invoiceId),
};
