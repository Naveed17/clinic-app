import { ipcMain } from 'electron';
import { createLabOrder, labPatients, listLabOrders, saveLabResult, updateLabOrderStatus } from './lab.service';

export function registerLabIpc(): void {
  ipcMain.handle('lab:list', () => listLabOrders());
  ipcMain.handle('lab:patients', () => labPatients());
  ipcMain.handle('lab:create', (_e, input) => createLabOrder(input));
  ipcMain.handle('lab:update-status', (_e, id, status) => updateLabOrderStatus(id, status));
  ipcMain.handle('lab:save-result', (_e, id, result) => saveLabResult(id, result));
}
