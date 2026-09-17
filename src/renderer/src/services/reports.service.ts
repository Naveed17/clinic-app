import type { ClinicStatistics, OpdDailyReport, OpdReportInput, ReportSummary } from '@/types/report';

export const reportsService = {
  summary: () => {
    const w = window as any;
    if (typeof w?.clinic?.reports?.summary === 'function') {
      return w.clinic.reports.summary() as Promise<ReportSummary>;
    }
    return w.electron?.ipcRenderer?.invoke('reports:summary') as Promise<ReportSummary>;
  },
  stats: () => {
    const w = window as any;
    if (typeof w?.clinic?.reports?.stats === 'function') {
      return w.clinic.reports.stats() as Promise<ClinicStatistics>;
    }
    if (typeof w?.electron?.ipcRenderer?.invoke === 'function') {
      return w.electron.ipcRenderer.invoke('reports:stats') as Promise<ClinicStatistics>;
    }
    return Promise.reject(new Error('Reports stats method is not available.'));
  },
  opd: (input: OpdReportInput) => {
    const w = window as any;
    if (typeof w?.clinic?.reports?.opd === 'function') {
      return w.clinic.reports.opd(input) as Promise<OpdDailyReport>;
    }
    return w.electron?.ipcRenderer?.invoke('reports:opd', input) as Promise<OpdDailyReport>;
  },
};
