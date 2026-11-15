import { existsSync, unlinkSync } from 'node:fs';
import { getPrisma } from '../database/client';
import { queueFailedRow, retryQueuedRows } from './sync-retry';
import { resolveDocPath } from '../backup/docs-paths';
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
      // Query rows: full table if sinceMs <= 0, or newer than sinceMs
      let rows: Record<string, unknown>[] = [];
      if (sinceMs <= 0) {
        rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM "${table}"`,
        );
      } else {
        rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM "${table}" 
           WHERE ("updatedAt" > ? AND "updatedAt" <= 9007199254740991)
          OR ("updatedAt" >= '' AND CAST(ROUND((julianday("updatedAt") - 2440587.5) * 86400000) AS INTEGER) > ?)
           ORDER BY updatedAt ASC`,
          sinceMs,
          sinceMs,
        );
      }

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
         WHERE ("updatedAt" > ? AND "updatedAt" <= 9007199254740991)
          OR ("updatedAt" >= '' AND CAST(ROUND((julianday("updatedAt") - 2440587.5) * 86400000) AS INTEGER) > ?)`,
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
     WHERE ("updatedAt" > ? AND "updatedAt" <= 9007199254740991)
          OR ("updatedAt" >= '' AND CAST(ROUND((julianday("updatedAt") - 2440587.5) * 86400000) AS INTEGER) > ?)
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

type Db = ReturnType<typeof getPrisma>;

async function nextFreeMrNumber(db: Db): Promise<string> {
  const res = await db.$queryRawUnsafe<Array<{ maxNum: number | bigint | null }>>(
    `SELECT MAX(CAST(SUBSTR("mrNumber", 4) AS INTEGER)) AS maxNum FROM "Patient" WHERE "mrNumber" LIKE 'MR-%'`,
  );
  let candidate = Number(res?.[0]?.maxNum ?? 0) + 1;
  for (;;) {
    const mr = `MR-${String(candidate).padStart(5, '0')}`;
    const taken = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Patient" WHERE "mrNumber" = ? LIMIT 1`,
      mr,
    );
    if (!taken.length) return mr;
    candidate++;
  }
}

/** Patient.mrNumber / Token(date, tokenNumber, doctorId) conflicts → renumber the incoming row. */
async function renumberOnConflict(db: Db, table: SyncTableName, row: Record<string, unknown>): Promise<void> {
  try {
    if (table === 'Patient' && row.mrNumber) {
      const clash = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Patient" WHERE "mrNumber" = ? AND id != ? LIMIT 1`,
        String(row.mrNumber),
        String(row.id),
      );
      if (clash.length) {
        row.mrNumber = await nextFreeMrNumber(db);
        row.updatedAt = Date.now();
      }
    } else if (table === 'Token' && row.date && row.tokenNumber != null && row.doctorId) {
      const clash = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Token" WHERE "date" = ? AND "tokenNumber" = ? AND "doctorId" = ? AND id != ? LIMIT 1`,
        String(row.date),
        Number(row.tokenNumber),
        String(row.doctorId),
        String(row.id),
      );
      if (clash.length) {
        const next = await db.$queryRawUnsafe<Array<{ n: number | bigint }>>(
          `SELECT COALESCE(MAX("tokenNumber"), 0) + 1 AS n FROM "Token" WHERE "date" = ? AND "doctorId" = ?`,
          String(row.date),
          String(row.doctorId),
        );
        row.tokenNumber = Number(next?.[0]?.n ?? 1);
        row.updatedAt = Date.now();
      }
    }
  } catch (err) {
    console.warn(`[SyncEngine] Renumber check failed for ${table} ${String(row.id)}:`, err);
  }
}

/**
 * Applies incoming rows & deletions into local database using atomic Last-Write-Wins.
 */
