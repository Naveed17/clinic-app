import { ipcMain } from 'electron';
import { listDoctors, createDoctor, updateDoctor, deleteDoctor, getDoctor } from './doctor.service';
import { getAttendance } from './attendance.service';

export function registerDoctorIpc(): void {
  ipcMain.handle('doctors:list', (_, input) => listDoctors(input));
  ipcMain.handle('doctors:getOne', (_, id: string) => getDoctor(id));
  ipcMain.handle('doctors:attendance', (_, id: string, year: number, month: number) => getAttendance(id, year, month));
  ipcMain.handle('doctors:create', (_, input) => createDoctor(input));
  ipcMain.handle('doctors:update', (_, id, input) => updateDoctor(id, input));
  ipcMain.handle('doctors:delete', (_, id) => deleteDoctor(id));
}
