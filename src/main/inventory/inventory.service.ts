import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';

function db(): any {
  return getPrisma() as any;
}

async function createMedicine(name: string) {
  return await db().medicine.create({
    data: {
      id: randomUUID(),
      name: name.trim(),
      unit: 'Tablet',
      minStockAlert: 10,
    },
  });
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
    price: Number(priced?.salePrice ?? 0),
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
  const q = query.trim();
  const medicines = await db().medicine.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { genericName: { contains: q } }] }
      : undefined,
    include: catalogInclude,
    orderBy: { name: 'asc' },
    ...(q ? { take: 50 } : {}),
  });

  return medicines.map(toCatalog);
}

export async function listCatalogMedicines() {
  return searchCatalogMedicines('');
}

export async function createCatalogMedicine(name: string, price: number) {
  const trimmed = name.trim();
  const existing = await db().medicine.findUnique({
    where: { name: trimmed },
    include: {
      batches: { orderBy: [{ quantity: 'desc' }, { expiryDate: 'asc' }] },
    },
  });
  if (existing) {
    const priced = (existing.batches ?? []).find((b: any) => Number(b.salePrice) > 0) ?? existing.batches?.[0];
    return {
      id: existing.id,
      name: existing.name,
      price: Number(priced?.salePrice ?? price ?? 0),
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  const medicine = await createMedicine(trimmed);
  if (price > 0) await ensurePriceBatch(medicine.id, price);

  return {
    id: medicine.id,
    name: medicine.name,
    price,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export async function updateCatalogMedicinePrice(id: string, price: number) {
  await ensurePriceBatch(id, price);
  const medicine = await db().medicine.findUnique({ where: { id } });
  if (!medicine) throw new Error('Medicine not found.');
  return {
    id: medicine.id,
    name: medicine.name,
    price,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export async function updateCatalogMedicine(id: string, name: string, price: number) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('name is required');

  const medicine = await db().medicine.findUnique({ where: { id } });
  if (!medicine) throw new Error('Medicine not found.');

  const clash = await db().medicine.findFirst({
    where: { name: trimmed, NOT: { id } },
  });
  if (clash) throw new Error('A medicine with this name already exists.');

  await db().medicine.update({
    where: { id },
    data: { name: trimmed },
  });
  await ensurePriceBatch(id, price);

  const updated = await db().medicine.findUnique({ where: { id } });
  return {
    id: updated.id,
    name: updated.name,
    price,
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
