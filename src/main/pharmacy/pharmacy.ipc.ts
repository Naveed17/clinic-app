import { ipcMain } from 'electron';
import {
  listMedicines,
  upsertMedicine,
  adjustStock,
  getLowStockMedicines,
  deleteMedicine,
  createSale,
  listSales,
  getSaleById,
} from './pharmacy.service';
import type { SaleInput } from './pharmacy.service';

export function registerPharmacyIpc(): void {
  // ── Medicine ──────────────────────────────────────────────────────────────
  ipcMain.handle('pharmacy:medicines:list',      (_, search?: string) => listMedicines(search));
  ipcMain.handle('pharmacy:medicines:upsert',    (_, data) => upsertMedicine(data));
  ipcMain.handle('pharmacy:medicines:adjust-stock', (_, id: string, delta: number) => adjustStock(id, delta));
  ipcMain.handle('pharmacy:medicines:low-stock', () => getLowStockMedicines());
  ipcMain.handle('pharmacy:medicines:delete',    (_, id: string) => deleteMedicine(id));

  // ── Sales ─────────────────────────────────────────────────────────────────
  ipcMain.handle('pharmacy:sales:create', (_, input: SaleInput) => createSale(input));
  ipcMain.handle('pharmacy:sales:list',   (_, filters?) => listSales(filters));
  ipcMain.handle('pharmacy:sales:get',    (_, id: string) => getSaleById(id));
}
