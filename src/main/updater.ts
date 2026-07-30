import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
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

  // Manual Install Trigger
  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Manual Check Trigger from Frontend
  ipcMain.handle('app:check-for-updates', async () => {
    if (is.dev) return 'latest';
    try {
      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        const currentVersion = autoUpdater.currentVersion.version;
        const latestVersion = result.updateInfo.version;
        
        if (latestVersion !== currentVersion) {
          return 'available';
        }
      }
      return 'latest';
    } catch (error) {
      console.error('AutoUpdater Error:', error);
      return 'error';
    }
  });

  if (is.dev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('app:update-ready')
    );
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Event Error:', err);
  });

  // 1. Initial check jab app start ho
  void autoUpdater.checkForUpdates();

  setInterval(() => void autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}