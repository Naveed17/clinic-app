import { pdf, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { PrintPaperId } from '@shared/invoicePaper';

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
  /** Open Chromium print dialog with preview (default true on main process). */
  printDialog?: boolean;
  /** pos80 = token/receipt; A4 = prescription */
  paper?: PrintPaperId;
};

/** Generate a react-pdf Document and print via Electron native print dialog. */
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
