import { ipcMain } from 'electron';
import { globalSearch } from './search.service';

export function registerSearchIpc(): void {
  ipcMain.handle('search:global', (_, query: string) => globalSearch(query));
}
