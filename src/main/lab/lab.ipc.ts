import { ipcMain } from 'electron';
import { createLabOrder, labPatients, listLabOrders, listLabOrdersByToken, saveLabResult, updateLabOrderStatus } from './lab.service';

export function registerLabIpc(): void {
  ipcMain.handle('lab:list', () => listLabOrders());
  ipcMain.handle('lab:list-by-token', (_e, tokenId) => listLabOrdersByToken(tokenId));
  ipcMain.handle('lab:patients', () => labPatients());
  ipcMain.handle('lab:create', (_e, input) => createLabOrder(input));
  ipcMain.handle('lab:update-status', (_e, id, status) => updateLabOrderStatus(id, status));
  ipcMain.handle('lab:save-result', (_e, id, result) => saveLabResult(id, result));
}
