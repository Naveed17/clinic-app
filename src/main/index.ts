import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { app, BrowserWindow, shell, ipcMain } from 'electron';

// Must run before app ready — locks AppData to CareFlow (not Electron / old productName).
app.setName('CareFlow');
app.setPath('userData', join(app.getPath('appData'), 'CareFlow'));

// Redirect @prisma/client and .prisma/client to extraResources path (outside ASAR)
if (process.resourcesPath) {
  const extraNodeModules = join(process.resourcesPath, 'node_modules');
  if (existsSync(extraNodeModules)) {
    // Prepend to module search paths so require('@prisma/client') finds it outside ASAR
    (process as NodeJS.Process & { mainModule?: { paths?: string[] } })
      .mainModule?.paths?.unshift(extraNodeModules);
    require('module').globalPaths.unshift(extraNodeModules);
  }
}

import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { environment } from './config/environment';
import { disconnectPrisma, initializeDatabase } from './database/client';
import { startBackendServer, type BackendServer } from './backend/server';
import { registerPatientIpc } from './patients/patient.ipc';
import { registerAppointmentIpc } from './appointments/appointment.ipc';
import { registerInvoiceIpc } from './invoices/invoice.ipc';
import { registerReportIpc } from './reports/report.ipc';
import { registerUserIpc } from './users/user.ipc';
import { registerDoctorIpc } from './doctors/doctor.ipc';
import { registerSettingsIpc } from './settings/settings.ipc';
import { registerPrintIpc } from './print/print.ipc';
import { registerAiIpc } from './ai/groq.ipc';
import { getSettings, saveDatabaseModeSettings, resolveOnlineApiOrigin, isOnlineDatabaseMode } from './config/settings';
import { startDiscoveryBroadcast, stopDiscoveryBroadcast } from './discovery/discovery.server';
import { startDiscoveryListener, stopDiscoveryListener } from './discovery/discovery.client';
import { registerBackupIpc } from './backup/backup.ipc';
import { registerDocumentsIpc } from './backup/documents.ipc';
import { registerTokenIpc } from './tokens/token.ipc';
import { registerLabIpc } from './lab/lab.ipc';
import { registerChatIpc } from './chat/chat.ipc';
import { registerLicenseIpc, isLicenseActivated, getLicenseRuntimeMeta } from './license/license.ipc';
import { registerAuthIpc } from './auth/auth.ipc';
import { registerSearchIpc } from './search/search.ipc';
import { registerMedicineIpc } from './medicines/medicine.ipc';
import { registerScheduleIpc } from './doctors/schedule.ipc';
import { seedDefaultAdmin } from './auth/seed';
import { initAutoUpdater } from './updater';
import { registerWhatsAppIpc } from './whatsapp/whatsapp.ipc';

let backendServer: BackendServer | undefined;

ipcMain.handle('app:get-api-url', () => {
  if (!backendServer) return null;
  // Always use loopback for local IPC — LAN IP is only for remote clients
  return backendServer.url.replace(/\/\/[^:]+:/, '//127.0.0.1:');
});

// ─── LAN-client background retry ────────────────────────────────────────────
// Agar startup pe server nahi mila toh yeh function background mein retry
// karta rehta hai (har 5 seconds). Jab server mil jaye toh:
//  1. CLINIC_API_URL update kar deta hai
//  2. Renderer ko 'lan:server-reconnected' event bhejta hai taake woh reload ho
let _lanRetryTimer: ReturnType<typeof setInterval> | undefined;

function startLanRetry(serverUrl: string): void {
  if (_lanRetryTimer) return; // already running
  console.log('[LAN] Server unreachable at startup — retrying every 5s...');

  _lanRetryTimer = setInterval(() => {
    const { request } = require('node:http') as typeof import('node:http');
    const req = request(`${serverUrl}/health`, { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          if ((JSON.parse(data) as { ok: boolean }).ok === true) {
            console.log('[LAN] Server found! Switching to LAN mode.');
            clearInterval(_lanRetryTimer);
            _lanRetryTimer = undefined;
            process.env.CLINIC_API_URL = serverUrl;
            // Renderer ko notify karo — woh page reload karega
            BrowserWindow.getAllWindows().forEach((win) => {
              win.webContents.send('lan:server-reconnected', serverUrl);
            });
          }
        } catch { /* ignore */ }
      });
    });
    req.on('error', () => { /* still unreachable, try next interval */ });
    req.on('timeout', () => { req.destroy(); });
    req.end();
  }, 5000);
}

function stopLanRetry(): void {
  if (_lanRetryTimer) {
    clearInterval(_lanRetryTimer);
    _lanRetryTimer = undefined;
  }
}
// ────────────────────────────────────────────────────────────────────────────

