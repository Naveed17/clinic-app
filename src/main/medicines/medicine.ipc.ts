import { ipcMain } from 'electron';
import {
  searchMedicines,
  createMedicine,
  updateMedicinePrice,
  updateMedicine,
  deleteMedicine,
  listMedicines,
} from './medicine.service';

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function registerMedicineIpc(): void {
  ipcMain.handle('medicines:search', async (_, query: string) => plain(await searchMedicines(query)));
  ipcMain.handle('medicines:list', async () => plain(await listMedicines()));
  ipcMain.handle('medicines:create', async (_, name: string, price: number, type?: string, mg?: number | null) =>
    plain(await createMedicine(name, price, type, mg)),
  );
  ipcMain.handle('medicines:update-price', async (_, id: string, price: number) =>
    plain(await updateMedicinePrice(id, price)),
  );
  ipcMain.handle('medicines:update', async (_, id: string, name: string, price: number, type?: string, mg?: number | null) =>
    plain(await updateMedicine(id, name, price, type, mg)),
  );
  ipcMain.handle('medicines:delete', async (_, id: string) => plain(await deleteMedicine(id)));
}
