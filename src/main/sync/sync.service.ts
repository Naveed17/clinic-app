import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getSettings, resolveOnlineApiOrigin } from '../config/settings';
import { getDiscoveredServers } from '../settings/settings.ipc';
import { getLicenseRuntimeMeta, applyDatabaseModeFromApi } from '../license/license.ipc';
import { uploadLocalFile } from '../backup/migrate-to-cloud.ipc';
import { pullMissingCloudDocuments } from '../backup/migrate-from-cloud.ipc';
import { syncLanFiles } from './lan-files';
import { lanFetch } from './lan-auth';
import { onDatabaseMutation } from '../database/client';
import {
  extractChangesSince,
  extractManifest,
  extractTableRows,
  extractDeletions,
  applyIncomingChanges,
  retryPendingRows,
} from './sync.engine';
import {
  SYNC_TABLES,
  type SyncTableName,
  type SyncStatus,
  type SyncProgressInfo,
  type SyncExchangePayload,
  type SyncExchangeResponse,
  type SyncManifest,
  type SyncDeletedItem,
} from './sync.types';

function getSyncStateFilePath(): string {
  return join(app.getPath('userData'), 'sync-state.json');
}

function getSyncKey(schemaId?: string): string {
  return schemaId ? `sync_${schemaId}` : 'lastSyncTime';
}

function loadLastSyncTime(schemaId?: string): number {
  try {
    const file = getSyncStateFilePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const key = getSyncKey(schemaId);
      if (typeof data[key] === 'number') {
        return data[key] as number;
      }
      // If a schemaId has never been synced, return 0 to trigger full initial sync
      if (schemaId) {
        return 0;
      }
      return Number(data?.lastSyncTime || 0);
    }
  } catch { /* ignore */ }
  return 0;
}

