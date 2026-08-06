import { ipcMain } from 'electron';
import { getReportSummary } from './report.service';

export function registerReportIpc(): void {
  ipcMain.handle('reports:summary', () => getReportSummary());
}
