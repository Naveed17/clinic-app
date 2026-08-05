import { ipcMain } from 'electron';
import {
  listCategories,
  createCategory,
  listMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  upsertMedicineWithStock,
  listBatches,
  createBatch,
  getExpiringSoonBatches,
  listSuppliers,
  createSupplier,
  listPurchaseOrders,
  createPurchaseOrder,
  listStockMovements,
  recordStockMovement,
} from './inventory.service';

/** Prisma Decimal/Date → plain JSON so Electron IPC can clone it */
function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v !== null && typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
        return (v as { toNumber: () => number }).toNumber();
      }
      return v;
    }),
  ) as T;
}

export function registerInventoryIPCHandlers(): void {
  ipcMain.handle('inventory:categories:list', async () => plain(await listCategories()));
  ipcMain.handle('inventory:categories:create', async (_, data: { name: string; description?: string }) =>
    plain(await createCategory(data)),
  );

  ipcMain.handle('inventory:medicines:list', async () => plain(await listMedicines()));
  ipcMain.handle('inventory:medicines:create', async (_, data: unknown) => plain(await createMedicine(data as any)));
  ipcMain.handle('inventory:medicines:update', async (_, { id, data }: { id: string; data: unknown }) =>
    plain(await updateMedicine(id, data as any)),
  );
  ipcMain.handle('inventory:medicines:delete', async (_, id: string) => {
    await deleteMedicine(id);
  });
  ipcMain.handle('inventory:medicines:low-stock', async () => plain(await getLowStockMedicines()));
  ipcMain.handle('inventory:medicines:upsert-with-stock', async (_, data: unknown) =>
    plain(await upsertMedicineWithStock(data as any)),
  );

  ipcMain.handle('inventory:batches:list', async () => plain(await listBatches()));
  ipcMain.handle('inventory:batches:create', async (_, data: unknown) => plain(await createBatch(data as any)));
  ipcMain.handle('inventory:batches:expiring-soon', async (_, daysAhead?: number) =>
    plain(await getExpiringSoonBatches(daysAhead ?? 60)),
  );

  ipcMain.handle('inventory:suppliers:list', async () => plain(await listSuppliers()));
  ipcMain.handle('inventory:suppliers:create', async (_, data: unknown) => plain(await createSupplier(data as any)));

  ipcMain.handle('inventory:purchases:list', async () => plain(await listPurchaseOrders()));
  ipcMain.handle('inventory:purchases:create', async (_, data: unknown) =>
    plain(await createPurchaseOrder(data as any)),
  );

  ipcMain.handle('inventory:movements:list', async () => plain(await listStockMovements()));
  ipcMain.handle('inventory:movements:record', async (_, data: unknown) =>
    plain(await recordStockMovement(data as any)),
  );
}
