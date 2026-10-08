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
  bodyMaxWidth: '66mm',
  /** Left-align in the printable area — auto-centering leaves a large left gap on POS. */
  bodyMargin: '0',
  /**
   * Left 10px (between old 4px and centered 8px+auto).
   * Extra right so the token box stroke is not clipped.
   */
  bodyPadding: '6px 18px 28px 10px',
  fontName: "'Courier New', Courier, monospace",
  pdfFontFamily: 'Courier',
  fontSize: '12px',
  nameSize: '15px',
  previewWidth: 340,
  previewHeight: 780,
  /** Electron webContents.print — 80mm × long roll (microns) */
  electronPageSize: { width: 80_000, height: 297_000 },
  /** @react-pdf Page size in points (~80mm wide) */
  pdfPageWidth: 226,
  pdfPageHeightToken: 520,
  pdfPageHeightInvoice: 720,
  pdfPaddingLeft: 10,
  pdfPaddingRight: 18,
  pdfPaddingTop: 16,
  /** Extra bottom gap so the slip can be torn at the cutter. */
  pdfPaddingBottom: 36,
};

/** Shared POS slip copy — token + invoice use the same header/dividers. */
export const POS_RECEIPT = {
  starLine: '* * * * * * * * * * * * * * *',
  clinicFallback: 'CLINIC',
  /** Headings / token number stay pure black. Secondary lines use dark grey. */
  ink: '#000000',
  muted: '#2a2a2a',
  thankYou: 'THANK YOU!',
  poweredBy: 'Powered by CareFlow',
};

/** Prescription pad — A4 portrait. */
export const RX_PAPER = {
  id: 'A4' as const,
  label: 'A4',
  electronPageSize: 'A4' as const,
  previewWidth: 860,
  previewHeight: 1100,
};

export type PrintPaperId = typeof POS_PAPER.id | typeof RX_PAPER.id;

export type TokenSlipShadeId = 'gray-400' | 'gray-500' | 'gray-600' | 'gray-700' | 'gray-800' | 'gray-900';

export interface TokenSlipColorShade {
  id: TokenSlipShadeId;
  label: string;
  step: string;
  hex: string;
  weight: number | string;
  pdfWeight: 'bold' | 'normal';
  description: string;
}

export const TOKEN_SLIP_SHADES: readonly TokenSlipColorShade[] = [
  { id: 'gray-400', label: 'Gray 400', step: '400', hex: '#9ca3af', weight: '500', pdfWeight: 'normal', description: 'Light gray' },
  { id: 'gray-500', label: 'Gray 500', step: '500', hex: '#6b7280', weight: '500', pdfWeight: 'normal', description: 'Medium light' },
  { id: 'gray-600', label: 'Gray 600', step: '600', hex: '#4b5563', weight: '600', pdfWeight: 'normal', description: 'Muted slate' },
  { id: 'gray-700', label: 'Gray 700', step: '700', hex: '#374151', weight: '600', pdfWeight: 'bold', description: 'Dark gray' },
  { id: 'gray-800', label: 'Gray 800', step: '800', hex: '#1f2937', weight: '700', pdfWeight: 'bold', description: 'Very dark' },
  { id: 'gray-900', label: 'Gray 900', step: '900', hex: '#000000', weight: '700', pdfWeight: 'bold', description: 'Pure black (Recommended)' },
] as const;

export function resolveTokenSlipShade(shadeOrHex?: string | null): TokenSlipColorShade {
  if (!shadeOrHex) return TOKEN_SLIP_SHADES[5]; // gray-900
  const normalized = shadeOrHex.trim().toLowerCase();
  const found = TOKEN_SLIP_SHADES.find(
    (s) => s.id === normalized || s.hex.toLowerCase() === normalized || s.step === normalized,
  );
  if (found) return found;
  if (normalized === 'dark') return TOKEN_SLIP_SHADES[5]; // gray-900
  if (normalized === 'muted') return TOKEN_SLIP_SHADES[2]; // gray-600
  return TOKEN_SLIP_SHADES[5];
}
