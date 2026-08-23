import { useEffect, useMemo, useState } from 'react';
import type { OpdDailyReport } from '@/types/report';
import { getClinicLogoDataUrl } from '@/utils/clinicBrandLogo';
import { printReactPdfDocument } from '@/utils/printPdf';
import { OpdReportDocument, type OpdPrintSection } from '@/features/reports/OpdReportPdf';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';

export function OpdReportPrint({
  report,
  section = 'all',
  onClose,
}: {
  report: OpdDailyReport;
  section?: OpdPrintSection;
  onClose: () => void;
}): React.JSX.Element {
  const [clinic, setClinic] = useState({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
  });
  const [logoSrc, setLogoSrc] = useState('');
  const [ready, setReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [logo, settings] = await Promise.all([
        getClinicLogoDataUrl(),
        window.clinic?.settings.get(),
      ]);
      if (cancelled) return;
      setLogoSrc(logo);
      if (settings) {
        setClinic({
          clinicName: settings.clinicName ?? '',
          clinicAddress: settings.clinicAddress ?? '',
          clinicPhone: settings.clinicPhone ?? '',
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const documentKey = [
    report.date,
    report.doctorId ?? '',
    section,
    report.invoices.count,
    report.invoices.collected,
    report.fees.count,
    report.fees.net,
    report.fees.discounted,
    clinic.clinicName,
    clinic.clinicPhone,
    logoSrc.slice(0, 48),
  ].join('|');

  const pdfDocument = useMemo(
    () => (
      <OpdReportDocument report={report} clinic={clinic} logoSrc={logoSrc} section={section} />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentKey],
  );

  const title =
    section === 'invoices' ? 'OPD invoices PDF' : section === 'fees' ? 'Doctor fees PDF' : 'OPD report PDF';

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printReactPdfDocument(pdfDocument, { paper: 'A4' });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PdfPreviewDialog
      title={title}
      onClose={onClose}
      documentKey={documentKey}
      pdfDocument={pdfDocument}
      tall
      ready={ready}
      printing={printing}
      printError={printError}
      onPrint={() => void handlePrint()}
    />
  );
}