export async function applyIncomingChanges(
  changes: SyncChanges,
  deletions: SyncDeletedItem[],
): Promise<{ appliedChanges: number; appliedDeletions: number; failedRows: number }> {
  const db = getPrisma();
  let appliedChanges = 0;
  let appliedDeletions = 0;
  let failedRows = 0;

  // Note: no PRAGMA foreign_keys toggling here. Prisma uses a pool of SQLite connections, so a
  // pragma only reaches one random connection. Rows that fail (e.g. parent not synced yet) are
  // queued and retried on the next sync instead (see sync-retry.ts).

  try {
    // 1. Apply Changes
    for (const table of SYNC_TABLES) {
      const rows = changes[table];
      if (!rows || rows.length === 0) continue;

      const allowedCols = SYNC_COLUMNS[table];

      for (const row of rows) {
        if (!row.id) continue;

        // Normalize enum values from mobile / cloud
        if (table === 'Token' && row.status) {
          if (row.status === 'COMPLETED') row.status = 'DONE';
          if (row.status === 'IN_CONSULTATION') row.status = 'IN_PROGRESS';
        }
        if (table === 'Appointment' && row.status) {
          if (row.status === 'CONFIRMED' || row.status === 'PENDING') row.status = 'SCHEDULED';
        }

        // Offline PCs number MR / tokens on their own, so the same number can arrive for a
        // different record. Give the incoming row the next free number (never drop or delete it)
        // and bump updatedAt so the new number syncs back to the PC it came from.
        await renumberOnConflict(db, table, row);

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

        // Pre-reconcile secondary unique constraints to avoid SQLite aborts
        if (table === 'User' && row.email) {
          try {
            const existingWithEmail = await db.$queryRawUnsafe<{ id: string }[]>(
              `SELECT id FROM "User" WHERE LOWER(email) = LOWER(?) AND id != ?`,
              String(row.email).trim(),
              row.id,
            );
            if (existingWithEmail && existingWithEmail.length > 0) {
              const oldId = existingWithEmail[0].id;
              await db.$executeRawUnsafe(`UPDATE "DoctorProfile" SET "userId" = ? WHERE "userId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "DoctorSchedule" SET "doctorId" = ? WHERE "doctorId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "DoctorAttendance" SET "doctorId" = ? WHERE "doctorId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "Appointment" SET "providerId" = ? WHERE "providerId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "Token" SET "doctorId" = ? WHERE "doctorId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "Patient" SET "primaryDoctorId" = ? WHERE "primaryDoctorId" = ?`, row.id, oldId).catch(() => {});
              await db.$executeRawUnsafe(`UPDATE "User" SET id = ? WHERE id = ?`, row.id, oldId);
            }
          } catch {
            await db.$executeRawUnsafe(`DELETE FROM "User" WHERE LOWER(email) = LOWER(?) AND id != ?`, String(row.email).trim(), row.id).catch(() => {});
          }
        } else if (table === 'DoctorProfile' && row.userId) {
          await db.$executeRawUnsafe(
            `DELETE FROM "DoctorProfile" WHERE "userId" = ? AND id != ?`,
            row.userId,
            row.id,
          ).catch(() => {});
        } else if (table === 'DoctorSchedule' && row.doctorId && row.dayOfWeek !== undefined) {
          await db.$executeRawUnsafe(
            `DELETE FROM "DoctorSchedule" WHERE "doctorId" = ? AND "dayOfWeek" = ? AND id != ?`,
            row.doctorId,
            row.dayOfWeek,
            row.id,
          ).catch(() => {});
        } else if (table === 'DoctorAttendance' && row.doctorId && row.date) {
          await db.$executeRawUnsafe(
            `DELETE FROM "DoctorAttendance" WHERE "doctorId" = ? AND "date" = ? AND id != ?`,
            row.doctorId,
            row.date,
            row.id,
          ).catch(() => {});
        }

        const sql = `
          INSERT INTO "${table}" (${colNames})
          VALUES (${placeholders})
          ON CONFLICT(id) DO UPDATE SET
            ${updateAssignments}
          WHERE (typeof(excluded."updatedAt") = 'integer' AND (typeof("${table}"."updatedAt") != 'integer' OR excluded."updatedAt" >= "${table}"."updatedAt"))
             OR (typeof(excluded."updatedAt") = 'text' AND julianday(excluded."updatedAt") >= julianday("${table}"."updatedAt"))
        `;

        try {
          // Count only real inserts/updates (LWW no-op returns 0) so re-pulled rows are not reported.
          const affected = await db.$executeRawUnsafe(sql, ...values);
          if (affected > 0) appliedChanges++;
        } catch (err) {
          console.warn(`[SyncEngine] Failed upsert for ${table} row ${row.id}:`, err);
          failedRows++;
          await queueFailedRow(table, row, err);
        }
      }
    }

    // 2. Apply Deletions
    if (deletions && deletions.length > 0) {
      const order = (name: string) => {
        const i = SYNC_TABLES.findIndex((t) => t.toLowerCase() === String(name || '').toLowerCase());
        return i < 0 ? -1 : i;
      };
      const childFirst = [...deletions].sort((a, b) => order(b.tableName) - order(a.tableName));
      for (const del of childFirst) {
        if (!del.id || !del.tableName) continue;
        const validTable = SYNC_TABLES.find((t) => t.toLowerCase() === del.tableName.toLowerCase());
        if (!validTable) continue;

        try {
          // Document rows: also remove the file from disk.
          let docFile: string | null = null;
          if (validTable === 'PatientDocument' || validTable === 'LabReport') {
            const found = await db
              .$queryRawUnsafe<Array<{ filePath: string | null }>>(`SELECT filePath FROM "${validTable}" WHERE id = ?`, del.id)
              .catch(() => []);
            docFile = found[0]?.filePath ?? null;
          }
          const removed = await db.$executeRawUnsafe(`DELETE FROM "${validTable}" WHERE id = ?`, del.id);
          if (removed === 0) continue; // already gone here — nothing to apply
          if (docFile) {
            try {
              const abs = resolveDocPath(docFile);
              if (existsSync(abs)) unlinkSync(abs);
            } catch { /* file cleanup is best-effort */ }
          }
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
    /* nothing to restore */
  }

  return { appliedChanges, appliedDeletions, failedRows };
}

/** Re-apply rows that failed in an earlier sync (their parent row may have arrived since). */
export async function retryPendingRows(): Promise<{ applied: number; stillPending: number }> {
  return retryQueuedRows(async (table, row) => {
    const { failedRows } = await applyIncomingChanges({ [table]: [row] }, []);
    return failedRows === 0;
  });
}
