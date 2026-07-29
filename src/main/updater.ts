import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';

export function initAutoUpdater(): void {
  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('app:check-for-updates', async () => {
    if (is.dev) return 'latest';
    try {
      const result = await autoUpdater.checkForUpdates();
      return result ? 'available' : 'latest';
    } catch {
      return 'error';
    }
  });

  if (is.dev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('app:update-ready'),
    );
  });

  autoUpdater.on('error', () => {});

  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}
