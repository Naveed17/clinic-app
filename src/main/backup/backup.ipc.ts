import { ipcMain, dialog, app } from 'electron';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { disconnectPrisma, getPrisma } from '../database/client';

function getDbPath(): string {
  return join(app.getPath('userData'), 'clinic.db');
}

export function registerBackupIpc(): void {
  ipcMain.handle('backup:create', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Backup',
      defaultPath: `clinic-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      await disconnectPrisma();
      copyFileSync(getDbPath(), filePath);
      // reconnect
      getPrisma();
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Backup failed.' };
    }
  });

  ipcMain.handle('backup:restore', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup File',
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return { ok: false, canceled: true };
    try {
      await disconnectPrisma();
      copyFileSync(filePaths[0], getDbPath());
      getPrisma();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Restore failed.' };
    }
  });
}
