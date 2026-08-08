import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { Box, Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type DocViewerData = { type: 'pdf' | 'image'; name: string; data: string };

export function DocViewerDialog({ doc, onClose }: { doc: DocViewerData; onClose: () => void }): React.JSX.Element {
  const [numPages, setNumPages] = useState(0);
  const pdfData = doc.type === 'pdf' ? { data: atob(doc.data) } : null;

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 1,
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography fontWeight={700} noWrap sx={{ flex: 1, mr: 2 }}>{doc.name}</Typography>
        <IconButton size="small" onClick={onClose}><CloseOutlinedIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
        {doc.type === 'image' ? (
          <Box component="img" src={doc.data} alt={doc.name} sx={{ maxWidth: '100%', objectFit: 'contain' }} />
        ) : (
          <Document
            file={pdfData}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<Box sx={{ py: 6, textAlign: 'center' }}><Typography color="text.secondary">Loading PDF…</Typography></Box>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={700} />
            ))}
          </Document>
        )}
      </DialogContent>
    </Dialog>
  );
}
