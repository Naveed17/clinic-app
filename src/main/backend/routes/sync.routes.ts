import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { getSettings } from '../../config/settings';
import {
  extractChangesSince,
  extractManifest,
  extractTableRows,
  extractDeletions,
  applyIncomingChanges,
} from '../../sync/sync.engine';
import type {
  SyncExchangePayload,
  SyncExchangeResponse,
  SyncTableName,
  SyncDeletedItem,
} from '../../sync/sync.types';
import { emitDataChange } from '../realtime';

export function createSyncRouter(io?: SocketIOServer): Router {
  const router = Router();

  // 1. Quick status ping
  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      res.json({
        ok: true,
        clinicName: getSettings().clinicName,
        timestamp: Date.now(),
      });
    }),
  );

  // 2. Manifest: returns count of changed rows per table since `since`
  router.get(
    '/manifest',
    asyncHandler(async (req, res) => {
      const since = Number(req.query.since || 0);
      const manifest = await extractManifest(since);
      res.json({
        ok: true,
        serverName: getSettings().clinicName || 'Clinic Server',
        serverTime: manifest.currentTimestamp,
        tables: manifest.tables,
        totalRows: manifest.totalRows,
        deletionsCount: manifest.deletionsCount,
      });
    }),
  );

  // 3. Table chunk: returns paginated rows for a specific table
  router.get(
    '/table',
    asyncHandler(async (req, res) => {
      const table = String(req.query.table || '') as SyncTableName;
      const since = Number(req.query.since || 0);
      const offset = Number(req.query.offset || 0);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

      const { rows, hasMore } = await extractTableRows(table, since, offset, limit);
      res.json({
        ok: true,
        rows,
        hasMore,
      });
    }),
  );

  // 4. Deletions: returns all deletions since `since`
  router.get(
    '/deletions',
    asyncHandler(async (req, res) => {
      const since = Number(req.query.since || 0);
      const deletions = await extractDeletions(since);
      res.json({
        ok: true,
        deletions,
      });
    }),
  );

  // 5. Push chunk: receives and applies a chunk of rows for a specific table
  router.post(
    '/push-chunk',
    asyncHandler(async (req, res) => {
      const table = req.body?.table as SyncTableName;
      const rows = (req.body?.rows || []) as Record<string, unknown>[];

      if (table && rows.length > 0) {
        const { appliedChanges } = await applyIncomingChanges({ [table]: rows }, []);
        if (appliedChanges > 0 && io) {
          emitDataChange(io, table, 'sync');
        }
        res.json({ ok: true, applied: appliedChanges });
      } else {
        res.json({ ok: true, applied: 0 });
      }
    }),
  );

  // 6. Push deletions: receives and applies a chunk of deletions
  router.post(
    '/push-deletions',
    asyncHandler(async (req, res) => {
      const deletions = (req.body?.deletions || []) as SyncDeletedItem[];
      if (deletions.length > 0) {
        const { appliedDeletions } = await applyIncomingChanges({}, deletions);
        if (appliedDeletions > 0 && io) {
          emitDataChange(io, 'all', 'sync');
        }
        res.json({ ok: true, applied: appliedDeletions });
      } else {
        res.json({ ok: true, applied: 0 });
      }
    }),
  );

  // 7. Legacy monolithic exchange endpoint (for backward compatibility)
  router.post(
    '/exchange',
    asyncHandler(async (req, res) => {
      const payload = req.body as SyncExchangePayload;
      const clientSince = Number(payload?.clientSince || 0);

      let appliedTotal = 0;
      if (payload?.clientChanges || payload?.clientDeletions) {
        const { appliedChanges, appliedDeletions } = await applyIncomingChanges(
          payload.clientChanges || {},
          payload.clientDeletions || [],
        );
        appliedTotal = appliedChanges + appliedDeletions;

        if (appliedTotal > 0 && io) {
          emitDataChange(io, 'all', 'sync');
        }
      }

      const { changes, deletions, currentTimestamp } = await extractChangesSince(clientSince);

      const response: SyncExchangeResponse = {
        ok: true,
        serverChanges: changes,
        serverDeletions: deletions,
        syncedAt: currentTimestamp,
        serverName: getSettings().clinicName || 'Clinic Server',
      };

      res.json(response);
    }),
  );

  return router;
}
