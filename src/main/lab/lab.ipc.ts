import { ipcMain } from 'electron';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { createLabOrder, labPatients, listLabOrders, listLabOrdersByToken, saveLabResult, updateLabOrderStatus } from './lab.service';

function assertLabAddon(): void {
  if (!isLicenseModuleEnabled('labDashboard')) {
    throw new Error('Lab add-on is not enabled for this license.');
  }
}

export function registerLabIpc(): void {
  ipcMain.handle('lab:list', () => {
    assertLabAddon();
    return listLabOrders();
  });
  ipcMain.handle('lab:list-by-token', (_e, tokenId) => {
    assertLabAddon();
    return listLabOrdersByToken(tokenId);
  });
  ipcMain.handle('lab:patients', () => {
    assertLabAddon();
    return labPatients();
  });
  ipcMain.handle('lab:create', (_e, input) => {
    assertLabAddon();
    return createLabOrder(input);
  });
  ipcMain.handle('lab:update-status', (_e, id, status) => {
    assertLabAddon();
    return updateLabOrderStatus(id, status);
  });
  ipcMain.handle('lab:save-result', (_e, id, result) => {
    assertLabAddon();
    return saveLabResult(id, result);
  });
}
