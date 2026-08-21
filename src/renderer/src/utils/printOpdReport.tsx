import { OpdReportDocument, type OpdPrintSection } from '@/features/reports/OpdReportPdf';
import type { OpdDailyReport } from '@/types/report';
import { getClinicLogoDataUrl } from '@/utils/clinicBrandLogo';
import { printReactPdfDocument } from '@/utils/printPdf';

export type { OpdPrintSection };

export async function printOpdReport(
  report: OpdDailyReport,
  section: OpdPrintSection = 'all',
): Promise<void> {
  const settings = (await window.clinic?.settings.get?.()) ?? {};
  const logoSrc = await getClinicLogoDataUrl();
  await printReactPdfDocument(
    <OpdReportDocument
      report={report}
      clinic={{
        clinicName: settings.clinicName,
        clinicAddress: settings.clinicAddress,
        clinicPhone: settings.clinicPhone,
      }}
      logoSrc={logoSrc}
      section={section}
    />,
    { paper: 'A4' },
  );
}
