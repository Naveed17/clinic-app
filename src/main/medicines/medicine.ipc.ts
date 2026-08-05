import { ipcMain } from 'electron';
import { searchMedicines, createMedicine, updateMedicinePrice, listMedicines } from './medicine.service';

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function registerMedicineIpc(): void {
  ipcMain.handle('medicines:search', async (_, query: string) => plain(await searchMedicines(query)));
  ipcMain.handle('medicines:list', async () => plain(await listMedicines()));
  ipcMain.handle('medicines:create', async (_, name: string, price: number) =>
    plain(await createMedicine(name, price)),
  );
  ipcMain.handle('medicines:update-price', async (_, id: string, price: number) =>
    plain(await updateMedicinePrice(id, price)),
  );
}
