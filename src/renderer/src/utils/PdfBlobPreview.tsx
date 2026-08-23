import { Spinner, Text } from '@fluentui/react-components';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { useEffect, useState, type ReactElement } from 'react';

type Props = {
  documentKey: string;
  pdfDocument: ReactElement<DocumentProps>;
  height?: number | string;
};

/**
 * Renders a react-pdf Document as an iframe blob preview.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text style={{ color: '#c50f1f' }}>{error}</Text>
      </div>
    );
  }

  if (!url) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="medium" />
      </div>
    );
  }

  return (
    <iframe
      title="PDF preview"
      src={url}
      style={{
        width: '100%',
        height,
        border: 'none',
        backgroundColor: '#fff',
        display: 'block',
      }}
    />
  );
}
