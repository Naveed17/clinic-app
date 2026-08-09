/**
 * CareFlow receipts/tokens always print for POS thermal (80mm).
 * Prescriptions use A4 portrait (reliable 1-page PDF; A5 was distorting on save/print).
 */

export const POS_PAPER = {
  id: 'pos80' as const,
  label: 'POS 80mm',
  /** CSS @page */
  pageSize: '80mm auto',
  pageMargin: '2mm',
  bodyWidth: '72mm',
  bodyMaxWidth: '72mm',
  bodyPadding: '4px 6px',
  fontName: '"Courier New", Courier, monospace',
  fontSize: '11px',
  nameSize: '15px',
  previewWidth: 340,
  previewHeight: 780,
  /** Electron webContents.print — 80mm × long roll (microns) */
  electronPageSize: { width: 80_000, height: 297_000 },
  /** @react-pdf Page size in points (~80mm wide) */
  pdfPageWidth: 226,
  pdfPageHeightToken: 400,
  pdfPageHeightInvoice: 720,
};

/** Prescription pad — A4 portrait. */
export const RX_PAPER = {
  id: 'A4' as const,
  label: 'A4',
  electronPageSize: 'A4' as const,
  previewWidth: 640,
  previewHeight: 900,
};

export type PrintPaperId = typeof POS_PAPER.id | typeof RX_PAPER.id;
