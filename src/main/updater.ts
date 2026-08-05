import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, app } from 'electron';
import { is } from '@electron-toolkit/utils';

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

  // Manual download control active
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('app:check-for-updates', async () => {
    if (is.dev) {
      console.log('[AutoUpdater] Dev mode check requested. Version:', app.getVersion());
      return 'latest';
    }

    if (_isChecking || _isDownloading) {
      console.log('[AutoUpdater] Check/Download already in progress.');
      return _isDownloading ? 'available' : 'checking';
    }

    _isChecking = true;
    try {
      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        const currentVersion = autoUpdater.currentVersion.version;
        const latestVersion = result.updateInfo.version;

        if (latestVersion !== currentVersion) {
          // Trigger download directly from here ONLY if not downloading
          if (!_isDownloading) {
            _isDownloading = true;
            autoUpdater.downloadUpdate().catch((err) => {
              console.error('[AutoUpdater] Download initiation error:', err);
              _isDownloading = false;
              broadcastToAll('app:update-error', err?.message || 'Failed to start download');
            });
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

  // Update Available Event - Just broadcast UI status, do not trigger downloadUpdate again
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info?.version);
    broadcastToAll('app:update-available', info?.version || true);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Already on latest version.');
    _isChecking = false;
    _isDownloading = false;
  });

  // Download Progress Fix - Send raw rounded percent + speed check
  autoUpdater.on('download-progress', (progressObj) => {
    _isDownloading = true;
    const percent = Math.round(progressObj.percent);
    broadcastToAll('app:update-progress', percent);
  });

  autoUpdater.on('update-downloaded', () => {
    _isChecking = false;
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
    // 30 seconds initial delay instead of 2 minutes to feel fast
    setTimeout(() => {
      if (!_isChecking && !_isDownloading) {
        console.log('[AutoUpdater] Running startup background check...');
        void autoUpdater.checkForUpdates();
      }
    }, 30 * 1000);

    // Periodic check (every 4 hours)
    setInterval(() => {
      if (!_isChecking && !_isDownloading) {
        void autoUpdater.checkForUpdates();
      }
    }, 4 * 60 * 60 * 1000);
  }
}