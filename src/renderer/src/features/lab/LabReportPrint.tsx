import { Box, Button, Dialog, DialogContent, Stack } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
// cspell:ignore bwipjs
import bwipjs from 'bwip-js';
import type { LabOrder } from '@/types/lab';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';
import type { LabReportClinic } from './labReportPayload';
import { labReportNumber } from './labReportNumber';
import { buildLabReportHtml } from './labReportPrintHtml';

function generateBarcode(text: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text,
      scale: 2,
      height: 10,
      includetext: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function generateQr(text: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
      bcid: 'qrcode',
      text,
      scale: 3,
      includetext: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function LabReportPrint({
  order,
  onClose,
  clinicOverride,
}: {
  order: LabOrder;
  onClose: () => void;
  clinicOverride?: LabReportClinic;
}): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [clinic, setClinic] = useState<LabReportClinic>({
    clinicName: clinicOverride?.clinicName ?? '',
    clinicAddress: clinicOverride?.clinicAddress ?? '',
    clinicPhone: clinicOverride?.clinicPhone ?? '',
  });
  const [logoSrc, setLogoSrc] = useState('');
  const [printing, setPrinting] = useState(false);

  const barcodeSrc = useMemo(() => generateBarcode(labReportNumber(order.id)), [order.id]);

  const qrSrc = useMemo(() => generateQr(order.id), [order.id]);

  useEffect(() => {
    void getCareflowLogoDataUrl().then(setLogoSrc);
  }, []);

  useEffect(() => {
    if (clinicOverride?.clinicName) {
      setClinic(clinicOverride);
      return;
    }
    void window.clinic?.settings.get().then((settings) =>
      setClinic({
        clinicName: settings.clinicName ?? '',
        clinicAddress: settings.clinicAddress ?? '',
        clinicPhone: settings.clinicPhone ?? '',
      }),
    );
  }, [clinicOverride]);

  const html = useMemo(
    () =>
      buildLabReportHtml({
        order,
        clinic,
        logoSrc,
        barcodeSrc,
        qrSrc,
      }),
    [order, clinic, logoSrc, barcodeSrc, qrSrc],
  );

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    try {
      // Same HTML as preview, printed as A4 (not POS 80mm). Silent Chromium print
      // keeps backgrounds and skips browser header/footer URLs.
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
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          display: 'flex',
          flexDirection: 'column',
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
          title="Laboratory report preview"
          srcDoc={html}
          sx={{
            display: 'block',
            width: '100%',
            minHeight: 1100,
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
