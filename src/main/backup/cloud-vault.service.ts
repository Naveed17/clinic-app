import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { getLicenseRuntimeMeta } from '../license/license.ipc';
import { getSettings } from '../config/settings';
import { copyDirRecursive, getClinicDbPath, writeBackupZip } from './backup-zip';
import { disconnectPrisma, getPrisma } from '../database/client';
import { getDocumentsRoot, resolveDocPath, toStoredDocPath } from './docs-paths';

export type CloudVaultSchedule = 'off' | 'daily' | 'weekly';

export interface CloudVaultBackupItem {
  id: string;
  licenseKey: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  format: string;
  deviceName?: string;
  backupType: 'auto' | 'manual';
  notes?: string;
  createdAt: string;
}

export interface CloudVaultStatus {
  enabled: boolean;
  schedule: CloudVaultSchedule;
  lastBackupAt: string | null;
  licenseKey: string | null;
  serverUrl: string;
}

const DEFAULT_SERVER_URL = 'https://clinic-license-six.vercel.app';

function getScheduleFilePath(): string {
  return join(app.getPath('userData'), 'cloud-vault-schedule.json');
}

export function getCloudVaultStatus(): CloudVaultStatus {
  const meta = getLicenseRuntimeMeta();
  const settings = getSettings();
  const serverUrl = (meta.clinicalApiUrl || settings.clinicalApiUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');

  let schedule: CloudVaultSchedule = 'daily';
  let lastBackupAt: string | null = null;

  try {
    const file = getScheduleFilePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      if (data.schedule) schedule = data.schedule;
      if (data.lastBackupAt) lastBackupAt = data.lastBackupAt;
    }
  } catch {
    /* ignore */
  }

  return {
    enabled: schedule !== 'off',
    schedule,
    lastBackupAt,
    licenseKey: meta.key,
    serverUrl,
  };
}

export function saveCloudVaultSchedule(schedule: CloudVaultSchedule): CloudVaultStatus {
  const status = getCloudVaultStatus();
  status.schedule = schedule;
  status.enabled = schedule !== 'off';

  try {
    writeFileSync(getScheduleFilePath(), JSON.stringify({
      schedule,
      lastBackupAt: status.lastBackupAt,
      updatedAt: new Date().toISOString(),
    }, null, 2));
  } catch {
    /* ignore */
  }

  return status;
}

function updateLastCloudBackupTime(at: string): void {
  try {
    const status = getCloudVaultStatus();
    writeFileSync(getScheduleFilePath(), JSON.stringify({
      schedule: status.schedule,
      lastBackupAt: at,
      updatedAt: new Date().toISOString(),
    }, null, 2));
  } catch {
    /* ignore */
  }
}

