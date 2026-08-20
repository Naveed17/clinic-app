import { Box, Button, Dialog, DialogContent, Stack } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OpdDailyReport } from '@/types/report';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';
import { buildOpdReportHtml } from '@/utils/printOpdReport';

export function OpdReportPrint({
  report,
  onClose,
}: {
  report: OpdDailyReport;
  onClose: () => void;
}): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [clinic, setClinic] = useState({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
  });
  const [logoSrc, setLogoSrc] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    void getCareflowLogoDataUrl().then(setLogoSrc);
  }, []);

  useEffect(() => {
    void window.clinic?.settings.get().then((settings) =>
      setClinic({
        clinicName: settings.clinicName ?? '',
        clinicAddress: settings.clinicAddress ?? '',
        clinicPhone: settings.clinicPhone ?? '',
      }),
    );
  }, []);

  const html = useMemo(
    () => buildOpdReportHtml(report, clinic, logoSrc),
    [report, clinic, logoSrc],
  );

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    try {
      const result = await window.clinic.print.html(html, { paper: 'A4', printDialog: false });
      if (result?.ok === false) {
        iframeRef.current?.contentWindow?.print();
      }
    } catch {
      iframeRef.current?.contentWindow?.print();
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
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto', bgcolor: '#e8eaed' }}>
        <Box
          component="iframe"
          ref={iframeRef}
          title="OPD report preview"
          srcDoc={html}
          sx={{
            display: 'block',
            width: '100%',
            minHeight: 1400,
            height: '100%',
            border: 'none',
            bgcolor: '#e8eaed',
          }}
        />
      </DialogContent>
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: '#fff',
        }}
      >
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={() => void handlePrint()} loading={printing}>
            Print
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
