import { ipcMain } from 'electron';
import {
  searchMedicines,
  createMedicine,
  updateMedicinePrice,
  updateMedicine,
  deleteMedicine,
  listMedicines,
} from './medicine.service';

export function registerMedicineIpc(): void {
  ipcMain.handle('medicines:search', async (_, query: string) => searchMedicines(query));
  ipcMain.handle('medicines:list', async () => listMedicines());
  ipcMain.handle('medicines:create', async (_, name: string, price: number, type?: string, mg?: number | null) =>
    createMedicine(name, price, type, mg),
  );
  ipcMain.handle('medicines:update-price', async (_, id: string, price: number) =>
    updateMedicinePrice(id, price),
  );
  ipcMain.handle('medicines:update', async (_, id: string, name: string, price: number, type?: string, mg?: number | null) =>
    updateMedicine(id, name, price, type, mg),
  );
  ipcMain.handle('medicines:delete', async (_, id: string) => deleteMedicine(id));
}
