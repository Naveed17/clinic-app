import type { InvoiceInput } from '@/types/invoice';
export const invoicesService = {
  list: () => window.clinic.invoices.list(),
  patients: () => window.clinic.invoices.patients(),
  create: (input: InvoiceInput) => window.clinic.invoices.create(input),
  addPayment: (invoiceId: string, amount: number, method: string, reference?: string) =>
    window.clinic.invoices.addPayment(invoiceId, amount, method, reference),
  print: () => window.clinic.invoices.print(),
};
