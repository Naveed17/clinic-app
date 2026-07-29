import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';

export function initAutoUpdater(): void {
  if (is.dev) return; // skip in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('app:update-ready'),
    );
  });

  // Silently ignore errors (no crash if offline / no release yet)
  autoUpdater.on('error', () => {});

  // Check on startup, then every 4 hours
  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
  });
}
