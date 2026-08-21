import { Alert, Box, Button, Dialog, DialogContent, Stack, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { useEffect, useMemo, useState } from 'react';
import type { OpdDailyReport } from '@/types/report';
import { getClinicLogoDataUrl } from '@/utils/clinicBrandLogo';
import { PdfBlobPreview } from '@/utils/PdfBlobPreview';
import { printReactPdfDocument } from '@/utils/printPdf';
import { OpdReportDocument, type OpdPrintSection } from '@/features/reports/OpdReportPdf';

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
      <OpdReportDocument
        report={report}
        clinic={clinic}
        logoSrc={logoSrc}
        section={section}
      />
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
    <Dialog
      open
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          display: 'flex',
          flexDirection: 'column',
          width: 'min(980px, 96vw)',
          maxWidth: '980px',
          height: '92vh',
          maxHeight: '92vh',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography fontWeight={700} fontSize={15}>
          {title}
        </Typography>
        <Button onClick={onClose} size="small" startIcon={<CloseOutlinedIcon />}>
          Close
        </Button>
      </Box>
      <DialogContent
        sx={{
          p: 0,
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: '#e8eaed',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {ready ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <PdfBlobPreview documentKey={documentKey} pdfDocument={pdfDocument} height="100%" />
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              Preparing PDF…
            </Typography>
          </Box>
        )}
      </DialogContent>
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: '#fff',
        }}
      >
        {printError ? <Alert severity="error">{printError}</Alert> : null}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => void handlePrint()}
            loading={printing}
            disabled={printing || !ready}
          >
            Print
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
