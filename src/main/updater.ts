import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, app } from 'electron';
import { is } from '@electron-toolkit/utils';

// Guard: ek waqt mein sirf ek check/download chalti rahe
let _isChecking = false;
let _isDownloading = false;

function broadcastToAll(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, ...args);
  });
}

export function initAutoUpdater(): void {
  autoUpdater.logger = console;

  const githubToken = process.env.GH_TOKEN;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Naveed17',
    repo: 'clinic-app',
    ...(githubToken && { token: githubToken })
  });

  // autoDownload false rakho — hum manually control karein ge
  // taake background silent download aur manual check conflict na karein
  autoUpdater.autoDownload = false;
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

    // Agar pehle se check ya download chal rahi hai toh duplicate request ignore karo
    if (_isChecking || _isDownloading) {
      console.log('[AutoUpdater] Check already in progress — ignoring duplicate request.');
      return _isDownloading ? 'available' : 'checking';
    }

    _isChecking = true;
    try {
      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        const currentVersion = autoUpdater.currentVersion.version;
        const latestVersion = result.updateInfo.version;

        if (latestVersion !== currentVersion) {
          // Naya version mila — ab download shuru karo
          if (!_isDownloading) {
            _isDownloading = true;
            void autoUpdater.downloadUpdate();
          }
          return 'available';
        }
      }
      return 'latest';
    } catch (error: any) {
      console.error('AutoUpdater Error:', error);
      return { error: error?.message || 'Failed to check for updates' };
    } finally {
      _isChecking = false;
    }
  });

  // Update Available Event (silent background check se)
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info?.version);
    if (!_isDownloading) {
      _isDownloading = true;
      void autoUpdater.downloadUpdate();
    }
    broadcastToAll('app:update-available', info?.version || true);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Already on latest version.');
    _isDownloading = false;
  });

  // Download Progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent);
    broadcastToAll('app:update-progress', percent);
  });

  autoUpdater.on('update-downloaded', () => {
    _isDownloading = false;
    broadcastToAll('app:update-ready');
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Event Error:', err);
    _isChecking = false;
    _isDownloading = false;
    broadcastToAll('app:update-error', err?.message || 'Update failed');
  });

  if (!is.dev) {
    // App ready hone ke 2 minute baad silent background check — window load hone ka waqt de
    setTimeout(() => {
      if (!_isChecking && !_isDownloading) {
        console.log('[AutoUpdater] Running startup background check...');
        void autoUpdater.checkForUpdates();
      }
    }, 2 * 60 * 1000); // 2 minutes delay

    // Periodic check (har 4 ghante) — sirf tab jab kuch chal nahi raha
    setInterval(() => {
      if (!_isChecking && !_isDownloading) {
        void autoUpdater.checkForUpdates();
      }
    }, 4 * 60 * 60 * 1000);
  }
}