import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getSettings } from '../config/settings';
import { getDiscoveredServers } from '../settings/settings.ipc';
import {
  extractChangesSince,
  extractManifest,
  extractTableRows,
  extractDeletions,
  applyIncomingChanges,
} from './sync.engine';
import {
  SYNC_TABLES,
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

function loadLastSyncTime(): number {
  try {
    const file = getSyncStateFilePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as { lastSyncTime?: number };
      return Number(data?.lastSyncTime || 0);
    }
  } catch { /* ignore */ }
  return 0;
}

function saveLastSyncTime(timestamp: number): void {
  try {
    writeFileSync(
      getSyncStateFilePath(),
      JSON.stringify({ lastSyncTime: timestamp, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.warn('[SyncService] Failed to save last sync timestamp:', err);
  }
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
      win.webContents.send('clinic:sync:status-changed', syncStatus);
    }
  }
}

function notifyDataChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
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

/**
 * Resolves the peer URL to talk to.
 */
export function resolvePeerUrl(): string | null {
  const settings = getSettings();
  if (settings.clientApiUrl && settings.clientApiUrl.trim()) {
    return settings.clientApiUrl.trim().replace(/\/+$/, '');
  }

  const discovered = getDiscoveredServers();
  if (discovered && discovered.length > 0) {
    const first = discovered[0];
    return `http://${first.ip}:${first.port}`;
  }

  return null;
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

  const targetUrl = opts?.customPeerUrl || resolvePeerUrl();
  if (!targetUrl) {
    syncStatus = {
      ...syncStatus,
      state: 'offline',
      peerUrl: null,
      message: 'No clinic peer discovered. Working offline.',
      progress: undefined,
    };
    if (!opts?.silent) broadcastStatus();
    return { ok: false, error: 'No clinic peer found.' };
  }

  isSyncing = true;
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

export function startAutoSync(): void {
  if (autoSyncTimer) return;
  // Initial check after 3 seconds
  setTimeout(() => {
    void triggerSync({ silent: true });
  }, 3000);

  // Background interval every 25 seconds
  autoSyncTimer = setInterval(() => {
    void triggerSync({ silent: true });
  }, 25000);
}

export function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = undefined;
  }
}
