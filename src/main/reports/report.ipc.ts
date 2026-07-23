import { ipcMain } from 'electron';
import { getReportSummary, getDetailedReport, getDoctorRevenue } from './report.service';

export function registerReportIpc(): void {
  ipcMain.handle('reports:summary', () => getReportSummary());
  ipcMain.handle('reports:detailed', (_e, from: string, to: string) => getDetailedReport(from, to));
  ipcMain.handle('reports:doctor-revenue', (_e, from: string, to: string) => getDoctorRevenue(from, to));
}