function createWindow(): void {
  const iconPath = is.dev
    ? join(__dirname, '../../src/main/assets/icons/icon.png')
    : join(__dirname, '../assets/icons/icon.png');

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.on('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Facebook Login / Embedded Signup must be a real popup so the SDK
    // can return the auth code via postMessage. External browser breaks that.
    if (/^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com)\//i.test(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 560,
          height: 760,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }
    // http(s) → browser; mailto → default mail app. Skip about:blank / tel: (no dialer on clinic PCs).
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.careflow.app');

  if (app.isPackaged && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'clinic-secret-key')) {
    console.warn('[CareFlow] JWT_SECRET is not set — using insecure default. Set JWT_SECRET before production deploy.');
  }

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
  try {
    // Pull online/local flag from license API (or cache) BEFORE starting SQLite/LAN.
    try {
      await isLicenseActivated();
    } catch (err) {
      console.warn('[CareFlow] License sync at startup failed — using cached mode', err);
    }

    const settings = getSettings();
    const meta = getLicenseRuntimeMeta();
    const online =
      isOnlineDatabaseMode(settings) ||
      (meta.databaseMode === 'online' && Boolean(meta.clinicalApiUrl || settings.clinicalApiUrl));

    if (online) {
      // Online = Vercel Nest API → Neon Postgres only (no local SQLite / LAN).
      const clinicalOrigin = resolveOnlineApiOrigin(settings.clinicalApiUrl || meta.clinicalApiUrl);
      saveDatabaseModeSettings({
        databaseMode: 'online',
        clinicalApiUrl: clinicalOrigin,
        schemaId: settings.schemaId || meta.schemaId || '',
        serverMode: 'local',
        clientApiUrl: '',
      });
      process.env.CLINIC_API_URL = clinicalOrigin;
      console.log('[CareFlow] Online mode → Neon via', process.env.CLINIC_API_URL, settings.schemaId || meta.schemaId);
    } else if (settings.serverMode === 'lan-client' && settings.clientApiUrl) {
      // Verify remote server is reachable before committing to client mode
      const reachable = await new Promise<boolean>((resolve) => {
        const { request } = require('node:http') as typeof import('node:http');
        const req = request(`${settings.clientApiUrl}/health`, { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try { resolve((JSON.parse(data) as { ok: boolean }).ok === true); }
            catch { resolve(false); }
          });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
      });

      if (reachable) {
        // Client mode — point to remote server, skip local DB + backend
        process.env.CLINIC_API_URL = settings.clientApiUrl;
      } else {
        // Server unreachable — fall back to local mode so app doesn't break
        // NOTE: saveSettings intentionally NOT called here so lan-client setting
        // is preserved — next restart will retry the remote server automatically
        console.warn('LAN server unreachable, falling back to local mode (settings kept)');
        await initializeDatabase();
        await seedDefaultAdmin();
        backendServer = await startBackendServer(environment.apiPort);
        process.env.CLINIC_API_URL = backendServer.url;
        // Background mein retry karta raho — jab server mile toh renderer reload hoga
        startLanRetry(settings.clientApiUrl);
      }
    } else {
      // Server or local mode — start local backend
      await initializeDatabase();
      await seedDefaultAdmin();
      backendServer = await startBackendServer(environment.apiPort);
      process.env.CLINIC_API_URL = backendServer.url;
      if (settings.serverMode === 'lan-server') {
        startDiscoveryBroadcast(settings.lanPort || environment.apiPort);
      }
    }
  } catch (error) {
    console.error('Backend initialization failed:', error);
  }
  registerLicenseIpc();
  registerBackupIpc();
  registerDocumentsIpc();
  registerTokenIpc(backendServer?.io);
  registerLabIpc(backendServer?.io);
  registerChatIpc(backendServer?.io);
  registerAuthIpc();
  registerScheduleIpc();
  registerPatientIpc(backendServer?.io);
  registerAppointmentIpc(backendServer?.io);
  registerInvoiceIpc();
  registerReportIpc();
  registerUserIpc();
  registerDoctorIpc();
  registerSettingsIpc();
  registerPrintIpc();
  registerAiIpc();
  registerWhatsAppIpc();
  registerSearchIpc();
  registerMedicineIpc();
  // LAN discovery only when not on cloud Postgres
  if (!isOnlineDatabaseMode()) {
    startDiscoveryListener();
  }
  initAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopDiscoveryBroadcast();
  stopDiscoveryListener();
  stopLanRetry();
  void backendServer?.close();
  void disconnectPrisma();
});

void environment;
