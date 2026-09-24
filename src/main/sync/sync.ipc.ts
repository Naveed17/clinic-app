import { ipcMain } from 'electron';
import { getSyncStatus, triggerSync, resolvePeerUrl } from './sync.service';

export function registerSyncIpc(): void {
  ipcMain.handle('sync:status', () => getSyncStatus());
  ipcMain.handle('sync:trigger', async (_e, customPeerUrl?: string) => {
    return await triggerSync({ customPeerUrl });
  });
  ipcMain.handle('sync:resolve-peer', () => resolvePeerUrl());
}