function saveLastSyncTime(timestamp: number, schemaId?: string): void {
  try {
    const file = getSyncStateFilePath();
    let currentData: Record<string, unknown> = {};
    if (existsSync(file)) {
      try {
        currentData = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const key = getSyncKey(schemaId);
    currentData[key] = timestamp;
    currentData.lastSyncTime = timestamp;
    currentData.updatedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify(currentData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SyncService] Failed to save last sync timestamp:', err);
  }
}

/** Server-time cursor of the last successful cloud pull (ISO). Empty → full pull. */
function loadCloudPullCursor(schemaId?: string): string {
  try {
    const file = getSyncStateFilePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const value = data[`cloudPull_${schemaId || 'default'}`];
      if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
    }
  } catch { /* ignore */ }
  return '';
}

function saveCloudPullCursor(schemaId: string | undefined, cursor: string): void {
  try {
    const file = getSyncStateFilePath();
    let currentData: Record<string, unknown> = {};
    if (existsSync(file)) {
      try {
        currentData = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    currentData[`cloudPull_${schemaId || 'default'}`] = cursor;
    writeFileSync(file, JSON.stringify(currentData, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

/**
 * After restoring a backup, forget the cloud pull cursor so the next sync re-merges
 * everything from the cloud (newer cloud edits / deletes win by timestamp).
 */
export function resetCloudPullCursor(): void {
  saveCloudPullCursor(getLicenseRuntimeMeta().schemaId || undefined, '');
}

interface SyncCheckpointData {
  completedTables?: string[];
  tableOffsets?: Record<string, number>;
}

function loadSyncCheckpoint(schemaId?: string): SyncCheckpointData {
  try {
    const file = getSyncStateFilePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const cpKey = schemaId ? `checkpoint_${schemaId}` : 'checkpoint';
      if (data[cpKey] && typeof data[cpKey] === 'object') {
        return data[cpKey] as SyncCheckpointData;
      }
    }
  } catch { /* ignore */ }
  return { completedTables: [], tableOffsets: {} };
}

function saveSyncCheckpoint(schemaId: string | undefined, cp: SyncCheckpointData): void {
  try {
    const file = getSyncStateFilePath();
    let currentData: Record<string, unknown> = {};
    if (existsSync(file)) {
      try {
        currentData = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const cpKey = schemaId ? `checkpoint_${schemaId}` : 'checkpoint';
    currentData[cpKey] = cp;
    writeFileSync(file, JSON.stringify(currentData, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

function clearSyncCheckpoint(schemaId?: string): void {
  try {
    const file = getSyncStateFilePath();
    if (existsSync(file)) {
      const currentData = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const cpKey = schemaId ? `checkpoint_${schemaId}` : 'checkpoint';
      delete currentData[cpKey];
      writeFileSync(file, JSON.stringify(currentData, null, 2), 'utf-8');
    }
  } catch { /* ignore */ }
}

let syncStatus: SyncStatus = {
  state: 'idle',
  lastSyncTime: loadLastSyncTime() || null,
  peerUrl: null,
};

let autoSyncTimer: NodeJS.Timeout | undefined;
let isSyncing = false;

function broadcastStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:status-changed', syncStatus);
      win.webContents.send('clinic:sync:status-changed', syncStatus);
    }
  }
}

/** PC clock minus server/peer clock (ms), from the last sync. Newer edits win by timestamp,
 * so a wrong Windows clock can make old edits overwrite new ones. */
let clockSkewMs = 0;
const CLOCK_SKEW_WARN_MS = 2 * 60 * 1000;

function noteClockSkew(serverTimeMs: number): void {
  if (Number.isFinite(serverTimeMs) && serverTimeMs > 0) clockSkewMs = Date.now() - serverTimeMs;
}

function withPending(message: string, pending: number): string {
  let out = pending > 0 ? `${message} • ${pending} item${pending === 1 ? '' : 's'} waiting for related data` : message;
  if (Math.abs(clockSkewMs) > CLOCK_SKEW_WARN_MS) {
    const minutes = Math.round(Math.abs(clockSkewMs) / 60000);
    out += ` • ⚠ This PC clock is ${minutes} min ${clockSkewMs > 0 ? 'ahead' : 'behind'}. Fix Windows date/time so the newest changes win.`;
  }
  return out;
}

function notifyDataChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('data:changed', { entity: 'all', action: 'sync' });
      win.webContents.send('clinic:sync:data-changed', { entity: 'all', action: 'sync' });
    }
  }
}

function updateProgress(percent: number, label: string): void {
  const p: SyncProgressInfo = {
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    label,
  };
  syncStatus = {
    ...syncStatus,
    state: 'syncing',
    progress: p,
    message: label,
  };
  broadcastStatus();
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export type SyncTarget =
  | { type: 'lan'; url: string }
  | { type: 'cloud'; url: string; key?: string | null; schemaId?: string; hwid?: string }
  | null;

type LanTarget = { type: 'lan'; url: string };
type CloudTarget = { type: 'cloud'; url: string; key?: string | null; schemaId?: string; hwid?: string };

function isOnlineMode(): boolean {
  return getLicenseRuntimeMeta().databaseMode === 'online' || getSettings().databaseMode === 'online';
}

/**
 * Offline-first: PCs share data with each other over the LAN (primary path).
 * The LAN server is the hub, so it never syncs with another LAN peer itself.
 */
export function resolveLanTarget(customPeerUrl?: string): LanTarget | null {
  const settings = getSettings();
  if (customPeerUrl && customPeerUrl.trim()) {
    const trimmed = customPeerUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('https://') || trimmed.includes('.vercel.app')) return null;
    return { type: 'lan', url: trimmed };
  }
  if (settings.serverMode === 'lan-server') return null;
  if (settings.clientApiUrl && settings.clientApiUrl.trim()) {
    return { type: 'lan', url: settings.clientApiUrl.trim().replace(/\/+$/, '') };
  }
  const discovered = getDiscoveredServers();
  if (discovered && discovered.length > 0) {
    const first = discovered[0];
    return { type: 'lan', url: `http://${first.ip}:${first.port}` };
  }
  return null;
}

/**
 * Online DB is an extra: push local data to the cloud (backup + mobile app) and pull
 * mobile-app changes back. LAN clients skip it — their LAN server does it for them.
 */
export function resolveCloudTarget(customPeerUrl?: string): CloudTarget | null {
  if (!isOnlineMode()) return null;
  const meta = getLicenseRuntimeMeta();
  const settings = getSettings();
  if (customPeerUrl && customPeerUrl.trim()) {
    const trimmed = customPeerUrl.trim().replace(/\/+$/, '');
    if (!(trimmed.startsWith('https://') || trimmed.includes('.vercel.app'))) return null;
    return { type: 'cloud', url: trimmed, key: meta.key, schemaId: meta.schemaId, hwid: meta.hwid };
  }
  if (settings.serverMode === 'lan-client') return null;
  const cloudUrl = resolveOnlineApiOrigin(meta.clinicalApiUrl || settings.clinicalApiUrl);
  if (!cloudUrl) return null;
  return { type: 'cloud', url: cloudUrl, key: meta.key, schemaId: meta.schemaId, hwid: meta.hwid };
}

/** Primary sync peer (LAN first, else cloud). */
export function resolveSyncTarget(customPeerUrl?: string): SyncTarget {
  return resolveLanTarget(customPeerUrl) ?? resolveCloudTarget(customPeerUrl);
}

export function resolvePeerUrl(): string | null {
  const target = resolveSyncTarget();
  return target ? target.url : null;
}

async function syncWithCloud(
  target: { url: string; key?: string | null; schemaId?: string; hwid?: string },
  opts?: { silent?: boolean },
): Promise<{ ok: boolean; recordsSynced?: number; error?: string }> {
  updateProgress(5, 'Connecting to cloud database...');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const pingRes = await fetch(`${target.url}/api/clinical/health`, {
      signal: controller.signal,
      headers: {
        ...(target.key ? { 'x-license-key': target.key } : {}),
        ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
      },
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (!pingRes || !pingRes.ok) {
      syncStatus = {
        ...syncStatus,
        state: 'offline',
        peerUrl: target.url,
        peerName: 'Cloud',
        message: 'Cloud not reachable. Working offline.',
        progress: undefined,
      };
      broadcastStatus();
      isSyncing = false;
      return { ok: false, error: 'Cloud database not reachable. Working offline.' };
    }

    const since = loadLastSyncTime(target.schemaId || undefined);
    const isInitialSync = since <= 0;
    updateProgress(5, isInitialSync ? 'Checking cloud database records...' : 'Scanning local changes...');

    let remoteTables: Record<string, number> = {};
    let remoteFiles: { patient?: number; lab?: number } | undefined;
    let serverTime = '';
    try {
      const statusRes = await fetch(`${target.url}/api/clinic/migrate/export/status`, {
        headers: {
          ...(target.key ? { 'x-license-key': target.key } : {}),
          ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
        },
      });
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as {
          tables?: Record<string, number>;
          files?: { patient?: number; lab?: number };
          serverTime?: string;
        };
        if (statusData && typeof statusData.serverTime === 'string') {
          serverTime = statusData.serverTime;
          noteClockSkew(Date.parse(serverTime));
        }
        if (statusData && statusData.tables) {
          remoteTables = statusData.tables;
        }
        if (statusData && statusData.files) {
          remoteFiles = statusData.files;
        }
      }
    } catch { /* ignore */ }

    const checkpoint = isInitialSync ? loadSyncCheckpoint(target.schemaId || undefined) : { completedTables: [], tableOffsets: {} };
    const completedTables = new Set(checkpoint.completedTables || []);
    const tableOffsets = checkpoint.tableOffsets || {};

    const { changes, deletions } = await extractChangesSince(since);

    let totalPushRows = 0;
    const tableKeys = (Object.keys(changes) as SyncTableName[]).filter(
      (t) => t !== 'PatientDocument' && t !== 'LabReport',
    );
    for (const t of Object.keys(changes) as SyncTableName[]) {
      totalPushRows += (changes[t] || []).length;
    }

    const newSyncTime = Date.now();
    let pushedCount = 0;

    if (totalPushRows > 0) {
      const BATCH_SIZE = 100;

    // Detect rows already synced to cloud so progress accurately resumes from where it stopped
    if (isInitialSync) {
      for (const table of tableKeys) {
        const rows = changes[table] || [];
        const remoteCount = remoteTables[table] || 0;
        if (remoteCount >= rows.length && rows.length > 0) {
          completedTables.add(table);
          pushedCount += rows.length;
        } else if (completedTables.has(table)) {
          pushedCount += rows.length;
        } else if (remoteCount > 0) {
          const offset = Math.floor(remoteCount / BATCH_SIZE) * BATCH_SIZE;
          if (offset > 0) {
            tableOffsets[table] = offset;
            pushedCount += offset;
          }
        }
      }

      if (pushedCount > 0) {
        const rawPct = Math.round((pushedCount / totalPushRows) * 100);
        updateProgress(
          Math.min(99, Math.max(1, rawPct)),
          `Resuming cloud sync from ${rawPct}% (${pushedCount}/${totalPushRows} records)...`,
        );
      }
    }

    for (const table of tableKeys) {
      const rows = changes[table] || [];
      if (!rows.length) continue;

      if (isInitialSync && completedTables.has(table)) {
        continue;
      }

      const startOffset = isInitialSync ? (tableOffsets[table] || 0) : 0;
      for (let i = startOffset; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        let lastErr: Error | null = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 45000);
          try {
            const pushRes = await fetch(`${target.url}/api/clinic/migrate/rows`, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(target.key ? { 'x-license-key': target.key } : {}),
                ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
                ...(target.hwid ? { 'x-hwid': target.hwid } : {}),
              },
              body: JSON.stringify({ table, rows: batch }),
            });
            clearTimeout(timer);
            if (!pushRes.ok) {
              const errText = await pushRes.text().catch(() => '');
              if (pushRes.status === 403 || /online database service suspended/i.test(errText)) {
                console.info('[SyncService] Online database is disabled for this license. Automatically transitioning to Local mode.');
                if (target.key) {
                  applyDatabaseModeFromApi(target.key, { databaseMode: 'local', onlineDatabase: false });
                }
                syncStatus = {
                  ...syncStatus,
                  state: 'offline',
                  peerUrl: null,
                  peerName: undefined,
                  message: 'Online Database is disabled for this license. Operating in Local Mode.',
                  progress: undefined,
                };
                broadcastStatus();
                isSyncing = false;
                return { ok: true, recordsSynced: 0 };
              }
              throw new Error(`Server ${pushRes.status}: ${errText.slice(0, 120)}`);
            }
            lastErr = null;
            break;
          } catch (e) {
            clearTimeout(timer);
            lastErr = e instanceof Error ? e : new Error(String(e));
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        }

        if (lastErr) {
          throw new Error(`Uploading ${table} failed: ${lastErr.message}`);
        }

        pushedCount += batch.length;
        const rawPct = Math.round((pushedCount / totalPushRows) * 100);
        const pct = Math.min(99, Math.max(1, rawPct));
        updateProgress(pct, `Uploaded ${pushedCount}/${totalPushRows} records (${pct}%)...`);

        if (isInitialSync) {
          tableOffsets[table] = i + batch.length;
          saveSyncCheckpoint(target.schemaId || undefined, {
            completedTables: Array.from(completedTables),
            tableOffsets,
          });
        }
      }

      if (isInitialSync) {
        completedTables.add(table);
        delete tableOffsets[table];
        saveSyncCheckpoint(target.schemaId || undefined, {
          completedTables: Array.from(completedTables),
          tableOffsets,
        });
      }
    }

    // Upload any modified Patient Documents & Lab Reports (PDFs / images) to Cloudflare R2
    let failedFileUploads = 0;
    const patientDocChanges = changes['PatientDocument'] || [];
    for (const doc of patientDocChanges) {
      try {
        const res = await uploadLocalFile({
          kind: 'patient',
          ownerId: String(doc.patientId || ''),
          id: String(doc.id || ''),
          name: String(doc.name || 'document'),
          mimeType: String(doc.mimeType || 'application/pdf'),
          size: Number(doc.size || 0),
          storedPath: String(doc.filePath || ''),
        });
        if (res === 'failed') failedFileUploads++;
      } catch (err) {
        failedFileUploads++;
        console.warn('[SyncService] Failed to sync patient doc to R2:', err);
      }
    }

    const labReportChanges = changes['LabReport'] || [];
    for (const report of labReportChanges) {
      try {
        const res = await uploadLocalFile({
          kind: 'lab',
          ownerId: String(report.labOrderId || ''),
          id: String(report.id || ''),
          name: String(report.name || 'report'),
          mimeType: String(report.mimeType || 'application/pdf'),
          size: Number(report.size || 0),
          storedPath: String(report.filePath || ''),
        });
        if (res === 'failed') failedFileUploads++;
      } catch (err) {
        failedFileUploads++;
        console.warn('[SyncService] Failed to sync lab report to R2:', err);
      }
    }
    if (failedFileUploads > 0) {
      // Keep lastSyncTime unchanged so these documents are retried on the next sync.
      throw new Error(`${failedFileUploads} document(s) could not be uploaded. Will retry.`);
    }

    // Push local deletions to cloud so removed records and R2 files are also deleted from Neon & R2
    if (deletions && deletions.length > 0) {
      try {
        await fetch(`${target.url}/api/clinic/migrate/deletions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(target.key ? { 'x-license-key': target.key } : {}),
            ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
            ...(target.hwid ? { 'x-hwid': target.hwid } : {}),
          },
          body: JSON.stringify({ deletions }),
        });
      } catch (err) {
        console.warn('[SyncService] Failed to push deletions to cloud:', err);
      }
    }
  }

    // Phase B: Pull updates from Cloud into local SQLite database (Two-Way Sync)
    // Incremental: only rows the server changed since our last pull (server-side "syncedAt"),
    // plus cloud deletions (tombstones). First sync / old server → full pull.
    let pulledCount = 0;
    const PULL_BATCH = 200;
    const cloudHeaders = {
      ...(target.key ? { 'x-license-key': target.key } : {}),
      ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
      ...(target.hwid ? { 'x-hwid': target.hwid } : {}),
    };
    const pullCursor = serverTime ? loadCloudPullCursor(target.schemaId || undefined) : '';
    // 2-minute overlap covers transactions that committed after the cursor was taken.
    const pullSince = pullCursor ? new Date(Date.parse(pullCursor) - 2 * 60 * 1000).toISOString() : '';
    let pullComplete = true;

    // B1. Cloud deletions (from other PCs / mobile app)
    updateProgress(85, 'Checking deletions from cloud...');
    try {
      let offset = 0;
      for (;;) {
        const qs = `${pullSince ? `since=${encodeURIComponent(pullSince)}&` : ''}offset=${offset}&limit=1000`;
        const delRes = await fetch(`${target.url}/api/clinic/migrate/export/deletions?${qs}`, { headers: cloudHeaders });
        if (!delRes.ok) {
          // 404 = server without tombstone support yet; keep working, retry next time.
          if (delRes.status !== 404) pullComplete = false;
          break;
        }
        const delData = (await delRes.json()) as { deletions?: SyncDeletedItem[] };
        const dels = delData.deletions || [];
        if (!dels.length) break;
        const { appliedDeletions } = await applyIncomingChanges({}, dels);
        pulledCount += appliedDeletions;
        offset += dels.length;
        if (dels.length < 1000) break;
      }
    } catch (e) {
      pullComplete = false;
      console.warn('[SyncService] Failed pulling cloud deletions:', e);
    }

    // B2. Changed rows (falls back to a full pull if the server rejects "since")
    let incremental = Boolean(pullSince);
    updateProgress(88, pullSince ? 'Downloading changes from cloud...' : 'Downloading cloud records...');
    for (const table of SYNC_TABLES) {
      if (table === 'PatientDocument' || table === 'LabReport') continue;
      if (!incremental && (remoteTables[table] || 0) === 0) continue;

      let offset = 0;
      for (;;) {
        try {
          const qs = `table=${encodeURIComponent(table)}&offset=${offset}&limit=${PULL_BATCH}${
            incremental ? `&since=${encodeURIComponent(pullSince)}` : ''
          }`;
          const pullRes = await fetch(`${target.url}/api/clinic/migrate/export/rows?${qs}`, { headers: cloudHeaders });
          if (!pullRes.ok) {
            if (incremental) {
              console.warn(`[SyncService] Incremental pull rejected (${pullRes.status}); falling back to full pull.`);
              incremental = false;
              offset = 0;
              continue;
            }
            pullComplete = false;
            break;
          }
          const pullData = (await pullRes.json()) as { rows?: Record<string, unknown>[] };
          const rows = pullData.rows || [];
          if (!rows.length) break;

          const { appliedChanges } = await applyIncomingChanges({ [table]: rows }, []);
          pulledCount += appliedChanges;
          offset += rows.length;
          if (rows.length < PULL_BATCH) break;
        } catch (e) {
          pullComplete = false;
          console.warn(`[SyncService] Failed pulling ${table}:`, e);
          break;
        }
      }
    }

    // Advance the cursor only when everything was pulled, so nothing is skipped.
    if (serverTime && pullComplete) {
      saveCloudPullCursor(target.schemaId || undefined, serverTime);
    }

    // Rows that failed earlier (e.g. parent not synced yet) — retry now that new data arrived.
    const cloudRetry = await retryPendingRows().catch(() => ({ applied: 0, stillPending: 0 }));
    pulledCount += cloudRetry.applied;

    // Download documents / lab reports added from other PCs or the mobile app.
    try {
      updateProgress(95, 'Downloading documents from cloud...');
      const docs = await pullMissingCloudDocuments(remoteFiles, new Date(newSyncTime - 1));
      pulledCount += docs.downloaded;
    } catch (e) {
      console.warn('[SyncService] Failed pulling cloud documents:', e);
    }

    if (pulledCount > 0) {
      notifyDataChanged();
    }

    const totalRecords = pushedCount + pulledCount;
    saveLastSyncTime(newSyncTime, target.schemaId || undefined);
    clearSyncCheckpoint(target.schemaId || undefined);
    syncStatus = {
      state: 'synced',
      lastSyncTime: newSyncTime,
      peerUrl: target.url,
      peerName: 'Cloud',
      message: withPending(
        totalRecords > 0
          ? `Synced ${totalRecords} record${totalRecords === 1 ? '' : 's'} (${pushedCount} sent, ${pulledCount} received)`
          : 'All data is up to date',
        cloudRetry.stillPending,
      ),
      recordsSyncedLastTime: totalRecords,
      progress: undefined,
    };
    broadcastStatus();
    isSyncing = false;
    return { ok: true, recordsSynced: totalRecords };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/online database service suspended/i.test(msg) || /server 403/i.test(msg)) {
      console.info('[SyncService] Online database is disabled for this license. Operating in Local Mode.');
      if (target.key) {
        applyDatabaseModeFromApi(target.key, { databaseMode: 'local', onlineDatabase: false });
      }
      syncStatus = {
        ...syncStatus,
        state: 'offline',
        peerUrl: null,
        peerName: undefined,
        message: 'Online Database is disabled for this license. Operating in Local Mode.',
        progress: undefined,
      };
      broadcastStatus();
      isSyncing = false;
      return { ok: true, recordsSynced: 0 };
    }
    console.warn('[SyncService] Cloud sync failed:', msg);
    syncStatus = {
      ...syncStatus,
      state: 'error',
      peerUrl: target.url,
      peerName: 'Cloud',
      message: `Cloud sync error: ${msg}`,
      progress: undefined,
    };
    broadcastStatus();
    isSyncing = false;
    return { ok: false, error: msg };
  }
}

/**
 * Performs a two-way sync handshake with the target peer using chunking and percentage progress.
 */
export async function triggerSync(opts?: { silent?: boolean; customPeerUrl?: string }): Promise<{
  ok: boolean;
  recordsSynced?: number;
  error?: string;
}> {
  if (isSyncing) {
    return { ok: false, error: 'Sync already in progress.' };
  }

  const lanTarget = resolveLanTarget(opts?.customPeerUrl);
  const cloudTarget = resolveCloudTarget(opts?.customPeerUrl);
  if (!lanTarget && !cloudTarget) {
    const meta = getLicenseRuntimeMeta();
    const isLocalMode = meta.databaseMode !== 'online';
    syncStatus = {
      ...syncStatus,
      state: 'offline',
      peerUrl: null,
      peerName: undefined,
      message: isLocalMode
        ? 'Working in Local Mode (offline).'
        : 'No clinic peer or cloud database configured. Working locally.',
      progress: undefined,
    };
    broadcastStatus();
    return { ok: true, recordsSynced: 0 };
  }

  // 1. LAN (primary): PCs share data directly, no internet needed.
  let lanResult: { ok: boolean; recordsSynced?: number; error?: string } | null = null;
  if (lanTarget) {
    isSyncing = true;
    lanResult = await syncWithLanPeer(lanTarget.url);
  }
  if (!cloudTarget) return lanResult ?? { ok: true, recordsSynced: 0 };

  // 2. Cloud (extra): backup + mobile app changes. Never blocks LAN sharing.
  const lanStatus = syncStatus;
  isSyncing = true;
  const cloudResult = await syncWithCloud(cloudTarget, opts);
  if (lanResult?.ok && !cloudResult.ok) {
    syncStatus = { ...lanStatus, message: `${lanStatus.message || 'Synced on LAN'} • Cloud not reachable, will retry` };
    broadcastStatus();
    return lanResult;
  }
  return {
    ok: cloudResult.ok && (lanResult ? lanResult.ok : true),
    recordsSynced: (lanResult?.recordsSynced || 0) + (cloudResult.recordsSynced || 0),
    error: cloudResult.error || lanResult?.error,
  };
}

async function syncWithLanPeer(targetUrl: string): Promise<{
  ok: boolean;
  recordsSynced?: number;
  error?: string;
}> {
  updateProgress(2, 'Connecting to clinic peer...');

  try {
    // 1. Check reachability via quick status ping (timeout 4000ms)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const pingRes = await fetch(`${targetUrl}/api/sync/status`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (!pingRes || !pingRes.ok) {
      syncStatus = {
        ...syncStatus,
        state: 'offline',
        peerUrl: targetUrl,
        message: 'Clinic peer not reachable. Working offline.',
        progress: undefined,
      };
      broadcastStatus();
      isSyncing = false;
      return { ok: false, error: 'Peer is not reachable.' };
    }

    const pingData = (await pingRes.json().catch(() => ({}))) as { clinicName?: string };
    const peerName = pingData.clinicName || 'Clinic Server';

    const since = loadLastSyncTime();

    // 2. Attempt chunked sync using manifest
    updateProgress(5, 'Checking changes on both devices...');
    const remoteManifestRes = await lanFetch(`${targetUrl}/api/sync/manifest?since=${since}`).catch(() => null);

    let recordsSynced = 0;
    let newSyncTime = Date.now();

    if (remoteManifestRes && remoteManifestRes.ok) {
      const remoteManifest = (await remoteManifestRes.json()) as SyncManifest;
      const localManifest = await extractManifest(since);
      newSyncTime = remoteManifest.serverTime || Date.now();
      noteClockSkew(Number(remoteManifest.serverTime));

      const totalPushRows = localManifest.totalRows + localManifest.deletionsCount;
      const totalPullRows = remoteManifest.totalRows + remoteManifest.deletionsCount;
      const totalWork = Math.max(1, totalPushRows + totalPullRows);
      let completedWork = 0;

      if (totalPushRows === 0 && totalPullRows === 0) {
        // Rows are in sync, but document files may still be pending (e.g. earlier failure).
        const files = await syncLanFiles(targetUrl).catch(() => ({ uploaded: 0, downloaded: 0, failed: 0 }));
        const lanRetryIdle = await retryPendingRows().catch(() => ({ applied: 0, stillPending: 0 }));
        if (lanRetryIdle.applied > 0) notifyDataChanged();
        if (files.downloaded > 0) notifyDataChanged();
        updateProgress(100, 'All data is up to date.');
        saveLastSyncTime(newSyncTime);
        syncStatus = {
          state: 'synced',
          lastSyncTime: newSyncTime,
          peerUrl: targetUrl,
          peerName,
          message: withPending('All data is up to date', lanRetryIdle.stillPending),
          recordsSyncedLastTime: 0,
          progress: { percent: 100, label: 'Up to date' },
        };
        broadcastStatus();
        isSyncing = false;
        return { ok: true, recordsSynced: 0 };
      }

      // Phase A: Push local changes to peer in chunks of at most 50 rows
      for (const table of SYNC_TABLES) {
        const count = localManifest.tables[table] || 0;
        if (count === 0) continue;

        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { rows, hasMore: more } = await extractTableRows(table, since, offset, 50);
          hasMore = more;
          offset += rows.length;

          if (rows.length > 0) {
            const pushRes = await lanFetch(`${targetUrl}/api/sync/push-chunk`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table, rows }),
            });
            if (!pushRes.ok) {
              const err = await pushRes.text().catch(() => '');
              throw new Error(`Pushing ${table} failed: ${err.slice(0, 150)}`);
            }
          }

          completedWork += rows.length;
          const pct = Math.min(95, Math.round((completedWork / totalWork) * 100));
          updateProgress(pct, `Sending ${table} (${pct}%)...`);
        }
      }

      // Push local deletions
      if (localManifest.deletionsCount > 0) {
        const deletions = await extractDeletions(since);
        if (deletions.length > 0) {
          const delRes = await lanFetch(`${targetUrl}/api/sync/push-deletions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deletions }),
          });
          if (!delRes.ok) {
            console.warn('[SyncService] Failed to push deletions');
          }
          completedWork += deletions.length;
          const pct = Math.min(95, Math.round((completedWork / totalWork) * 100));
          updateProgress(pct, `Updating deleted items (${pct}%)...`);
        }
      }

      // Phase B: Pull remote changes in chunks of at most 50 rows
      for (const table of SYNC_TABLES) {
        const count = remoteManifest.tables[table] || 0;
        if (count === 0) continue;

        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const pullRes = await lanFetch(
            `${targetUrl}/api/sync/table?table=${table}&since=${since}&offset=${offset}&limit=50`,
          );
          if (!pullRes.ok) {
            const err = await pullRes.text().catch(() => '');
            throw new Error(`Pulling ${table} failed: ${err.slice(0, 150)}`);
          }
          const pullData = (await pullRes.json()) as { rows: Record<string, unknown>[]; hasMore: boolean };
          const rows = pullData.rows || [];
          hasMore = pullData.hasMore;
          offset += rows.length;

          if (rows.length > 0) {
            const { appliedChanges } = await applyIncomingChanges({ [table]: rows }, []);
            recordsSynced += appliedChanges;
          }

          completedWork += rows.length;
          const pct = Math.min(95, Math.round((completedWork / totalWork) * 100));
          updateProgress(pct, `Receiving ${table} (${pct}%)...`);
        }
      }

      // Pull remote deletions
      if (remoteManifest.deletionsCount > 0) {
        const delRes = await lanFetch(`${targetUrl}/api/sync/deletions?since=${since}`);
        if (delRes.ok) {
          const delData = (await delRes.json()) as { deletions: SyncDeletedItem[] };
          const deletions = delData.deletions || [];
          if (deletions.length > 0) {
            const { appliedDeletions } = await applyIncomingChanges({}, deletions);
            recordsSynced += appliedDeletions;
          }
          completedWork += deletions.length;
        }
      }

      saveLastSyncTime(newSyncTime);
    } else {
      // Fallback: Legacy monolithic exchange (if peer is on an older build)
      updateProgress(20, 'Exchanging data with peer (legacy)...');
      const { changes, deletions, currentTimestamp } = await extractChangesSince(since);

      const payload: SyncExchangePayload = {
        clientSince: since,
        clientChanges: changes,
        clientDeletions: deletions,
      };

      updateProgress(45, 'Sending payload...');
      const exchangeRes = await lanFetch(`${targetUrl}/api/sync/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!exchangeRes.ok) {
        const errText = await exchangeRes.text().catch(() => '');
        throw new Error(
          `Sync exchange failed with status ${exchangeRes.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`,
        );
      }

      updateProgress(75, 'Applying incoming changes...');
      const data = (await exchangeRes.json()) as SyncExchangeResponse;
      if (!data.ok) {
        throw new Error(data.error || 'Sync rejected by peer.');
      }

      const { appliedChanges, appliedDeletions } = await applyIncomingChanges(
        data.serverChanges || {},
        data.serverDeletions || [],
      );

      recordsSynced = appliedChanges + appliedDeletions;
      newSyncTime = data.syncedAt || currentTimestamp;
      saveLastSyncTime(newSyncTime);
    }

    // Rows that failed earlier — retry now that the peer's data arrived.
    const lanRetry = await retryPendingRows().catch(() => ({ applied: 0, stillPending: 0 }));
    recordsSynced += lanRetry.applied;

    // Document files (PDFs / images) for the rows above
    updateProgress(97, 'Syncing document files...');
    const files = await syncLanFiles(targetUrl).catch((e) => {
      console.warn('[SyncService] LAN file sync failed:', e);
      return { uploaded: 0, downloaded: 0, failed: 0 };
    });
    recordsSynced += files.downloaded;

    updateProgress(100, 'Sync complete');
    syncStatus = {
      state: 'synced',
      lastSyncTime: newSyncTime,
      peerUrl: targetUrl,
      peerName,
      message: withPending(`Successfully synchronized with ${peerName}`, lanRetry.stillPending),
      recordsSyncedLastTime: recordsSynced,
      progress: { percent: 100, label: 'Sync complete' },
    };
    broadcastStatus();

    // If new records were applied locally, notify React UI
    if (recordsSynced > 0) {
      notifyDataChanged();
    }

    isSyncing = false;
    return { ok: true, recordsSynced };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SyncService] Sync failed:', msg);
    syncStatus = {
      ...syncStatus,
      state: 'error',
      peerUrl: targetUrl,
      message: `Sync failed: ${msg}`,
      progress: undefined,
    };
    broadcastStatus();
    isSyncing = false;
    return { ok: false, error: msg };
  }
}

let smartSyncTimer: NodeJS.Timeout | null = null;
let unsubMutation: (() => void) | null = null;

/**
 * Called when local data is created, updated, or deleted.
 * Batches changes with a 2.5s debounce so multiple rapid edits trigger only ONE sync request.
 */
export function scheduleSmartSync(delayMs = 2500): void {
  if (smartSyncTimer) clearTimeout(smartSyncTimer);
  smartSyncTimer = setTimeout(() => {
    smartSyncTimer = null;
    void triggerSync({ silent: true });
  }, delayMs);
}

export function startAutoSync(): void {
  if (autoSyncTimer) return;

  // 1. Smart event-driven sync on any add/edit/delete
  if (!unsubMutation) {
    unsubMutation = onDatabaseMutation(() => {
      scheduleSmartSync(2500);
    });
  }

  // 2. Initial catch-up on app start (single check)
  setTimeout(() => {
    void triggerSync({ silent: true });
  }, 4000);

  // 3. Heartbeat: 2.5 minutes for online cloud database, 15 minutes for local LAN
  // (Note: all user mutations already auto-sync immediately in 2.5s via scheduleSmartSync)
  // With Online DB on, poll every 2.5 min so mobile-app changes arrive quickly.
  const pollInterval = resolveCloudTarget() ? 150 * 1000 : 15 * 60 * 1000;
  autoSyncTimer = setInterval(() => {
    void triggerSync({ silent: true });
  }, pollInterval);
}

export function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = undefined;
  }
  if (smartSyncTimer) {
    clearTimeout(smartSyncTimer);
    smartSyncTimer = null;
  }
  if (unsubMutation) {
    unsubMutation();
    unsubMutation = null;
  }
}
