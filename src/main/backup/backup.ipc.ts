import { ipcMain, dialog, app } from 'electron';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { disconnectPrisma, getPrisma } from '../database/client';
import { getDocumentsRoot, resolveDocPath, toStoredDocPath } from './docs-paths';
import { isOnlineDatabaseMode } from '../config/settings';
import { registerMigrateToCloudIpc } from './migrate-to-cloud.ipc';
import { registerMigrateFromCloudIpc } from './migrate-from-cloud.ipc';

function getDbPath(): string {
  return join(app.getPath('userData'), 'clinic.db');
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) {
      copyDirRecursive(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
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

function ensureZipPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.zip')) return filePath;
  // Strip accidental .db and force .zip
  if (lower.endsWith('.db')) return `${filePath.slice(0, -3)}.zip`;
  return `${filePath}.zip`;
}

export function registerBackupIpc(): void {
  ipcMain.removeHandler('backup:create');
  ipcMain.removeHandler('backup:restore');

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
      await disconnectPrisma();

      const zip = new AdmZip();
      zip.addFile('clinic.db', readFileSync(getDbPath()));

      const docsRoot = getDocumentsRoot();
      if (existsSync(docsRoot) && readdirSync(docsRoot).length > 0) {
        zip.addLocalFolder(docsRoot, 'documents');
      }

      mkdirSync(dirname(zipPath), { recursive: true });
      zip.writeZip(zipPath);

      getPrisma();
      return { ok: true, path: zipPath, mode: 'full' };
    } catch (e) {
      try {
        getPrisma();
      } catch {
        /* ignore */
      }
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

      copyFileSync(dbSource, getDbPath());
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
  registerMigrateToCloudIpc();
  registerMigrateFromCloudIpc();
}
