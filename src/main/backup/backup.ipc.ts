import { ipcMain, dialog, app } from 'electron';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { disconnectPrisma, getPrisma } from '../database/client';
import { getDocumentsRoot, resolveDocPath, toStoredDocPath } from './docs-paths';
import { isOnlineDatabaseMode } from '../config/settings';
import { copyDirRecursive, getClinicDbPath, writeBackupZip } from './backup-zip';
import {
  backupToGoogleDriveNow,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveStatus,
  setGoogleDriveSchedule,
  startGoogleDriveBackupScheduler,
  type DriveSchedule,
} from './google-drive';
import { registerMigrateToCloudIpc } from './migrate-to-cloud.ipc';
import { registerMigrateFromCloudIpc } from './migrate-from-cloud.ipc';

function ensureZipPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.zip')) return filePath;
  if (lower.endsWith('.db')) return `${filePath.slice(0, -3)}.zip`;
  return `${filePath}.zip`;
}

/** After restore, rewrite absolute paths so files open on this machine. */
async function remapDocumentPaths(): Promise<void> {
  const db = getPrisma();
  const docs = await db.patientDocument.findMany({ select: { id: true, filePath: true } });
  for (const doc of docs) {
    const absolute = resolveDocPath(doc.filePath);
    const stored = toStoredDocPath(absolute);
    if (stored !== doc.filePath) {
      await db.patientDocument.update({ where: { id: doc.id }, data: { filePath: stored } });
    }
  }
  const reports = await db.labReport.findMany({ select: { id: true, filePath: true } });
  for (const report of reports) {
    const absolute = resolveDocPath(report.filePath);
    const stored = toStoredDocPath(absolute);
    if (stored !== report.filePath) {
      await db.labReport.update({ where: { id: report.id }, data: { filePath: stored } });
    }
  }
}

export function registerBackupIpc(): void {
  ipcMain.removeHandler('backup:create');
  ipcMain.removeHandler('backup:restore');
  ipcMain.removeHandler('backup:google-status');
  ipcMain.removeHandler('backup:google-connect');
  ipcMain.removeHandler('backup:google-disconnect');
  ipcMain.removeHandler('backup:google-schedule');
  ipcMain.removeHandler('backup:google-now');

  ipcMain.handle('backup:create', async () => {
    if (isOnlineDatabaseMode()) {
      return {
        ok: false,
        error: 'Backup is not available in online database mode. Data is stored in the cloud.',
      };
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Clinic Backup (ZIP)',
      defaultPath: join(app.getPath('documents'), `careflow-backup-${stamp}.zip`),
      filters: [{ name: 'Clinic Backup ZIP', extensions: ['zip'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    const zipPath = ensureZipPath(filePath);

    try {
      await writeBackupZip(zipPath);
      return { ok: true, path: zipPath, mode: 'full' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Backup failed.' };
    }
  });

  ipcMain.handle('backup:restore', async () => {
    if (isOnlineDatabaseMode()) {
      return {
        ok: false,
        error: 'Restore is not available in online database mode. Data is stored in the cloud.',
      };
    }
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup File',
      filters: [
        { name: 'Clinic Backup', extensions: ['zip', 'db'] },
        { name: 'Zip Backup', extensions: ['zip'] },
        { name: 'Database Only (legacy)', extensions: ['db'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return { ok: false, canceled: true };

    const selected = filePaths[0];
    const staging = join(tmpdir(), `careflow-restore-${randomUUID()}`);

    try {
      await disconnectPrisma();
      mkdirSync(staging, { recursive: true });

      let dbSource = selected;

      if (selected.toLowerCase().endsWith('.zip')) {
        const zip = new AdmZip(selected);
        zip.extractAllTo(staging, true);

        const zippedDb = join(staging, 'clinic.db');
        const nestedDb = join(staging, basename(selected, '.zip'), 'clinic.db');
        if (existsSync(zippedDb)) dbSource = zippedDb;
        else if (existsSync(nestedDb)) dbSource = nestedDb;
        else throw new Error('Backup zip does not contain clinic.db');

        const stagedDocs = join(staging, 'documents');
        if (existsSync(stagedDocs)) {
          copyDirRecursive(stagedDocs, getDocumentsRoot());
        }
      }

      copyFileSync(dbSource, getClinicDbPath());
      getPrisma();
      await remapDocumentPaths();

      return { ok: true, mode: selected.toLowerCase().endsWith('.zip') ? 'full' : 'db' };
    } catch (e) {
      try {
        getPrisma();
      } catch {
        /* ignore */
      }
      return { ok: false, error: e instanceof Error ? e.message : 'Restore failed.' };
    } finally {
      try {
        if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  ipcMain.handle('backup:google-status', () => getGoogleDriveStatus());
  ipcMain.handle('backup:google-connect', () => connectGoogleDrive());
  ipcMain.handle('backup:google-disconnect', async () => {
    disconnectGoogleDrive();
    return getGoogleDriveStatus();
  });
  ipcMain.handle('backup:google-schedule', async (_e, schedule: DriveSchedule) => {
    if (schedule !== 'off' && schedule !== 'daily' && schedule !== 'weekly' && schedule !== 'monthly') {
      return getGoogleDriveStatus();
    }
    setGoogleDriveSchedule(schedule);
    return getGoogleDriveStatus();
  });
  ipcMain.handle('backup:google-now', () => backupToGoogleDriveNow());

  startGoogleDriveBackupScheduler();
  registerMigrateToCloudIpc();
  registerMigrateFromCloudIpc();
}
