import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, app } from 'electron';
import { is } from '@electron-toolkit/utils';

export function initAutoUpdater(): void {
  autoUpdater.logger = console;

  const githubToken = process.env.GH_TOKEN;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Naveed17',
    repo: 'clinic-app',
    ...(githubToken && { token: githubToken })
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('app:check-for-updates', async () => {
    if (is.dev) {
      console.log('[AutoUpdater] Dev mode update check requested. Current version:', app.getVersion());
      return 'latest';
    }
    try {
      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        const currentVersion = autoUpdater.currentVersion.version;
        const latestVersion = result.updateInfo.version;

        if (latestVersion !== currentVersion) {
          void autoUpdater.downloadUpdate();
          return 'available';
        }
      }
      return 'latest';
    } catch (error: any) {
      console.error('AutoUpdater Error:', error);
      return { error: error?.message || 'Failed to check for updates' };
    }
  });

  // Download Progress Listener
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent);
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('app:update-progress', percent);
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('app:update-ready');
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Event Error:', err);
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('app:update-error', err?.message || 'Update failed');
      }
    });
  });

  if (!is.dev) {
    // Initial check on app startup in production
    void autoUpdater.checkForUpdates();

    // Periodic check (every 4 hours)
    setInterval(() => void autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
  }
}