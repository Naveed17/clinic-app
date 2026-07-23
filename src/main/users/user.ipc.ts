import { ipcMain } from 'electron';
import { listUsers, createUser, updateUser, deleteUser } from './user.service';

export function registerUserIpc(): void {
  ipcMain.handle('users:list', (_, input) => listUsers(input));
  ipcMain.handle('users:create', (_, input) => createUser(input));
  ipcMain.handle('users:update', (_, id, input) => updateUser(id, input));
  ipcMain.handle('users:delete', (_, id) => deleteUser(id));
}
