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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: transparent;
    overflow: hidden;
    width: 620px;
    height: 400px;
  }
  .card {
    width: 620px;
    height: 400px;
    border-radius: 20px;
    background: radial-gradient(120% 120% at 50% 25%, #081432 0%, #040817 60%, #02040a 100%);
    border: 1px solid rgba(56, 189, 248, 0.2);
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 50px rgba(37, 99, 235, 0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    -webkit-app-region: drag;
  }
  /* Ambient Background Lighting */
  .ambient-glow {
    position: absolute;
    width: 380px;
    height: 380px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, rgba(56, 189, 248, 0.12) 40%, transparent 70%);
    top: 45px;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    filter: blur(35px);
    animation: ambientPulse 4s ease-in-out infinite alternate;
  }
  @keyframes ambientPulse {
    0% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.95); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
  }

  /* Top-right window controls */
  .window-controls {
    position: absolute;
    top: 14px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 20;
    -webkit-app-region: no-drag;
  }
  .win-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .win-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }
  .win-btn.close:hover {
    background: rgba(239, 68, 68, 0.85);
    color: #ffffff;
    border-color: rgba(239, 68, 68, 1);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  }

  /* Main Hero Container */
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 24px;
    position: relative;
    z-index: 10;
  }

  /* 3D Isometric Emblem Container */
  .emblem-wrapper {
    position: relative;
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  .emblem-svg {
    width: 140px;
    height: 140px;
    overflow: visible;
  }

  /* Layer Floating Animations */
  .layer-top {
    animation: floatTop 4s ease-in-out infinite alternate;
  }
  .layer-mid {
    animation: floatMid 4s ease-in-out infinite alternate;
  }
  .layer-bot {
    animation: floatBot 4s ease-in-out infinite alternate;
  }
  @keyframes floatTop {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-7px); }
  }
  @keyframes floatMid {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-3.5px); }
  }
  @keyframes floatBot {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-1px); }
  }

  /* Brand Typography */
  .brand-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.28em;
    text-indent: 0.28em;
    text-transform: uppercase;
    color: #ffffff;
    text-shadow: 0 2px 14px rgba(56, 189, 248, 0.35);
    margin-bottom: 4px;
  }
  .brand-subtitle {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-indent: 0.32em;
    text-transform: uppercase;
    color: #38bdf8;
    opacity: 0.92;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-subtitle::before,
  .brand-subtitle::after {
    content: '';
    display: inline-block;
    width: 14px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #38bdf8);
  }
  .brand-subtitle::after {
    background: linear-gradient(90deg, #38bdf8, transparent);
  }

  /* Bottom Progress Section */
  .footer {
    padding: 0 34px 26px 34px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 10;
  }
  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }
  .status-info {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    overflow: hidden;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8, 0 0 14px rgba(56, 189, 248, 0.6);
    animation: pulseDot 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.85); }
  }
  .status-detail {
    color: #cbd5e1;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.02em;
  }
  .status-percent {
    color: #38bdf8;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  /* Progress Track & Fill */
  .progress-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .progress-fill {
    height: 100%;
    width: 12%;
    background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 45%, #38bdf8 85%, #a5f3fc 100%);
    border-radius: 9999px;
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: 0 0 14px rgba(56, 189, 248, 0.6), 0 0 5px rgba(37, 99, 235, 0.8);
  }
  .progress-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
    animation: shimmer 1.8s infinite;
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #64748b;
  }
  .meta-phase {
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .cancel-link {
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: color 0.15s;
    -webkit-app-region: no-drag;
    text-decoration: none;
  }
  .cancel-link:hover {
    color: #f43f5e;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="ambient-glow"></div>

    <div class="window-controls">
      <button class="win-btn" id="btn-min" title="Minimize">―</button>
      <button class="win-btn close" id="btn-close" title="Close">✕</button>
    </div>

    <div class="hero">
      <div class="emblem-wrapper">
        <svg class="emblem-svg" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- Drop Shadow for base layer -->
            <filter id="botShadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.75" />
            </filter>

            <!-- Gradients for Layer 3 (Bottom - Deep Sapphire) -->
            <linearGradient id="l3Top" x1="25" y1="92" x2="135" y2="128" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="60%" stop-color="#1d4ed8" />
              <stop offset="100%" stop-color="#2563eb" />
            </linearGradient>
            <linearGradient id="l3Left" x1="25" y1="110" x2="80" y2="132" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#0f172a" />
              <stop offset="100%" stop-color="#172554" />
            </linearGradient>
            <linearGradient id="l3Right" x1="80" y1="132" x2="135" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="100%" stop-color="#1d4ed8" />
            </linearGradient>

            <!-- Gradients for Layer 2 (Middle - Electric Cobalt) -->
            <linearGradient id="l2Top" x1="25" y1="64" x2="135" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="60%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#60a5fa" />
            </linearGradient>
            <linearGradient id="l2Left" x1="25" y1="82" x2="80" y2="104" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#172554" />
              <stop offset="100%" stop-color="#1e40af" />
            </linearGradient>
            <linearGradient id="l2Right" x1="80" y1="104" x2="135" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1d4ed8" />
              <stop offset="100%" stop-color="#2563eb" />
            </linearGradient>

            <!-- Gradients for Layer 1 (Top - Translucent Ice Cyan) -->
            <linearGradient id="l1Top" x1="25" y1="36" x2="135" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="50%" stop-color="#7dd3fc" />
              <stop offset="100%" stop-color="#bae6fd" />
            </linearGradient>
            <linearGradient id="l1Left" x1="25" y1="54" x2="80" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#0284c7" />
              <stop offset="100%" stop-color="#0ea5e9" />
            </linearGradient>
            <linearGradient id="l1Right" x1="80" y1="76" x2="135" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#0369a1" />
              <stop offset="100%" stop-color="#0284c7" />
            </linearGradient>

            <!-- Subtle top highlight for 3D glass rim -->
            <linearGradient id="rimGlow" x1="25" y1="46" x2="135" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="rgba(255,255,255,0.7)" />
              <stop offset="50%" stop-color="rgba(255,255,255,0.95)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
            </linearGradient>
          </defs>

          <!-- Layer 3 (Bottom) -->
          <g class="layer-bot" filter="url(#botShadow)">
            <path d="M 26 106 L 80 128 L 80 138 L 26 116 Z" fill="url(#l3Left)" />
            <path d="M 80 128 L 134 106 L 134 116 L 80 138 Z" fill="url(#l3Right)" />
            <path d="M 80 84 L 134 106 L 80 128 L 26 106 Z" fill="url(#l3Top)" stroke="rgba(96,165,250,0.3)" stroke-width="0.8" />
          </g>

          <!-- Layer 2 (Middle) -->
          <g class="layer-mid">
            <path d="M 26 78 L 80 100 L 80 110 L 26 88 Z" fill="url(#l2Left)" />
            <path d="M 80 100 L 134 78 L 134 88 L 80 110 Z" fill="url(#l2Right)" />
            <path d="M 80 56 L 134 78 L 80 100 L 26 78 Z" fill="url(#l2Top)" stroke="rgba(147,197,253,0.45)" stroke-width="0.8" />
          </g>

          <!-- Layer 1 (Top) -->
          <g class="layer-top">
            <path d="M 26 50 L 80 72 L 80 82 L 26 60 Z" fill="url(#l1Left)" />
            <path d="M 80 72 L 134 50 L 134 60 L 80 82 Z" fill="url(#l1Right)" />
            <path d="M 80 28 L 134 50 L 80 72 L 26 50 Z" fill="url(#l1Top)" stroke="url(#rimGlow)" stroke-width="1.2" />

            <!-- Medical Cross Emblem glowing at center of top plate -->
            <g transform="translate(80, 50)">
              <rect x="-10" y="-3" width="20" height="6" rx="2" fill="#ffffff" opacity="0.95" />
              <rect x="-3" y="-10" width="6" height="20" rx="2" fill="#ffffff" opacity="0.95" />
              <circle cx="0" cy="0" r="4" fill="#bae6fd" opacity="0.8" />
            </g>
          </g>
        </svg>
      </div>

      <h1 class="brand-title">CAREFLOW</h1>
      <div class="brand-subtitle">CLINICAL INTELLIGENCE OS</div>
    </div>

    <div class="footer">
      <div class="status-row">
        <div class="status-info">
          <div class="status-dot"></div>
          <span class="status-detail" id="detail">Starting clinic services...</span>
        </div>
        <span class="status-percent" id="percent">0%</span>
      </div>

      <div class="progress-track">
        <div class="progress-fill" id="bar"></div>
      </div>

      <div class="meta-row">
        <span class="meta-phase" id="label">Starting</span>
        <button class="cancel-link" id="btn-cancel">Cancel</button>
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
        document.getElementById('percent').textContent = p + '%';
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
