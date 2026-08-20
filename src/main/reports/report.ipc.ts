import { ipcMain } from 'electron';
import { isOpdReportsLicensed } from '../license/license.ipc';
import { getOpdDailyReport, getReportSummary, type OpdReportInput } from './report.service';

function assertOpdReportsAddon(): void {
  if (!isOpdReportsLicensed()) {
    throw new Error('OPD Reports add-on is not enabled for this license.');
  }
}

export function registerReportIpc(): void {
  ipcMain.handle('reports:summary', () => getReportSummary());
  ipcMain.handle('reports:opd', (_event, input: OpdReportInput) => {
    assertOpdReportsAddon();
    return getOpdDailyReport(input ?? {});
  });
}
