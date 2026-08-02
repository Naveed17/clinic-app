import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';

export interface MedicineRow {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
}

function toMedicine(row: MedicineRow): MedicineRow {
  return {
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    category: String(row.category ?? 'General'),
    unit: String(row.unit ?? 'Piece'),
    stock: Number(row.stock ?? 0),
    reorderLevel: Number(row.reorderLevel ?? 10),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function listMedicines(search?: string): Promise<MedicineRow[]> {
  const db = getPrisma();
  const rows = search
    ? await db.$queryRawUnsafe<MedicineRow[]>(
        `SELECT * FROM "Medicine" WHERE name LIKE ? ORDER BY createdAt DESC`, `%${search}%`
      )
    : await db.$queryRawUnsafe<MedicineRow[]>(
        `SELECT * FROM "Medicine" ORDER BY createdAt DESC`
      );
  return rows.map(toMedicine);
}

export async function upsertMedicine(data: {
  id?: string;
  name: string;
  price: number;
  category: string;
  unit: string;
  stock: number;
  reorderLevel: number;
}): Promise<MedicineRow> {
  const db = getPrisma();
  const now = new Date().toISOString();
  const trimmed = data.name.trim();

  if (data.id) {
    await db.$executeRawUnsafe(
      `UPDATE "Medicine" SET name=?, price=?, category=?, unit=?, stock=?, reorderLevel=?, updatedAt=? WHERE id=?`,
      trimmed, data.price, data.category, data.unit, data.stock, data.reorderLevel, now, data.id
    );
    const rows = await db.$queryRawUnsafe<MedicineRow[]>(`SELECT * FROM "Medicine" WHERE id=?`, data.id);
    return toMedicine(rows[0]);
  }

  const id = randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "Medicine" (id, name, price, category, unit, stock, reorderLevel, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, trimmed, data.price, data.category, data.unit, data.stock, data.reorderLevel, now, now
  );
  const rows = await db.$queryRawUnsafe<MedicineRow[]>(`SELECT * FROM "Medicine" WHERE id=?`, id);
  return toMedicine(rows[0]);
}

export async function adjustStock(id: string, delta: number): Promise<MedicineRow> {
  const db = getPrisma();
  const now = new Date().toISOString();
  await db.$executeRawUnsafe(
    `UPDATE "Medicine" SET stock = MAX(0, stock + ?), updatedAt=? WHERE id=?`,
    delta, now, id
  );
  const rows = await db.$queryRawUnsafe<MedicineRow[]>(`SELECT * FROM "Medicine" WHERE id=?`, id);
  return toMedicine(rows[0]);
}

export async function getLowStockMedicines(): Promise<MedicineRow[]> {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<MedicineRow[]>(
    `SELECT * FROM "Medicine" WHERE stock <= reorderLevel ORDER BY stock ASC`
  );
  return rows.map(toMedicine);
}

export async function deleteMedicine(id: string): Promise<void> {
  const db = getPrisma();
  await db.$executeRawUnsafe(`DELETE FROM "Medicine" WHERE id=?`, id);
}