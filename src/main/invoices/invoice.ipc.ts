import { ipcMain } from 'electron';
import { createInvoice, invoicePatients, listInvoices, addPayment, refundPayment, voidInvoice, deleteInvoice, getPayments } from './invoice.service';

export function registerInvoiceIpc(): void {
  ipcMain.handle('invoices:list', () => listInvoices());
  ipcMain.handle('invoices:patients', () => invoicePatients());
  ipcMain.handle('invoices:create', async (_, input) => {
    try { return await createInvoice(input); }
    catch (error) { throw new Error(error instanceof Error ? error.message : 'Unable to create the invoice.'); }
  });
  ipcMain.handle('invoices:add-payment', async (_, invoiceId, amount, method, reference) =>
    addPayment(invoiceId, amount, method, reference),
  );
  ipcMain.handle('invoices:refund', async (_, invoiceId, amount, method, reason) =>
    refundPayment(invoiceId, amount, method, reason),
  );
  ipcMain.handle('invoices:void', (_, id: string) => voidInvoice(id));
  ipcMain.handle('invoices:delete', (_, id: string) => deleteInvoice(id));
  ipcMain.handle('invoices:payments', async (_, invoiceId: string) =>
    JSON.parse(JSON.stringify(await getPayments(invoiceId))),
  );
}
