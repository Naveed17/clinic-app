import { BrowserWindow, ipcMain } from 'electron';
import { createInvoice, invoicePatients, listInvoices, addPayment, voidInvoice, getPayments } from './invoice.service';

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
  ipcMain.handle('invoices:void', (_, id: string) => voidInvoice(id));
  ipcMain.handle('invoices:payments', (_, invoiceId: string) => getPayments(invoiceId));
  ipcMain.handle('invoices:print', () =>
    BrowserWindow.getFocusedWindow()?.webContents.print({ printBackground: true }),
  );
}
