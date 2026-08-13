/**
 * CareFlow receipts/tokens always print for POS thermal (80mm).
 * Prescriptions use A4 portrait (reliable 1-page PDF; A5 was distorting on save/print).
 */

export const POS_PAPER = {
  id: 'pos80' as const,
  label: 'POS 80mm',
  /** CSS @page — fixed height (auto height prints blank on many POS drivers) */
  pageSize: '80mm 200mm',
  pageMargin: '0',
  bodyWidth: '100%',
  /**
   * 80mm roll printable width is ~72mm. Full 80mm body clips the right
   * border/text on thermal drivers (printableArea + left dead zone).
   */
  bodyMaxWidth: '68mm',
  /** Extra right inset so the token box stroke is not cut off. */
  bodyPadding: '6px 12px 28px 4px',
  fontName: '"Courier New", Courier, monospace',
  fontSize: '11px',
  nameSize: '15px',
  previewWidth: 340,
  previewHeight: 780,
  /** Electron webContents.print — 80mm × long roll (microns) */
  electronPageSize: { width: 80_000, height: 297_000 },
  /** @react-pdf Page size in points (~80mm wide) */
  pdfPageWidth: 226,
  pdfPageHeightToken: 460,
  pdfPageHeightInvoice: 720,
  /** Optical center on 80mm roll (pts). Left smaller to cancel driver left gutter. */
  pdfPaddingLeft: 8,
  pdfPaddingRight: 16,
  pdfPaddingTop: 16,
  /** Extra bottom gap so the slip can be torn at the cutter. */
  pdfPaddingBottom: 36,
};

/** Shared POS slip copy — token + invoice use the same header/dividers. */
export const POS_RECEIPT = {
  starLine: '* * * * * * * * * * * * * * *',
  clinicFallback: 'CLINIC',
  ink: '#000',
  thankYou: 'THANK YOU!',
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
