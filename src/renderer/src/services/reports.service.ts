import type { OpdDailyReport, OpdReportInput, ReportSummary } from '@/types/report';

export const reportsService = {
  summary: () => window.clinic.reports.summary() as Promise<ReportSummary>,
  opd: (input: OpdReportInput) => window.clinic.reports.opd(input) as Promise<OpdDailyReport>,
};
