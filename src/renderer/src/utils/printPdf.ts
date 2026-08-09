import { pdf, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read PDF'));
    reader.readAsDataURL(blob);
  });
}

export type PrintReactPdfOptions = {
  /** Token slips / Print-to-PDF need the system dialog */
  printDialog?: boolean;
};

/** Generate a react-pdf Document and print via main-process pdf-to-printer. */
export async function printReactPdfDocument(
  pdfDocument: ReactElement<DocumentProps>,
  options?: PrintReactPdfOptions,
): Promise<void> {
  const blob = await pdf(pdfDocument).toBlob();
  const base64 = await blobToBase64(blob);
  const result = await window.clinic.print.pdf(base64, options);
  if (!result?.ok) {
    throw new Error(result?.error || 'Print failed');
  }
}
