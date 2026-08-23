import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { PdfBlobPreview } from '@/utils/PdfBlobPreview';
import { CloseOutlinedIcon, PrintOutlinedIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  surface: {
    maxWidth: '960px',
    width: 'min(980px, 96vw)',
    maxHeight: '90vh',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 0,
  },
  surfaceTall: {
    height: '92vh',
    maxHeight: '92vh',
  },
  header: {
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
  },
  body: {
    padding: 0,
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
  },
  bodyGray: {
    backgroundColor: '#e8eaed',
  },
  footer: {
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    flexShrink: 0,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  empty: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground2,
  },
});

export function PdfPreviewDialog({
  title,
  onClose,
  documentKey,
  pdfDocument,
  previewHeight = 560,
  tall,
  ready = true,
  printing,
  printError,
  onPrint,
  emptyMessage,
}: {
  title: string;
  onClose: () => void;
  documentKey?: string;
  pdfDocument?: ReactElement<DocumentProps>;
  previewHeight?: number | string;
  tall?: boolean;
  ready?: boolean;
  printing: boolean;
  printError: string | null;
  onPrint: () => void;
  emptyMessage?: ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  if (emptyMessage) {
    return (
      <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
        <DialogSurface>
          <DialogBody>
            <DialogContent className={styles.empty}>
              <Text>{emptyMessage}</Text>
              <div style={{ marginTop: 16 }}>
                <Button appearance="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={`${styles.surface} ${tall ? styles.surfaceTall : ''}`}>
        <div className={styles.header}>
          <Text className={styles.title}>{title}</Text>
          <Button appearance="subtle" size="small" icon={<CloseOutlinedIcon />} onClick={onClose}>
            Close
          </Button>
        </div>
        <DialogBody style={{ flex: 1, minHeight: 0, margin: 0 }}>
          <DialogContent className={`${styles.body} ${tall ? styles.bodyGray : ''}`}>
            {ready && documentKey && pdfDocument ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <PdfBlobPreview
                  documentKey={documentKey}
                  pdfDocument={pdfDocument}
                  height={tall ? '100%' : previewHeight}
                />
              </div>
            ) : (
              <div className={styles.loading}>
                <Text size={200}>Preparing PDF…</Text>
              </div>
            )}
          </DialogContent>
        </DialogBody>
        <div className={styles.footer}>
          {printError ? (
            <MessageBar intent="error">
              <MessageBarBody>{printError}</MessageBarBody>
            </MessageBar>
          ) : null}
          <div className={styles.actions}>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              appearance="primary"
              icon={printing ? <Spinner size="tiny" /> : <PrintOutlinedIcon />}
              disabled={printing || !ready}
              onClick={onPrint}
            >
              Print
            </Button>
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
