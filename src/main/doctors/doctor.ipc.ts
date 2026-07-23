import { ipcMain } from 'electron';
import { listDoctors, createDoctor, updateDoctor, deleteDoctor } from './doctor.service';

export function registerDoctorIpc(): void {
  ipcMain.handle('doctors:list', (_, input) => listDoctors(input));
  ipcMain.handle('doctors:create', (_, input) => createDoctor(input));
  ipcMain.handle('doctors:update', (_, id, input) => updateDoctor(id, input));
  ipcMain.handle('doctors:delete', (_, id) => deleteDoctor(id));
}
