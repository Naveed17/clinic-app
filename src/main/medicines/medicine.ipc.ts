import { ipcMain } from 'electron';
import { searchMedicines, createMedicine, updateMedicinePrice, listMedicines } from './medicine.service';

export function registerMedicineIpc(): void {
  ipcMain.handle('medicines:search', (_, query: string) => searchMedicines(query));
  ipcMain.handle('medicines:list', () => listMedicines());
  ipcMain.handle('medicines:create', (_, name: string, price: number) => createMedicine(name, price));
  ipcMain.handle('medicines:update-price', (_, id: string, price: number) => updateMedicinePrice(id, price));
}
