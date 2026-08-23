import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type DocViewerData = { type: 'pdf' | 'image'; name: string; data: string };

const useStyles = makeStyles({
  surface: {
    width: '100%',
    maxWidth: '900px',
    height: '90vh',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightBold,
  },
  body: {
    padding: 0,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  image: {
    maxWidth: '100%',
    objectFit: 'contain',
  },
  loading: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
  },
});

export function DocViewerDialog({ doc, onClose }: { doc: DocViewerData; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
  const [numPages, setNumPages] = useState(0);
  const pdfData = doc.type === 'pdf' ? { data: atob(doc.data) } : null;

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <div className={styles.header}>
          <DialogTitle as="h2" className={styles.title}>
            {doc.name}
          </DialogTitle>
          <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} aria-label="Close" />
        </div>
        <DialogBody>
          <DialogContent className={styles.body}>
            {doc.type === 'image' ? (
              <img className={styles.image} src={doc.data} alt={doc.name} />
            ) : (
              <Document
                file={pdfData}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={
                  <div className={styles.loading}>
                    <Text>Loading PDF…</Text>
                  </div>
                }
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <Page key={i + 1} pageNumber={i + 1} width={700} />
                ))}
              </Document>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
