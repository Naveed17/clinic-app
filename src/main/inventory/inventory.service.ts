import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';
import { DEFAULT_MEDICINE_TYPE } from '../../shared/medicineTypes';
import { medicinesMatchCatalog, normalizeMedicineMg } from '../../shared/medicineCatalog';

function db(): any {
  return getPrisma() as any;
}

async function loadMedicineMgMap(ids: string[]): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await getPrisma().$queryRawUnsafe<{ id: string; mg: number | null }[]>(
    `SELECT id, mg FROM "Medicine" WHERE id IN (${placeholders})`,
    ...ids,
  );
  for (const row of rows) {
    map.set(row.id, normalizeMedicineMg(row.mg));
  }
  return map;
}

async function attachMg<T extends { id: string; name: string }>(
  rows: T[],
): Promise<Array<T & { mg: number | null }>> {
  const mgById = await loadMedicineMgMap(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, mg: mgById.get(row.id) ?? null }));
}

async function createMedicine(
  name: string,
  unit: string = DEFAULT_MEDICINE_TYPE,
  mg?: number | null,
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const strength = normalizeMedicineMg(mg);
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO "Medicine" (id, name, unit, mg, "minStockAlert", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, 10, ?, ?)`,
    id,
    name.trim(),
    unit,
    strength,
    now,
    now,
  );
  return {
    id,
    name: name.trim(),
    unit,
    mg: strength,
    minStockAlert: 10,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

async function findCatalogByNameMg(name: string, mg?: number | null) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const strength = normalizeMedicineMg(mg);
  const rows = await getPrisma().$queryRawUnsafe<{ id: string; name: string; mg: number | null }[]>(
    `SELECT id, name, mg FROM "Medicine" WHERE LOWER(name) = LOWER(?) AND IFNULL(mg, -1) = IFNULL(?, -1) LIMIT 1`,
    trimmed,
    strength,
  );
  if (!rows[0]) return null;
  const medicine = await db().medicine.findUnique({
    where: { id: rows[0].id },
    include: catalogInclude,
  });
  return medicine ? { ...medicine, mg: normalizeMedicineMg(rows[0].mg) } : null;
}

async function ensurePriceBatch(medicineId: string, price: number) {
  const batches = await db().medicineBatch.findMany({
    where: { medicineId },
    orderBy: [{ quantity: 'desc' }, { expiryDate: 'asc' }],
  });
  if (batches.length === 0) {
    await db().medicineBatch.create({
      data: {
        id: randomUUID(),
        medicineId,
        batchNumber: 'DEFAULT',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
        purchasePrice: price,
        salePrice: price,
        quantity: 0,
      },
    });
    return;
  }
  await db().medicineBatch.update({
    where: { id: batches[0].id },
    data: { salePrice: price },
  });
}

function toCatalog(m: any) {
  const priced = (m.batches ?? []).find((b: any) => Number(b.salePrice) > 0) ?? m.batches?.[0];
  return {
    id: m.id,
    name: m.name,
    mg: normalizeMedicineMg(m.mg),
    price: Number(priced?.salePrice ?? 0),
    type: m.unit ?? DEFAULT_MEDICINE_TYPE,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

const catalogInclude = {
  batches: {
    orderBy: [{ quantity: 'desc' }, { expiryDate: 'asc' }],
  },
} as const;

/** Catalog search for prescription / billing pickers — price from FEFO batch. */
export async function searchCatalogMedicines(query: string) {
  const q = query.trim().toLowerCase();
  const medicines = await db().medicine.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { genericName: { contains: q } }] }
      : undefined,
    include: catalogInclude,
    orderBy: { name: 'asc' },
    take: q ? 50 : 200,
  });

  const withMg = await attachMg(medicines);
  const sorted = [...withMg].sort((a, b) => {
    const byName = String(a.name).localeCompare(String(b.name));
    if (byName !== 0) return byName;
    return (normalizeMedicineMg(a.mg) ?? -1) - (normalizeMedicineMg(b.mg) ?? -1);
  });

  if (!q) return sorted.map(toCatalog);

  return sorted
    .filter((m: any) => {
      const mg = normalizeMedicineMg(m.mg);
      const label = mg != null ? `${m.name} ${mg}mg` : m.name;
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.genericName ?? '').toLowerCase().includes(q) ||
        label.toLowerCase().includes(q)
      );
    })
    .map(toCatalog);
}

export async function listCatalogMedicines() {
  return searchCatalogMedicines('');
}

export async function createCatalogMedicine(
  name: string,
  price: number,
  type: string = DEFAULT_MEDICINE_TYPE,
  mg?: number | null,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Medicine name is required.');

  const strength = normalizeMedicineMg(mg);
  const existing = await findCatalogByNameMg(trimmed, strength);
  if (existing) {
    throw new Error(
      strength != null
        ? `${trimmed} ${strength}mg already exists in the catalog.`
        : `${trimmed} already exists in the catalog.`,
    );
  }

  const medicine = await createMedicine(trimmed, type, strength);
  if (price > 0) await ensurePriceBatch(medicine.id, price);

  return {
    id: medicine.id,
    name: medicine.name,
    mg: strength,
    price,
    type,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export async function updateCatalogMedicinePrice(id: string, price: number) {
  await ensurePriceBatch(id, price);
  const medicine = await db().medicine.findUnique({ where: { id } });
  if (!medicine) throw new Error('Medicine not found.');
  const mgMap = await loadMedicineMgMap([id]);
  return {
    id: medicine.id,
    name: medicine.name,
    mg: mgMap.get(id) ?? null,
    price,
    type: medicine.unit ?? DEFAULT_MEDICINE_TYPE,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export async function updateCatalogMedicine(
  id: string,
  name: string,
  price: number,
  type?: string,
  mg?: number | null,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('name is required');

  const medicine = await db().medicine.findUnique({ where: { id } });
  if (!medicine) throw new Error('Medicine not found.');

  const strength = normalizeMedicineMg(mg);
  const clash = await findCatalogByNameMg(trimmed, strength);
  if (clash && clash.id !== id) {
    throw new Error(
      strength != null
        ? `${trimmed} ${strength}mg already exists in the catalog.`
        : `${trimmed} already exists in the catalog.`,
    );
  }

  await getPrisma().$executeRawUnsafe(
    `UPDATE "Medicine" SET name = ?, mg = ?, unit = ?, "updatedAt" = ? WHERE id = ?`,
    trimmed,
    strength,
    type ?? medicine.unit ?? DEFAULT_MEDICINE_TYPE,
    new Date().toISOString(),
    id,
  );
  await ensurePriceBatch(id, price);

  const updated = await db().medicine.findUnique({ where: { id } });
  return {
    id: updated.id,
    name: updated.name,
    mg: strength,
    price,
    type: updated.unit ?? DEFAULT_MEDICINE_TYPE,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteCatalogMedicine(id: string) {
  const medicine = await db().medicine.findUnique({ where: { id } });
  if (!medicine) throw new Error('Medicine not found.');
  await db().medicine.delete({ where: { id } });
  return { ok: true, id };
}
