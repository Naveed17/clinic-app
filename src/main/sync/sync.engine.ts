import { getPrisma } from '../database/client';
import {
  SYNC_TABLES,
  SYNC_COLUMNS,
  type SyncTableName,
  type SyncChanges,
  type SyncDeletedItem,
} from './sync.types';

function toEpochMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Extracts all rows from local tables that have been inserted or updated since `sinceMs`.
 */
export async function extractChangesSince(sinceMs: number): Promise<{
  changes: SyncChanges;
  deletions: SyncDeletedItem[];
  currentTimestamp: number;
}> {
  const db = getPrisma();
  const changes: SyncChanges = {};
  const currentTimestamp = Date.now();

  for (const table of SYNC_TABLES) {
    try {
      // Query rows where updatedAt is newer than sinceMs
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "${table}" 
         WHERE (typeof(updatedAt) = 'integer' AND updatedAt > ?)
            OR (typeof(updatedAt) = 'text' AND CAST(ROUND((julianday(updatedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)
         ORDER BY updatedAt ASC`,
        sinceMs,
        sinceMs,
      );

      if (rows && rows.length > 0) {
        const allowedCols = SYNC_COLUMNS[table];
        changes[table] = rows.map((r) => {
          const cleanRow: Record<string, unknown> = {};
          for (const col of allowedCols) {
            if (col in r) {
              cleanRow[col] = r[col];
            }
          }
          return cleanRow;
        });
      }
    } catch (err) {
      console.warn(`[SyncEngine] Failed to extract changes for ${table}:`, err);
    }
  }

  const deletions: SyncDeletedItem[] = [];
  try {
    const delRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, tableName, deletedAt FROM "_DeletedRecord"
       WHERE (typeof(deletedAt) = 'integer' AND deletedAt > ?)
          OR (typeof(deletedAt) = 'text' AND CAST(ROUND((julianday(deletedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)
       ORDER BY deletedAt ASC`,
      sinceMs,
      sinceMs,
    );
    if (delRows) {
      for (const d of delRows) {
        if (d.id && d.tableName) {
          deletions.push({
            id: String(d.id),
            tableName: String(d.tableName),
            deletedAt: String(d.deletedAt),
          });
        }
      }
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to query _DeletedRecord:', err);
  }

  return { changes, deletions, currentTimestamp };
}

/**
 * Returns change counts per table since `sinceMs` for quick manifest exchange.
 */
export async function extractManifest(sinceMs: number): Promise<{
  tables: Partial<Record<SyncTableName, number>>;
  totalRows: number;
  deletionsCount: number;
  currentTimestamp: number;
}> {
  const db = getPrisma();
  const tables: Partial<Record<SyncTableName, number>> = {};
  let totalRows = 0;
  const currentTimestamp = Date.now();

  for (const table of SYNC_TABLES) {
    try {
      const res = await db.$queryRawUnsafe<Array<{ count: number | bigint }>>(
        `SELECT COUNT(*) as count FROM "${table}" 
         WHERE (typeof(updatedAt) = 'integer' AND updatedAt > ?)
            OR (typeof(updatedAt) = 'text' AND CAST(ROUND((julianday(updatedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)`,
        sinceMs,
        sinceMs,
      );
      const count = Number(res?.[0]?.count || 0);
      if (count > 0) {
        tables[table] = count;
        totalRows += count;
      }
    } catch {
      // Table might not exist or error
    }
  }

  let deletionsCount = 0;
  try {
    const delRes = await db.$queryRawUnsafe<Array<{ count: number | bigint }>>(
      `SELECT COUNT(*) as count FROM "_DeletedRecord"
       WHERE (typeof(deletedAt) = 'integer' AND deletedAt > ?)
          OR (typeof(deletedAt) = 'text' AND CAST(ROUND((julianday(deletedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)`,
      sinceMs,
      sinceMs,
    );
    deletionsCount = Number(delRes?.[0]?.count || 0);
  } catch {
    // ignore
  }

  return { tables, totalRows, deletionsCount, currentTimestamp };
}

/**
 * Extracts a paginated chunk of rows for a single table since `sinceMs`.
 */
export async function extractTableRows(
  table: SyncTableName,
  sinceMs: number,
  offset: number = 0,
  limit: number = 50,
): Promise<{ rows: Record<string, unknown>[]; hasMore: boolean }> {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${table}" 
     WHERE (typeof(updatedAt) = 'integer' AND updatedAt > ?)
        OR (typeof(updatedAt) = 'text' AND CAST(ROUND((julianday(updatedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)
     ORDER BY updatedAt ASC
     LIMIT ? OFFSET ?`,
    sinceMs,
    sinceMs,
    limit,
    offset,
  );

  const allowedCols = SYNC_COLUMNS[table] || [];
  const cleanRows = (rows || []).map((r) => {
    const cleanRow: Record<string, unknown> = {};
    for (const col of allowedCols) {
      if (col in r) {
        cleanRow[col] = r[col];
      }
    }
    return cleanRow;
  });

  return {
    rows: cleanRows,
    hasMore: (rows?.length || 0) === limit,
  };
}

/**
 * Extracts all deletions since `sinceMs`.
 */
export async function extractDeletions(sinceMs: number): Promise<SyncDeletedItem[]> {
  const db = getPrisma();
  const deletions: SyncDeletedItem[] = [];
  try {
    const delRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, tableName, deletedAt FROM "_DeletedRecord"
       WHERE (typeof(deletedAt) = 'integer' AND deletedAt > ?)
          OR (typeof(deletedAt) = 'text' AND CAST(ROUND((julianday(deletedAt) - 2440587.5) * 86400000) AS INTEGER) > ?)
       ORDER BY deletedAt ASC`,
      sinceMs,
      sinceMs,
    );
    if (delRows) {
      for (const d of delRows) {
        if (d.id && d.tableName) {
          deletions.push({
            id: String(d.id),
            tableName: String(d.tableName),
            deletedAt: String(d.deletedAt),
          });
        }
      }
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to query _DeletedRecord:', err);
  }
  return deletions;
}

/**
 * Applies incoming rows & deletions into local database using atomic Last-Write-Wins.
 */
export async function applyIncomingChanges(
  changes: SyncChanges,
  deletions: SyncDeletedItem[],
): Promise<{ appliedChanges: number; appliedDeletions: number }> {
  const db = getPrisma();
  let appliedChanges = 0;
  let appliedDeletions = 0;

  // Temporarily disable foreign keys during sync upsert so table ordering won't block circular/foreign refs
  try {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  } catch { /* ignore */ }

  try {
    // 1. Apply Changes
    for (const table of SYNC_TABLES) {
      const rows = changes[table];
      if (!rows || rows.length === 0) continue;

      const allowedCols = SYNC_COLUMNS[table];

      for (const row of rows) {
        if (!row.id) continue;

        const colsPresent = Object.keys(row).filter((c) => allowedCols.includes(c));
        if (colsPresent.length === 0) continue;

        const colNames = colsPresent.map((c) => `"${c}"`).join(', ');
        const placeholders = colsPresent.map(() => '?').join(', ');
        const updateAssignments = colsPresent
          .filter((c) => c !== 'id')
          .map((c) => `"${c}" = excluded."${c}"`)
          .join(', ');

        const values = colsPresent.map((c) => {
          const val = row[c];
          if (val === undefined) return null;
          // Normalize DateTime strings or objects
          if ((c === 'createdAt' || c === 'updatedAt' || c.endsWith('At') || c === 'dateOfBirth' || c === 'expiryDate') && val != null) {
            return toEpochMs(val);
          }
          return val;
        });

        const sql = `
          INSERT INTO "${table}" (${colNames})
          VALUES (${placeholders})
          ON CONFLICT(id) DO UPDATE SET
            ${updateAssignments}
          WHERE (typeof(excluded."updatedAt") = 'integer' AND (typeof("${table}"."updatedAt") != 'integer' OR excluded."updatedAt" >= "${table}"."updatedAt"))
             OR (typeof(excluded."updatedAt") = 'text' AND julianday(excluded."updatedAt") >= julianday("${table}"."updatedAt"))
        `;

        try {
          await db.$executeRawUnsafe(sql, ...values);
          appliedChanges++;
        } catch (err) {
          console.warn(`[SyncEngine] Failed upsert for ${table} row ${row.id}:`, err);
        }
      }
    }

    // 2. Apply Deletions
    if (deletions && deletions.length > 0) {
      for (const del of deletions) {
        if (!del.id || !del.tableName) continue;
        const validTable = SYNC_TABLES.find((t) => t.toLowerCase() === del.tableName.toLowerCase());
        if (!validTable) continue;

        try {
          await db.$executeRawUnsafe(`DELETE FROM "${validTable}" WHERE id = ?`, del.id);
          await db.$executeRawUnsafe(
            `INSERT OR REPLACE INTO "_DeletedRecord" ("id", "tableName", "deletedAt") VALUES (?, ?, ?)`,
            del.id,
            validTable,
            del.deletedAt || new Date().toISOString(),
          );
          appliedDeletions++;
        } catch (err) {
          console.warn(`[SyncEngine] Failed delete for ${validTable} ${del.id}:`, err);
        }
      }
    }
  } finally {
    try {
      await db.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    } catch { /* ignore */ }
  }

  return { appliedChanges, appliedDeletions };
}
