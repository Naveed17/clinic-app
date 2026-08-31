import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { is } from '@electron-toolkit/utils';

let splashWindow: BrowserWindow | null = null;

function getBannerBase64(): string {
  const possiblePaths = [
    join(__dirname, '../../src/main/assets/careflow-installer-banner.png'),
    join(__dirname, '../assets/careflow-installer-banner.png'),
    join(app.getAppPath(), 'src/main/assets/careflow-installer-banner.png'),
    join(process.resourcesPath || '', 'assets/careflow-installer-banner.png'),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      try {
        return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
      } catch {
        /* fallback */
      }
    }
  }
  return '';
}

function getIconPath(): string {
  const possiblePaths = [
    join(__dirname, '../../src/main/assets/icons/icon.png'),
    join(__dirname, '../assets/icons/icon.png'),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }
  return '';
}

function buildSplashHtml(): string {
  const bannerBase64 = getBannerBase64();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: transparent;
    overflow: hidden;
    width: 620px;
    height: 400px;
  }
  .card {
    width: 620px;
    height: 400px;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  /* Top banner area */
  .banner {
    width: 100%;
    height: 290px;
    position: relative;
    background: #eaf7f9;
    -webkit-app-region: drag;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .banner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }
  /* Top-right window controls */
  .window-controls {
    position: absolute;
    top: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 10;
    -webkit-app-region: no-drag;
  }
  .win-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    color: #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    transition: all 0.15s ease;
  }
  .win-btn:hover {
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  .win-btn.close:hover {
    background: #ef4444;
    color: #ffffff;
  }
  /* Bottom section */
  .footer {
    height: 110px;
    background: #ffffff;
    padding: 20px 28px 22px 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .status-container {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }
  .status-text {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    white-space: nowrap;
  }
  .status-detail {
    font-size: 12px;
    font-weight: 400;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cancel-btn {
    font-size: 13.5px;
    font-weight: 500;
    color: #3b82f6;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: none;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }
  .cancel-btn:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }
  /* Progress bar */
  .progress-track {
    width: 100%;
    height: 6px;
    background: #f1f5f9;
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #10b981 0%, #22c55e 100%);
    border-radius: 9999px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  }
</style>
</head>
<body>
  <div class="card">
    <div class="banner">
      ${bannerBase64 ? `<img src="${bannerBase64}" alt="CareFlow" />` : ''}
      <div class="window-controls">
        <button class="win-btn" id="btn-min" title="Minimize">―</button>
        <button class="win-btn close" id="btn-close" title="Close">✕</button>
      </div>
    </div>
    <div class="footer">
      <div class="footer-row">
        <div class="status-container">
          <span class="status-text">
            <span id="label">Installing</span>
            <span id="percent">(0%)</span>
          </span>
          <span class="status-detail" id="detail">Starting CareFlow...</span>
        </div>
        <button class="cancel-btn" id="btn-cancel">Cancel</button>
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="bar"></div>
      </div>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    document.getElementById('btn-min').addEventListener('click', () => ipcRenderer.send('splash:minimize'));
    document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('splash:close'));
    document.getElementById('btn-cancel').addEventListener('click', () => ipcRenderer.send('splash:close'));

    ipcRenderer.on('splash:update', (_, data) => {
      if (typeof data.progress === 'number') {
        const p = Math.min(100, Math.max(0, Math.round(data.progress)));
        document.getElementById('bar').style.width = p + '%';
        document.getElementById('percent').textContent = '(' + p + '%)';
      }
      if (data.text) document.getElementById('label').textContent = data.text;
      if (data.detail) document.getElementById('detail').textContent = data.detail;
    });
  </script>
</body>
</html>`;
}

export function createSplashWindow(): BrowserWindow {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  const iconPath = getIconPath();

  splashWindow = new BrowserWindow({
    width: 620,
    height: 400,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    icon: iconPath || undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  splashWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const html = buildSplashHtml();
  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });

  return splashWindow;
}

export function updateSplashProgress(progress: number, detail?: string, text?: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:update', { progress, detail, text });
  }
}

export function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    // Smooth transition
    updateSplashProgress(100, 'CareFlow is ready!', 'Installing');
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 450);
  }
}

export function initSplashIpc(): void {
  ipcMain.on('splash:minimize', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.minimize();
    }
  });

  ipcMain.on('splash:close', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    app.quit();
  });
}
