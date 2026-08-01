import { ipcMain } from 'electron';
import {
  listMedicines,
  upsertMedicine,
  adjustStock,
  getLowStockMedicines,
  deleteMedicine,
} from './pharmacy.service';

export function registerPharmacyIpc(): void {
  ipcMain.handle('pharmacy:medicines:list',         (_, search?: string) => listMedicines(search));
  ipcMain.handle('pharmacy:medicines:upsert',       (_, data) => upsertMedicine(data));
  ipcMain.handle('pharmacy:medicines:adjust-stock', (_, id: string, delta: number) => adjustStock(id, delta));
  ipcMain.handle('pharmacy:medicines:low-stock',    () => getLowStockMedicines());
  ipcMain.handle('pharmacy:medicines:delete',       (_, id: string) => deleteMedicine(id));
}
