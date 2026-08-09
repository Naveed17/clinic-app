import { ipcMain, app } from 'electron';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(__filename);

type PrintFn = (pdfPath: string, options?: { printDialog?: boolean; printer?: string }) => Promise<void>;

type PrintPdfOptions = {
  /** true = Windows/Sumatra print dialog (needed for Print to PDF / no default printer) */
  printDialog?: boolean;
};

function getPrintFn(): PrintFn {
  // CJS package — ESM dynamic import often yields { default: { print } } so print is undefined
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-to-printer') as { print?: PrintFn; default?: { print?: PrintFn } };
  const print = mod.print ?? mod.default?.print;
  if (typeof print !== 'function') {
    throw new Error('pdf-to-printer.print is not a function');
  }
  return print;
}

/**
 * Windows printing via pdf-to-printer (SumatraPDF).
 * Silent print to "Microsoft Print to PDF" fails — use printDialog for those cases.
 */
export function registerPrintIpc(): void {
  ipcMain.handle('print:pdf', async (_event, base64: string, options?: PrintPdfOptions) => {
    if (typeof base64 !== 'string' || !base64.trim()) {
      return { ok: false as const, error: 'Empty PDF data' };
    }

    const wantDialog = options?.printDialog === true;
    const file = join(app.getPath('temp'), `careflow-print-${randomUUID()}.pdf`);
    try {
      writeFileSync(file, Buffer.from(base64, 'base64'));
      const print = getPrintFn();

      if (wantDialog) {
        await print(file, { printDialog: true });
        return { ok: true as const };
      }

      try {
        await print(file, { printDialog: false });
        return { ok: true as const };
      } catch (silentErr) {
        // Default printer missing / Print to PDF cannot run silent — open dialog
        console.warn('[print:pdf] silent failed, opening print dialog:', silentErr);
        await print(file, { printDialog: true });
        return { ok: true as const };
      }
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Print failed',
      };
    } finally {
      try {
        unlinkSync(file);
      } catch {
        /* ignore cleanup errors */
      }
    }
  });

  ipcMain.handle('print:html', async () => ({
    ok: false as const,
    error: 'Use print:pdf instead',
  }));
}
