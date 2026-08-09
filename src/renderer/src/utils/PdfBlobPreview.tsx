import { Box, CircularProgress, Typography } from '@mui/material';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { useEffect, useState, type ReactElement } from 'react';

type Props = {
  /** Stable key so we regenerate when the document identity changes. */
  documentKey: string;
  /** react-pdf <Document> element — do not name this `document` (clashes with window.document). */
  pdfDocument: ReactElement<DocumentProps>;
  height?: number | string;
};

/**
 * Renders a react-pdf Document as an iframe blob preview.
 * Avoids @react-pdf/renderer PDFViewer, which often stays blank inside
 * MUI Dialogs in Electron (height: 100% with no resolved parent height).
 */
export function PdfBlobPreview({ documentKey, pdfDocument, height = 560 }: Props): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setUrl(null);
    setError(null);

    void (async () => {
      try {
        const blob = await pdf(pdfDocument).toBlob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to generate PDF preview');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // documentKey intentionally drives regeneration; pdfDocument is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!url) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box
      component="iframe"
      title="PDF preview"
      src={url}
      sx={{
        width: '100%',
        height,
        border: 'none',
        bgcolor: '#fff',
        display: 'block',
      }}
    />
  );
}
