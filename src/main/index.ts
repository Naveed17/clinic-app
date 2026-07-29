import { join } from 'node:path';
import { existsSync } from 'node:fs';

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

import { app, BrowserWindow, shell, ipcMain } from 'electron';
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
import { getSettings } from './config/settings';
import { startDiscoveryBroadcast, stopDiscoveryBroadcast } from './discovery/discovery.server';
import { startDiscoveryListener, stopDiscoveryListener } from './discovery/discovery.client';
import { registerBackupIpc } from './backup/backup.ipc';
import { registerDocumentsIpc } from './backup/documents.ipc';
import { registerTokenIpc } from './tokens/token.ipc';
import { registerLabIpc } from './lab/lab.ipc';
import { registerLicenseIpc } from './license/license.ipc';
import { registerAuthIpc } from './auth/auth.ipc';
import { registerSearchIpc } from './search/search.ipc';
import { registerMedicineIpc } from './medicines/medicine.ipc';
import { registerScheduleIpc } from './doctors/schedule.ipc';
import { seedDefaultAdmin } from './auth/seed';

let backendServer: BackendServer | undefined;

ipcMain.handle('app:get-api-url', () => {
  if (!backendServer) return null;
  // Always use loopback for local IPC — LAN IP is only for remote clients
  return backendServer.url.replace(/\/\/[^:]+:/, '//127.0.0.1:');
});

ipcMain.handle('print:html', async (_e, html: string) => {
  const { writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const pdfFile = join(tmpdir(), `clinic-print-${Date.now()}.pdf`);
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const tmpHtml = join(tmpdir(), `clinic-print-${Date.now()}.html`);
  writeFileSync(tmpHtml, html, 'utf-8');
  await win.loadFile(tmpHtml);
  const pdfData = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  win.close();
  writeFileSync(pdfFile, pdfData);
  await shell.openPath(pdfFile);
});

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
    void shell.openExternal(url);
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
  app.setPath('userData', join(app.getPath('appData'), 'CareFlow'));
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
  try {
    const settings = getSettings();
    if (settings.serverMode === 'lan-client' && settings.clientApiUrl) {
      // Client mode — point to remote server, skip local DB + backend
      process.env.CLINIC_API_URL = settings.clientApiUrl;
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
  registerLabIpc();
  registerAuthIpc();
  registerScheduleIpc();
  registerPatientIpc(backendServer?.io);
  registerAppointmentIpc(backendServer?.io);
  registerInvoiceIpc();
  registerReportIpc();
  registerUserIpc();
  registerDoctorIpc();
  registerSettingsIpc();
  registerSearchIpc();
  registerMedicineIpc();
  startDiscoveryListener(); // always listen so admin can also scan
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
  void backendServer?.close();
  void disconnectPrisma();
});

void environment;
