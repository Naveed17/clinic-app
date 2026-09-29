import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getSettings, resolveOnlineApiOrigin } from '../config/settings';
import { getDiscoveredServers } from '../settings/settings.ipc';
import { getLicenseRuntimeMeta, applyDatabaseModeFromApi } from '../license/license.ipc';
import { uploadLocalFile } from '../backup/migrate-to-cloud.ipc';
import { onDatabaseMutation } from '../database/client';
import {
  extractChangesSince,
  extractManifest,
  extractTableRows,
  extractDeletions,
  applyIncomingChanges,
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

export function resolveSyncTarget(customPeerUrl?: string): SyncTarget {
  const meta = getLicenseRuntimeMeta();
  const settings = getSettings();
  const isOnlineMode = meta.databaseMode === 'online' || settings.databaseMode === 'online';

  if (customPeerUrl && customPeerUrl.trim()) {
    const trimmed = customPeerUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('https://') || trimmed.includes('.vercel.app')) {
      if (!isOnlineMode) {
        return null;
      }
      return { type: 'cloud', url: trimmed, key: meta.key, schemaId: meta.schemaId, hwid: meta.hwid };
    }
    return { type: 'lan', url: trimmed };
  }

  if (settings.clientApiUrl && settings.clientApiUrl.trim()) {
    return { type: 'lan', url: settings.clientApiUrl.trim().replace(/\/+$/, '') };
  }

  const discovered = getDiscoveredServers();
  if (discovered && discovered.length > 0) {
    const first = discovered[0];
    return { type: 'lan', url: `http://${first.ip}:${first.port}` };
  }

  // Cloud database sync ONLY runs when license or settings databaseMode is 'online'
  if (isOnlineMode) {
    const cloudUrl = resolveOnlineApiOrigin(meta.clinicalApiUrl || settings.clinicalApiUrl);
    if (cloudUrl) {
      return {
        type: 'cloud',
        url: cloudUrl,
        key: meta.key,
        schemaId: meta.schemaId,
        hwid: meta.hwid,
      };
    }
  }

  return null;
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
    if (isInitialSync) {
      try {
        const statusRes = await fetch(`${target.url}/api/clinic/migrate/export/status`, {
          headers: {
            ...(target.key ? { 'x-license-key': target.key } : {}),
            ...(target.schemaId ? { 'x-schema-id': target.schemaId } : {}),
          },
        });
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as { tables?: Record<string, number> };
          if (statusData && statusData.tables) {
            remoteTables = statusData.tables;
          }
        }
      } catch { /* ignore */ }
    }

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
    if (totalPushRows === 0) {
      saveLastSyncTime(newSyncTime, target.schemaId || undefined);
      clearSyncCheckpoint(target.schemaId || undefined);
      syncStatus = {
        state: 'synced',
        lastSyncTime: newSyncTime,
        peerUrl: target.url,
        peerName: 'Cloud',
        message: 'All data is up to date',
        recordsSyncedLastTime: 0,
        progress: undefined,
      };
      broadcastStatus();
      isSyncing = false;
      return { ok: true, recordsSynced: 0 };
    }

    const BATCH_SIZE = 100;
    let pushedCount = 0;

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
    const patientDocChanges = changes['PatientDocument'] || [];
    for (const doc of patientDocChanges) {
      try {
        await uploadLocalFile({
          kind: 'patient',
          ownerId: String(doc.patientId || ''),
          id: String(doc.id || ''),
          name: String(doc.name || 'document'),
          mimeType: String(doc.mimeType || 'application/pdf'),
          size: Number(doc.size || 0),
          storedPath: String(doc.filePath || ''),
        });
      } catch (err) {
        console.warn('[SyncService] Failed to sync patient doc to R2:', err);
      }
    }

    const labReportChanges = changes['LabReport'] || [];
    for (const report of labReportChanges) {
      try {
        await uploadLocalFile({
          kind: 'lab',
          ownerId: String(report.labOrderId || ''),
          id: String(report.id || ''),
          name: String(report.name || 'report'),
          mimeType: String(report.mimeType || 'application/pdf'),
          size: Number(report.size || 0),
          storedPath: String(report.filePath || ''),
        });
      } catch (err) {
        console.warn('[SyncService] Failed to sync lab report to R2:', err);
      }
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

    saveLastSyncTime(newSyncTime, target.schemaId || undefined);
    clearSyncCheckpoint(target.schemaId || undefined);
    syncStatus = {
      state: 'synced',
      lastSyncTime: newSyncTime,
      peerUrl: target.url,
      peerName: 'Cloud',
      message: `Synced ${pushedCount} record${pushedCount === 1 ? '' : 's'} with cloud`,
      recordsSyncedLastTime: pushedCount,
      progress: undefined,
    };
    broadcastStatus();
    isSyncing = false;
    return { ok: true, recordsSynced: pushedCount };
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

  const target = resolveSyncTarget(opts?.customPeerUrl);
  if (!target) {
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

  isSyncing = true;
  if (target.type === 'cloud') {
    return syncWithCloud(target, opts);
  }

  const targetUrl = target.url;
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
    const remoteManifestRes = await fetch(`${targetUrl}/api/sync/manifest?since=${since}`).catch(() => null);

    let recordsSynced = 0;
    let newSyncTime = Date.now();

    if (remoteManifestRes && remoteManifestRes.ok) {
      const remoteManifest = (await remoteManifestRes.json()) as SyncManifest;
      const localManifest = await extractManifest(since);
      newSyncTime = remoteManifest.serverTime || Date.now();

      const totalPushRows = localManifest.totalRows + localManifest.deletionsCount;
      const totalPullRows = remoteManifest.totalRows + remoteManifest.deletionsCount;
      const totalWork = Math.max(1, totalPushRows + totalPullRows);
      let completedWork = 0;

      if (totalPushRows === 0 && totalPullRows === 0) {
        updateProgress(100, 'All data is up to date.');
        saveLastSyncTime(newSyncTime);
        syncStatus = {
          state: 'synced',
          lastSyncTime: newSyncTime,
          peerUrl: targetUrl,
          peerName,
          message: 'All data is up to date',
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
            const pushRes = await fetch(`${targetUrl}/api/sync/push-chunk`, {
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
          const delRes = await fetch(`${targetUrl}/api/sync/push-deletions`, {
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
          const pullRes = await fetch(
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
        const delRes = await fetch(`${targetUrl}/api/sync/deletions?since=${since}`);
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
      const exchangeRes = await fetch(`${targetUrl}/api/sync/exchange`, {
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

    updateProgress(100, 'Sync complete');
    syncStatus = {
      state: 'synced',
      lastSyncTime: newSyncTime,
      peerUrl: targetUrl,
      peerName,
      message: `Successfully synchronized with ${peerName}`,
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

  // 3. Relaxed fallback heartbeat (every 15 minutes) - NOT rapid 5s/25s polling!
  autoSyncTimer = setInterval(() => {
    void triggerSync({ silent: true });
  }, 15 * 60 * 1000);
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
