import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
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

const useStyles = makeStyles({
  surface: {
    width: '100%',
    maxWidth: '900px',
    height: '92vh',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  body: {
    padding: 0,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    backgroundColor: '#e8eaed',
  },
  iframe: {
    display: 'block',
    width: '100%',
    minHeight: '1100px',
    height: '100%',
    border: 'none',
    backgroundColor: '#e8eaed',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    flexShrink: 0,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

export function LabReportPrint({
  order,
  onClose,
  clinicOverride,
}: {
  order: LabOrder;
  onClose: () => void;
  clinicOverride?: LabReportClinic;
}): React.JSX.Element {
  const styles = useStyles();
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
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.body}>
            <iframe
              ref={iframeRef}
              className={styles.iframe}
              title="Laboratory report preview"
              srcDoc={html}
            />
          </DialogContent>
        </DialogBody>
        <div className={styles.footer}>
          <Button appearance="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            appearance="primary"
            onClick={() => void handlePrint()}
            disabled={printing}
            icon={printing ? <Spinner size="tiny" /> : undefined}
          >
            Print
          </Button>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
