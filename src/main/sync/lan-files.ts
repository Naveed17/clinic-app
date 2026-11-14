import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, normalize, sep } from 'node:path';
import { getPrisma } from '../database/client';
import { getDocumentsRoot, resolveDocPath } from '../backup/docs-paths';

/**
 * LAN document file sync (offline-first).
 * Rows of PatientDocument / LabReport already travel with the normal LAN sync and carry a
 * relative `filePath` (documents/...). This moves the actual files between the LAN server
 * and its peers so every PC can open the same documents without internet.
 */

export type DocTable = 'PatientDocument' | 'LabReport';
export const DOC_TABLES: readonly DocTable[] = ['PatientDocument', 'LabReport'];

export function isDocTable(value: unknown): value is DocTable {
  return value === 'PatientDocument' || value === 'LabReport';
}

/** Absolute path for a stored doc path — only if it stays inside CareFlow's documents folder. */
export function safeDocAbsPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const abs = normalize(resolveDocPath(stored));
  const root = normalize(getDocumentsRoot());
  if (!abs.toLowerCase().startsWith(root.toLowerCase() + sep)) return null;
  return abs;
}

async function docRows(table: DocTable, ids?: string[]): Promise<Array<{ id: string; filePath: string | null }>> {
  const db = getPrisma();
  if (!ids) {
    return db.$queryRawUnsafe<Array<{ id: string; filePath: string | null }>>(`SELECT id, filePath FROM "${table}"`);
  }
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return db.$queryRawUnsafe<Array<{ id: string; filePath: string | null }>>(
    `SELECT id, filePath FROM "${table}" WHERE id IN (${placeholders})`,
    ...ids,
  );
}

// ─── Server side (LAN server routes) ────────────────────────────────────────

/** Absolute path where this machine keeps the file for a document row (null if unknown/unsafe). */
export async function docFileAbsPath(table: DocTable, id: string): Promise<string | null> {
  const rows = await docRows(table, [id]);
  return safeDocAbsPath(rows[0]?.filePath);
}

/** Of the given ids, which rows exist here but have no file on disk yet. */
export async function findMissingDocFiles(table: DocTable, ids: string[]): Promise<string[]> {
  const rows = await docRows(table, ids);
  return rows
    .filter((r) => {
      const abs = safeDocAbsPath(r.filePath);
      return abs !== null && !existsSync(abs);
    })
    .map((r) => r.id);
}

/** Save an uploaded file for an existing row. Never overwrites an existing file. */
export async function saveDocFile(table: DocTable, id: string, data: Buffer): Promise<'saved' | 'exists' | 'unknown'> {
  const abs = await docFileAbsPath(table, id);
  if (!abs) return 'unknown';
  if (existsSync(abs)) return 'exists';
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  return 'saved';
}

// ─── Client side (called after a LAN sync) ──────────────────────────────────

const CHECK_CHUNK = 500;

/**
 * Upload local document files the LAN server is missing, then download files this PC
 * is missing. Old LAN servers without these routes are skipped silently.
 */
export async function syncLanFiles(peerUrl: string): Promise<{ uploaded: number; downloaded: number; failed: number }> {
  const result = { uploaded: 0, downloaded: 0, failed: 0 };

  for (const table of DOC_TABLES) {
    const rows = await docRows(table);
    const withFile: Array<{ id: string; abs: string }> = [];
    const withoutFile: Array<{ id: string; abs: string }> = [];
    for (const r of rows) {
      const abs = safeDocAbsPath(r.filePath);
      if (!abs) continue;
      (existsSync(abs) ? withFile : withoutFile).push({ id: r.id, abs });
    }

    // 1. Push: which of our files does the server lack?
    for (let i = 0; i < withFile.length; i += CHECK_CHUNK) {
      const chunk = withFile.slice(i, i + CHECK_CHUNK);
      const res = await fetch(`${peerUrl}/api/sync/files/missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, ids: chunk.map((c) => c.id) }),
      }).catch(() => null);
      if (!res) {
        result.failed++;
        break;
      }
      if (res.status === 404) return result; // older LAN server — no file sync support
      if (!res.ok) {
        result.failed++;
        break;
      }
      const missing = new Set(((await res.json().catch(() => ({}))) as { missing?: string[] }).missing || []);
      for (const item of chunk) {
        if (!missing.has(item.id)) continue;
        try {
          const up = await fetch(
            `${peerUrl}/api/sync/file?table=${table}&id=${encodeURIComponent(item.id)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: readFileSync(item.abs),
            },
          );
          if (up.ok) result.uploaded++;
          else result.failed++;
        } catch {
          result.failed++;
        }
      }
    }

    // 2. Pull: files we have rows for but not on disk
    for (const item of withoutFile) {
      try {
        const res = await fetch(`${peerUrl}/api/sync/file?table=${table}&id=${encodeURIComponent(item.id)}`);
        if (res.status === 404) continue; // server doesn't have it (yet)
        if (!res.ok) {
          result.failed++;
          continue;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer.length) continue;
        mkdirSync(dirname(item.abs), { recursive: true });
        writeFileSync(item.abs, buffer);
        result.downloaded++;
      } catch {
        result.failed++;
      }
    }
  }

  return result;
}