function getCloudApiBase(): { url: string; key: string; hwid: string } {
  const meta = getLicenseRuntimeMeta();
  const settings = getSettings();
  const key = meta.key;

  if (!key) {
    throw new Error('Please activate a valid CareFlow license key first.');
  }

  const base = (meta.clinicalApiUrl || settings.clinicalApiUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  return {
    url: `${base}/api/backup`,
    key,
    hwid: meta.hwid,
  };
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

/**
 * Upload compressed snapshot to CareFlow Cloud Vault (Server + Cloudflare R2)
 */
export async function uploadBackupToCloudVault(
  backupType: 'manual' | 'auto' = 'manual',
  notes?: string,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const { url, key, hwid } = getCloudApiBase();

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const tempZip = join(tmpdir(), `careflow-vault-${stamp}-${randomUUID().slice(0, 6)}.zip`);

  try {
    // 1. Create compressed snapshot ZIP
    await writeBackupZip(tempZip);
    if (!existsSync(tempZip)) {
      throw new Error('Failed to generate local backup archive.');
    }

    const fileBuffer = readFileSync(tempZip);
    const fileName = `CareFlow_Backup_${stamp}.zip`;

    // 2. Build FormData payload
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/zip' });
    formData.append('file', blob, fileName);
    formData.append('key', key);
    formData.append('hwid', hwid);
    formData.append('deviceName', hostname() || 'Clinic PC');
    formData.append('backupType', backupType);
    if (notes) formData.append('notes', notes);

    // 3. Upload to backend server
    const res = await fetch(`${url}/upload`, {
      method: 'POST',
      headers: {
        'x-license-key': key,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Server returned ${res.status}: ${res.statusText}`);
    }

    const result = (await res.json()) as any;
    const nowIso = new Date().toISOString();
    updateLastCloudBackupTime(nowIso);

    return { ok: true, data: result.data };
  } catch (err: any) {
    console.error('[CloudVault] Upload failed:', err);
    return { ok: false, error: err.message || 'Cloud backup upload failed.' };
  } finally {
    try {
      if (existsSync(tempZip)) unlinkSync(tempZip);
    } catch {
      /* ignore */
    }
  }
}

/**
 * List all backups vaulted in Cloud for this license
 */
export async function listCloudVaultBackups(): Promise<{
  ok: boolean;
  backups?: CloudVaultBackupItem[];
  error?: string;
}> {
  try {
    const { url, key } = getCloudApiBase();
    const res = await fetch(`${url}/list`, {
      method: 'GET',
      headers: {
        'x-license-key': key,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Server returned ${res.status}`);
    }

    const json = (await res.json()) as { ok: boolean; count: number; data: CloudVaultBackupItem[] };
    return { ok: true, backups: json.data || [] };
  } catch (err: any) {
    console.error('[CloudVault] List failed:', err);
    return { ok: false, error: err.message || 'Could not fetch cloud backups.' };
  }
}

/**
 * Download and restore backup from Cloud Vault into local database
 */
export async function restoreFromCloudVault(
  backupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { url, key } = getCloudApiBase();
  const staging = join(tmpdir(), `careflow-cloud-restore-${randomUUID()}`);
  const tempZip = join(tmpdir(), `careflow-download-${randomUUID()}.zip`);

  try {
    // 1. Download file from server
    const downloadUrl = `${url}/${backupId}/download?key=${encodeURIComponent(key)}`;
    const res = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'x-license-key': key,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download backup archive (${res.status} ${res.statusText})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    writeFileSync(tempZip, Buffer.from(arrayBuffer));

    // 2. Extract into staging
    await disconnectPrisma();
    mkdirSync(staging, { recursive: true });

    const zip = new AdmZip(tempZip);
    zip.extractAllTo(staging, true);

    const zippedDb = join(staging, 'clinic.db');
    if (!existsSync(zippedDb)) {
      throw new Error('Downloaded backup does not contain clinic.db');
    }

    const stagedDocs = join(staging, 'documents');
    if (existsSync(stagedDocs)) {
      copyDirRecursive(stagedDocs, getDocumentsRoot());
    }

    // 3. Replace local SQLite DB
    copyFileSync(zippedDb, getClinicDbPath());
    getPrisma();
    await remapDocumentPaths();

    return { ok: true };
  } catch (err: any) {
    console.error('[CloudVault] Restore failed:', err);
    try {
      getPrisma();
    } catch {
      /* ignore */
    }
    return { ok: false, error: err.message || 'Cloud backup restore failed.' };
  } finally {
    try {
      if (existsSync(tempZip)) unlinkSync(tempZip);
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Delete a specific backup from Cloud Vault
 */
export async function deleteCloudVaultBackup(
  backupId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { url, key } = getCloudApiBase();
    const res = await fetch(`${url}/${backupId}`, {
      method: 'DELETE',
      headers: {
        'x-license-key': key,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete backup from cloud.');
    }

    return { ok: true };
  } catch (err: any) {
    console.error('[CloudVault] Delete failed:', err);
    return { ok: false, error: err.message || 'Failed to delete cloud backup.' };
  }
}

let isAutoBackupRunning = false;

/**
 * Check and perform automated background backup if due
 */
export async function checkAndPerformDailyCloudBackup(): Promise<void> {
  if (isAutoBackupRunning) return;

  const status = getCloudVaultStatus();
  if (!status.enabled || status.schedule === 'off') return;
  if (!status.licenseKey) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (status.schedule === 'daily') {
    if (status.lastBackupAt && status.lastBackupAt.startsWith(todayStr)) {
      return; // Already backed up today
    }
  } else if (status.schedule === 'weekly') {
    if (status.lastBackupAt) {
      const last = new Date(status.lastBackupAt);
      const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) return; // Less than 7 days since last backup
    }
  }

  isAutoBackupRunning = true;
  try {
    // Probe server connectivity first
    const { url } = getCloudApiBase();
    const probe = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (!probe || !probe.ok) {
      return; // Offline, will retry next interval
    }

    console.log('[CloudVault] Starting scheduled automated backup to cloud vault...');
    await uploadBackupToCloudVault('auto', 'Scheduled Automated Backup');
    console.log('[CloudVault] Scheduled backup completed successfully.');
  } catch (err: any) {
    console.warn('[CloudVault] Scheduled auto backup skipped:', err.message);
  } finally {
    isAutoBackupRunning = false;
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startCloudVaultScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer);

  // Initial check after 30 seconds of app start
  setTimeout(() => {
    void checkAndPerformDailyCloudBackup();
  }, 30_000);

  // Repeat check every 2 hours
  schedulerTimer = setInterval(() => {
    void checkAndPerformDailyCloudBackup();
  }, 2 * 60 * 60 * 1000);
}

export function stopCloudVaultScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
