import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';

type MedRow = { id: string; name: string; price: number; createdAt: string; updatedAt: string };

function toPlain(row: MedRow) {
  return { id: String(row.id), name: String(row.name), price: Number(row.price), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };
}

export async function searchMedicines(query: string) {
  const db = getPrisma();
  const rows = query
    ? await db.$queryRawUnsafe<MedRow[]>(`SELECT * FROM "Medicine" WHERE name LIKE ? ORDER BY name ASC LIMIT 20`, `%${query}%`)
    : await db.$queryRawUnsafe<MedRow[]>(`SELECT * FROM "Medicine" ORDER BY createdAt DESC LIMIT 20`);
  return rows.map(toPlain);
}

export async function createMedicine(name: string, price: number) {
  const db = getPrisma();
  const trimmed = name.trim();
  const existing = await db.$queryRawUnsafe<MedRow[]>(
    `SELECT * FROM "Medicine" WHERE lower(name) = lower(?) LIMIT 1`, trimmed
  );
  if (existing.length > 0) return toPlain(existing[0]);
  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "Medicine" (id, name, price, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      id, trimmed, price, now, now
    );
  } catch {
    const fallback = await db.$queryRawUnsafe<MedRow[]>(
      `SELECT * FROM "Medicine" WHERE lower(name) = lower(?) LIMIT 1`, trimmed
    );
    if (fallback.length > 0) return toPlain(fallback[0]);
    throw new Error('Failed to create medicine.');
  }
  const rows = await db.$queryRawUnsafe<MedRow[]>(`SELECT * FROM "Medicine" WHERE id = ?`, id);
  return toPlain(rows[0]);
}

export async function updateMedicinePrice(id: string, price: number) {
  const db = getPrisma();
  const now = new Date().toISOString();
  await db.$executeRawUnsafe(`UPDATE "Medicine" SET price = ?, updatedAt = ? WHERE id = ?`, price, now, id);
  const rows = await db.$queryRawUnsafe<MedRow[]>(`SELECT * FROM "Medicine" WHERE id = ?`, id);
  return toPlain(rows[0]);
}

export async function listMedicines() {
  const rows = await getPrisma().$queryRawUnsafe<MedRow[]>(`SELECT * FROM "Medicine" ORDER BY createdAt DESC`);
  return rows.map(toPlain);
}