import { getPrisma } from '../database/client';
import { randomUUID } from 'node:crypto';

export interface MedicineInput {
  name: string;
  genericName?: string;
  categoryId?: string;
  barcode?: string;
  unit?: string;
  rackNumber?: string;
  minStockAlert?: number;
}

export interface BatchInput {
  medicineId: string;
  batchNumber: string;
  expiryDate: string | Date;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
}

export interface SupplierInput {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PurchaseOrderItemInput {
  batchId?: string;
  medicineId?: string;
  batchNumber?: string;
  expiryDate?: string | Date;
  purchasePrice?: number;
  salePrice?: number;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderInput {
  invoiceNumber: string;
  supplierId: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export interface StockMovementInput {
  batchId: string;
  type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGE' | 'DISPENSE';
  quantity: number;
  reference?: string;
}

// Helper to safely access Prisma Models with Type Casting
function db(): any {
  return getPrisma() as any;
}

// ==========================================
// MEDICINE CATEGORIES
// ==========================================

export async function listCategories() {
  return await db().medicineCategory.findMany({
    include: { _count: { select: { medicines: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(data: { name: string; description?: string }) {
  return await db().medicineCategory.create({
    data: {
      id: randomUUID(),
      name: data.name,
      description: data.description ?? null,
    },
  });
}

// ==========================================
// MEDICINES
// ==========================================

export async function listMedicines() {
  return await db().medicine.findMany({
    include: {
      category: true,
      batches: {
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createMedicine(data: MedicineInput) {
  return await db().medicine.create({
    data: {
      id: randomUUID(),
      name: data.name.trim(),
      genericName: data.genericName ?? null,
      categoryId: data.categoryId ?? null,
      barcode: data.barcode ?? null,
      unit: data.unit ?? 'Tablet',
      rackNumber: data.rackNumber ?? null,
      minStockAlert: data.minStockAlert ?? 10,
    },
    include: { category: true },
  });
}

export async function updateMedicine(id: string, data: Partial<MedicineInput>) {
  return await db().medicine.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.genericName !== undefined && { genericName: data.genericName }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.rackNumber !== undefined && { rackNumber: data.rackNumber }),
      ...(data.minStockAlert !== undefined && { minStockAlert: data.minStockAlert }),
    },
    include: { category: true },
  });
}

export async function deleteMedicine(id: string) {
  await db().medicine.delete({ where: { id } });
}

export async function getLowStockMedicines() {
  const medicines = await db().medicine.findMany({
    include: {
      category: true,
      batches: true,
    },
    orderBy: { name: 'asc' },
  });

  return medicines
    .map((m: any) => {
      const stock = (m.batches ?? []).reduce((sum: number, b: any) => sum + Number(b.quantity ?? 0), 0);
      return { ...m, stock };
    })
    .filter((m: any) => m.stock <= Number(m.minStockAlert ?? 0));
}

export async function ensureCategoryByName(name: string) {
  const trimmed = name.trim() || 'General';
  const existing = await db().medicineCategory.findUnique({
    where: { name: trimmed },
  });
  if (existing) return existing;
  try {
    return await createCategory({ name: trimmed });
  } catch {
    const again = await db().medicineCategory.findUnique({ where: { name: trimmed } });
    if (again) return again;
    throw new Error(`Could not create category: ${trimmed}`);
  }
}

/**
 * Create medicine and optional opening stock batch (for UI / quick-add flows).
 */
export async function upsertMedicineWithStock(input: {
  id?: string;
  name: string;
  unit?: string;
  category?: string;
  minStockAlert?: number;
  salePrice?: number;
  stock?: number;
  genericName?: string;
  rackNumber?: string;
}) {
  const category = input.category
    ? await ensureCategoryByName(input.category)
    : null;

  let medicine;
  if (input.id) {
    medicine = await updateMedicine(input.id, {
      name: input.name,
      unit: input.unit,
      categoryId: category?.id ?? null,
      minStockAlert: input.minStockAlert,
      genericName: input.genericName,
      rackNumber: input.rackNumber,
    });
  } else {
    medicine = await createMedicine({
      name: input.name,
      unit: input.unit,
      categoryId: category?.id,
      minStockAlert: input.minStockAlert,
      genericName: input.genericName,
      rackNumber: input.rackNumber,
    });
  }

  const desiredStock = Math.max(0, Math.floor(Number(input.stock ?? 0)));
  const salePrice = Number(input.salePrice ?? 0);

  const batches = await db().medicineBatch.findMany({
    where: { medicineId: medicine.id },
    orderBy: { expiryDate: 'asc' },
  });
  const currentStock = batches.reduce((s: number, b: any) => s + Number(b.quantity ?? 0), 0);

  if (!input.id && desiredStock > 0) {
    await createBatch({
      medicineId: medicine.id,
      batchNumber: 'OPENING',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
      purchasePrice: salePrice,
      salePrice,
      quantity: desiredStock,
    });
  } else if (input.id && desiredStock !== currentStock) {
    const delta = desiredStock - currentStock;
    if (batches.length === 0 && delta > 0) {
      await createBatch({
        medicineId: medicine.id,
        batchNumber: 'ADJUST',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
        purchasePrice: salePrice,
        salePrice,
        quantity: delta,
      });
    } else if (batches.length > 0) {
      const target = batches[0];
      await recordStockMovement({
        batchId: target.id,
        type: 'ADJUSTMENT',
        quantity: delta,
        reference: 'Manual stock set from inventory UI',
      });
      if (salePrice > 0) {
        await db().medicineBatch.update({
          where: { id: target.id },
          data: { salePrice },
        });
      }
    }
  } else if (input.id && salePrice > 0 && batches.length > 0) {
    await db().medicineBatch.update({
      where: { id: batches[0].id },
      data: { salePrice },
    });
  }

  return await db().medicine.findUnique({
    where: { id: medicine.id },
    include: {
      category: true,
      batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
    },
  });
}

/** Catalog search for prescription / billing pickers — price from FEFO batch. */
export async function searchCatalogMedicines(query: string) {
  const q = query.trim();
  const medicines = await db().medicine.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { genericName: { contains: q } }] }
      : undefined,
    include: {
      batches: {
        orderBy: [{ quantity: 'desc' }, { expiryDate: 'asc' }],
      },
    },
    orderBy: q ? { name: 'asc' } : { createdAt: 'desc' },
    take: 50,
  });

  return medicines.map((m: any) => {
    const priced = (m.batches ?? []).find((b: any) => Number(b.salePrice) > 0) ?? m.batches?.[0];
    return {
      id: m.id,
      name: m.name,
      price: Number(priced?.salePrice ?? 0),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });
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

  const medicine = await createMedicine({ name: trimmed });
  if (price > 0) {
    await createBatch({
      medicineId: medicine.id,
      batchNumber: 'DEFAULT',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
      purchasePrice: price,
      salePrice: price,
      quantity: 0,
    });
  }

  return {
    id: medicine.id,
    name: medicine.name,
    price,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

export async function updateCatalogMedicinePrice(id: string, price: number) {
  const batches = await db().medicineBatch.findMany({
    where: { medicineId: id },
    orderBy: [{ quantity: 'desc' }, { expiryDate: 'asc' }],
  });

  if (batches.length === 0) {
    await createBatch({
      medicineId: id,
      batchNumber: 'DEFAULT',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
      purchasePrice: price,
      salePrice: price,
      quantity: 0,
    });
  } else {
    await db().medicineBatch.update({
      where: { id: batches[0].id },
      data: { salePrice: price },
    });
  }

  const medicine = await db().medicine.findUnique({ where: { id } });
  return {
    id: medicine.id,
    name: medicine.name,
    price,
    createdAt: medicine.createdAt,
    updatedAt: medicine.updatedAt,
  };
}

/**
 * FEFO stock change by medicine name.
 * delta < 0 dispenses; delta > 0 restores into earliest batch (or creates one).
 */
export async function adjustStockByMedicineName(
  name: string,
  delta: number,
  reference?: string,
) {
  const trimmed = name.trim();
  if (!trimmed || delta === 0) return;

  const medicine = await db().medicine.findFirst({
    where: { name: trimmed },
  });
  if (!medicine) return;

  if (delta < 0) {
    let remaining = Math.abs(delta);
    const batches = await db().medicineBatch.findMany({
      where: { medicineId: medicine.id, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.quantity), remaining);
      await db().medicineBatch.update({
        where: { id: batch.id },
        data: { quantity: { decrement: take } },
      });
      await db().stockMovement.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          type: 'DISPENSE',
          quantity: -take,
          reference: reference ?? null,
        },
      });
      remaining -= take;
    }
    return;
  }

  // Restore / add stock
  const batch = await db().medicineBatch.findFirst({
    where: { medicineId: medicine.id },
    orderBy: { expiryDate: 'asc' },
  });

  if (batch) {
    await recordStockMovement({
      batchId: batch.id,
      type: 'RETURN',
      quantity: delta,
      reference: reference ?? 'Stock restore',
    });
  } else {
    await createBatch({
      medicineId: medicine.id,
      batchNumber: 'RESTORE',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2),
      purchasePrice: 0,
      salePrice: 0,
      quantity: delta,
    });
  }
}

// ==========================================
// BATCHES & EXPIRY
// ==========================================

export async function listBatches() {
  return await db().medicineBatch.findMany({
    include: { medicine: true },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function createBatch(data: BatchInput) {
  const expiryDate = new Date(data.expiryDate);

  return await db().$transaction(async (tx: any) => {
    const batchId = randomUUID();
    const batch = await tx.medicineBatch.create({
      data: {
        id: batchId,
        medicineId: data.medicineId,
        batchNumber: data.batchNumber,
        expiryDate,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        quantity: data.quantity,
      },
      include: { medicine: true },
    });

    if (data.quantity !== 0) {
      await tx.stockMovement.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          type: 'PURCHASE',
          quantity: data.quantity,
          reference: 'Initial Batch Creation',
        },
      });
    }

    return batch;
  });
}

export async function getExpiringSoonBatches(daysAhead = 60) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);

  return await db().medicineBatch.findMany({
    where: {
      expiryDate: {
        lte: targetDate,
      },
      quantity: { gt: 0 },
    },
    include: { medicine: true },
    orderBy: { expiryDate: 'asc' },
  });
}

// ==========================================
// SUPPLIERS
// ==========================================

export async function listSuppliers() {
  return await db().supplier.findMany({
    include: { _count: { select: { purchases: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(data: SupplierInput) {
  return await db().supplier.create({
    data: {
      id: randomUUID(),
      name: data.name,
      companyName: data.companyName ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
    },
  });
}

// ==========================================
// PURCHASE ORDERS
// ==========================================

export async function listPurchaseOrders() {
  return await db().purchaseOrder.findMany({
    include: {
      supplier: true,
      items: { include: { batch: { include: { medicine: true } } } },
    },
    orderBy: { purchaseDate: 'desc' },
  });
}

export async function createPurchaseOrder(data: PurchaseOrderInput) {
  return await db().$transaction(async (tx: any) => {
    let totalAmount = 0;
    const itemsData = [];

    for (const item of data.items) {
      let batchId = item.batchId;

      if (!batchId && item.medicineId && item.batchNumber && item.expiryDate) {
        const existingBatch = await tx.medicineBatch.findFirst({
          where: {
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
          },
        });

        if (existingBatch) {
          const updated = await tx.medicineBatch.update({
            where: { id: existingBatch.id },
            data: {
              quantity: { increment: item.quantity },
              purchasePrice: item.purchasePrice ?? item.unitPrice,
              salePrice: item.salePrice ?? existingBatch.salePrice,
            },
          });
          batchId = updated.id;
        } else {
          const newBatch = await tx.medicineBatch.create({
            data: {
              id: randomUUID(),
              medicineId: item.medicineId,
              batchNumber: item.batchNumber,
              expiryDate: new Date(item.expiryDate),
              purchasePrice: item.purchasePrice ?? item.unitPrice,
              salePrice: item.salePrice ?? 0,
              quantity: item.quantity,
            },
          });
          batchId = newBatch.id;
        }
      } else if (batchId) {
        await tx.medicineBatch.update({
          where: { id: batchId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      if (!batchId) {
        throw new Error('Batch ID or complete batch details must be provided.');
      }

      const lineTotal = item.quantity * item.unitPrice;
      totalAmount += lineTotal;

      itemsData.push({
        id: randomUUID(),
        batchId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      });

      await tx.stockMovement.create({
        data: {
          id: randomUUID(),
          batchId,
          type: 'PURCHASE',
          quantity: item.quantity,
          reference: `PO Invoice: ${data.invoiceNumber}`,
        },
      });
    }

    const purchaseOrderId = randomUUID();
    return await tx.purchaseOrder.create({
      data: {
        id: purchaseOrderId,
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        notes: data.notes ?? null,
        totalAmount,
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: true,
        items: { include: { batch: { include: { medicine: true } } } },
      },
    });
  });
}

// ==========================================
// STOCK MOVEMENTS & AUDIT
// ==========================================

export async function listStockMovements() {
  return await db().stockMovement.findMany({
    include: {
      batch: { include: { medicine: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function recordStockMovement(data: StockMovementInput) {
  return await db().$transaction(async (tx: any) => {
    const updatedBatch = await tx.medicineBatch.update({
      where: { id: data.batchId },
      data: {
        quantity: { increment: data.quantity },
      },
    });

    if (updatedBatch.quantity < 0) {
      throw new Error('Stock quantity cannot be negative.');
    }

    return await tx.stockMovement.create({
      data: {
        id: randomUUID(),
        batchId: data.batchId,
        type: data.type,
        quantity: data.quantity,
        reference: data.reference ?? null,
      },
      include: { batch: { include: { medicine: true } } },
    });
  });
}