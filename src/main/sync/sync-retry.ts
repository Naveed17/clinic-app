import { getPrisma } from '../database/client';
import { SYNC_TABLES, type SyncTableName } from './sync.types';

/**
 * Rows from another device that could not be applied (usually because their parent row —
 * e.g. the patient of a token — has not arrived yet) used to be dropped with a console
 * warning while the sync cursor moved on, so that PC never got them. They are now kept
 * here and retried after every sync until they apply (or MAX_ATTEMPTS is reached).
 */
const MAX_ATTEMPTS = 20;
const RETRY_MIN_INTERVAL_MS = 20_000;
let tableReady = false;
let lastRetryRun = 0;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await getPrisma().$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_SyncRetry" (
      "tableName" TEXT NOT NULL,
      "id" TEXT NOT NULL,
      "row" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "updatedAt" INTEGER NOT NULL,
      PRIMARY KEY ("tableName", "id")
    )
  `);
  tableReady = true;
}

export async function queueFailedRow(table: SyncTableName, row: Record<string, unknown>, error: unknown): Promise<void> {
  try {
    await ensureTable();
    const message = String((error as Error)?.message || error || '').slice(0, 500);
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO "_SyncRetry" ("tableName", "id", "row", "attempts", "lastError", "updatedAt")
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT ("tableName", "id") DO UPDATE SET
         "row" = excluded."row",
         "attempts" = "_SyncRetry"."attempts" + 1,
         "lastError" = excluded."lastError",
         "updatedAt" = excluded."updatedAt"`,
      table,
      String(row.id),
      JSON.stringify(row),
      message,
      Date.now(),
    );
  } catch (err) {
    console.warn('[SyncRetry] Could not queue failed row:', err);
  }
}

export async function pendingRetryCount(): Promise<number> {
  try {
    await ensureTable();
    const res = await getPrisma().$queryRawUnsafe<Array<{ n: number | bigint }>>(
      `SELECT COUNT(*) AS n FROM "_SyncRetry" WHERE "attempts" < ?`,
      MAX_ATTEMPTS,
    );
    return Number(res?.[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Retry queued rows parent-tables-first. `apply` is applyIncomingChanges (passed in to avoid
 * an import cycle); it returns how many rows failed again.
 */
export async function retryQueuedRows(
  apply: (table: SyncTableName, row: Record<string, unknown>) => Promise<boolean>,
): Promise<{ applied: number; stillPending: number }> {
  // Throttle: a LAN server receives many push chunks per sync; retrying the whole queue on each
  // would burn all attempts in one sync and slow every chunk down.
  if (Date.now() - lastRetryRun < RETRY_MIN_INTERVAL_MS) return { applied: 0, stillPending: 0 };
  lastRetryRun = Date.now();
  let applied = 0;
  try {
    await ensureTable();
    const db = getPrisma();
    const queued = await db.$queryRawUnsafe<Array<{ tableName: string; id: string; row: string }>>(
      `SELECT "tableName", "id", "row" FROM "_SyncRetry" WHERE "attempts" < ? LIMIT 2000`,
      MAX_ATTEMPTS,
    );
    if (!queued.length) return { applied: 0, stillPending: 0 };
    const order = (t: string) => SYNC_TABLES.indexOf(t as SyncTableName);
    queued.sort((a, b) => order(a.tableName) - order(b.tableName));

    for (const item of queued) {
      const table = SYNC_TABLES.find((t) => t === item.tableName);
      if (!table) continue;
      let row: Record<string, unknown>;
      try {
        row = JSON.parse(item.row) as Record<string, unknown>;
      } catch {
        await db.$executeRawUnsafe(`DELETE FROM "_SyncRetry" WHERE "tableName" = ? AND "id" = ?`, item.tableName, item.id);
        continue;
      }
      // apply() re-queues (attempts + 1) on failure; on success drop it from the queue.
      if (await apply(table, row)) {
        await db.$executeRawUnsafe(`DELETE FROM "_SyncRetry" WHERE "tableName" = ? AND "id" = ?`, item.tableName, item.id);
        applied++;
      }
    }
  } catch (err) {
    console.warn('[SyncRetry] Retry pass failed:', err);
  }
  return { applied, stillPending: await pendingRetryCount() };
}
