import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface SaleItemInput {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleInput {
  patientId?: string | null;
  tokenId?: string | null;
  soldById: string;
  saleDate: string;
  notes?: string | null;
  items: SaleItemInput[];
}

type SaleRow = {
  id: string; patientId: string | null; tokenId: string | null;
  soldById: string; saleDate: string; total: number;
  notes: string | null; createdAt: string; updatedAt: string;
  patientFirstName: string | null; patientLastName: string | null;
  soldByFirstName: string; soldByLastName: string;
  tokenNumber: number | null;
};

type SaleItemRow = {
  id: string; saleId: string; medicineId: string;
  medicineName: string; quantity: number;
  unitPrice: number; lineTotal: number; createdAt: string;
};

// ─── Medicine helpers ─────────────────────────────────────────────────────────

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

// ─── Medicine CRUD ────────────────────────────────────────────────────────────

export async function listMedicines(search?: string): Promise<MedicineRow[]> {
  const db = getPrisma();
  const rows = search
    ? await db.$queryRawUnsafe<MedicineRow[]>(
        `SELECT * FROM "Medicine" WHERE name LIKE ? ORDER BY name ASC`, `%${search}%`
      )
    : await db.$queryRawUnsafe<MedicineRow[]>(
        `SELECT * FROM "Medicine" ORDER BY name ASC`
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
    // Update existing
    await db.$executeRawUnsafe(
      `UPDATE "Medicine" SET name=?, price=?, category=?, unit=?, stock=?, reorderLevel=?, updatedAt=? WHERE id=?`,
      trimmed, data.price, data.category, data.unit, data.stock, data.reorderLevel, now, data.id
    );
    const rows = await db.$queryRawUnsafe<MedicineRow[]>(`SELECT * FROM "Medicine" WHERE id=?`, data.id);
    return toMedicine(rows[0]);
  }

  // Create new
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

// ─── Sales ────────────────────────────────────────────────────────────────────

export async function createSale(input: SaleInput) {
  const db = getPrisma();
  const now = new Date().toISOString();
  const saleId = randomUUID();
  const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // 1. Insert sale
  await db.$executeRawUnsafe(
    `INSERT INTO "PharmacySale" (id, patientId, tokenId, soldById, saleDate, total, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    saleId,
    input.patientId ?? null,
    input.tokenId ?? null,
    input.soldById,
    input.saleDate,
    total,
    input.notes?.trim() ?? null,
    now, now
  );

  // 2. Insert items + reduce stock
  for (const item of input.items) {
    const itemId = randomUUID();
    const lineTotal = item.quantity * item.unitPrice;
    await db.$executeRawUnsafe(
      `INSERT INTO "PharmacySaleItem" (id, saleId, medicineId, medicineName, quantity, unitPrice, lineTotal, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      itemId, saleId, item.medicineId, item.medicineName,
      item.quantity, item.unitPrice, lineTotal, now
    );
    // Reduce stock — floor at 0
    await db.$executeRawUnsafe(
      `UPDATE "Medicine" SET stock = MAX(0, stock - ?), updatedAt=? WHERE id=?`,
      item.quantity, now, item.medicineId
    );
  }

  return getSaleById(saleId);
}

export async function getSaleById(saleId: string) {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<SaleRow[]>(`
    SELECT s.*,
      p.firstName as patientFirstName, p.lastName as patientLastName,
      u.firstName as soldByFirstName, u.lastName as soldByLastName,
      t.tokenNumber as tokenNumber
    FROM "PharmacySale" s
    LEFT JOIN "Patient" p ON p.id = s.patientId
    JOIN "User" u ON u.id = s.soldById
    LEFT JOIN "Token" t ON t.id = s.tokenId
    WHERE s.id = ?
  `, saleId);
  if (!rows[0]) return null;

  const items = await db.$queryRawUnsafe<SaleItemRow[]>(
    `SELECT * FROM "PharmacySaleItem" WHERE saleId=? ORDER BY createdAt ASC`, saleId
  );

  return formatSale(rows[0], items);
}

export async function listSales(filters?: { from?: string; to?: string; patientId?: string }) {
  const db = getPrisma();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.from)      { conditions.push('s.saleDate >= ?'); params.push(filters.from); }
  if (filters?.to)        { conditions.push('s.saleDate <= ?'); params.push(filters.to); }
  if (filters?.patientId) { conditions.push('s.patientId = ?'); params.push(filters.patientId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sales = await db.$queryRawUnsafe<SaleRow[]>(`
    SELECT s.*,
      p.firstName as patientFirstName, p.lastName as patientLastName,
      u.firstName as soldByFirstName, u.lastName as soldByLastName,
      t.tokenNumber as tokenNumber
    FROM "PharmacySale" s
    LEFT JOIN "Patient" p ON p.id = s.patientId
    JOIN "User" u ON u.id = s.soldById
    LEFT JOIN "Token" t ON t.id = s.tokenId
    ${where}
    ORDER BY s.createdAt DESC
  `, ...params);

  // Fetch items for all sales
  const result = [];
  for (const sale of sales) {
    const items = await db.$queryRawUnsafe<SaleItemRow[]>(
      `SELECT * FROM "PharmacySaleItem" WHERE saleId=? ORDER BY createdAt ASC`, sale.id
    );
    result.push(formatSale(sale, items));
  }
  return result;
}

function formatSale(sale: SaleRow, items: SaleItemRow[]) {
  return {
    id: sale.id,
    patientId: sale.patientId,
    tokenId: sale.tokenId,
    soldById: sale.soldById,
    saleDate: sale.saleDate,
    total: Number(sale.total),
    notes: sale.notes,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    patientName: sale.patientFirstName
      ? `${sale.patientFirstName} ${sale.patientLastName}`
      : null,
    soldByName: `${sale.soldByFirstName} ${sale.soldByLastName}`,
    tokenNumber: sale.tokenNumber ?? null,
    items: items.map(i => ({
      id: i.id,
      medicineId: i.medicineId,
      medicineName: i.medicineName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    })),
  };
}
