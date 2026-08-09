import { BrowserWindow, ipcMain, app } from 'electron';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { POS_PAPER, RX_PAPER, type PrintPaperId } from '../../shared/invoicePaper';

/**
 * Electron Windows cannot show preview in the OS print dialog (electron#4890).
 * Invoice/token: POS 80mm. Prescription: A4 portrait.
 */

type PrintOptions = {
  printDialog?: boolean;
  /** pos80 = thermal receipt/token; A4 = prescription pad */
  paper?: PrintPaperId;
};

function resolvePageSize(
  paper?: PrintPaperId,
): Electron.WebContentsPrintOptions['pageSize'] {
  if (paper === 'A4') return RX_PAPER.electronPageSize;
  return POS_PAPER.electronPageSize as Electron.WebContentsPrintOptions['pageSize'];
}

function previewSize(paper?: PrintPaperId): { width: number; height: number } {
  if (paper === 'A4') {
    return { width: RX_PAPER.previewWidth, height: RX_PAPER.previewHeight };
  }
  return { width: POS_PAPER.previewWidth, height: POS_PAPER.previewHeight };
}

function waitForLoad(win: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onFail = (_e: Electron.Event, _code: number, desc: string) => {
      cleanup();
      reject(new Error(desc || 'Failed to load print document'));
    };
    const cleanup = () => {
      win.webContents.off('did-finish-load', onOk);
      win.webContents.off('did-fail-load', onFail);
    };
    win.webContents.once('did-finish-load', onOk);
    win.webContents.once('did-fail-load', onFail);
  });
}

function printWindow(
  win: BrowserWindow,
  silent: boolean,
  paper?: PrintPaperId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent,
        printBackground: true,
        landscape: false,
        pageSize: resolvePageSize(paper),
      },
      (success, failureReason) => {
        if (success || /cancel/i.test(failureReason || '')) {
          resolve({ ok: true });
          return;
        }
        resolve({ ok: false, error: failureReason || 'Print failed' });
      },
    );
  });
}

function withPreviewChrome(html: string): string {
  const chrome = `
<style>
  .cf-print-bar {
    position: sticky;
    bottom: 0;
    z-index: 9999;
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    justify-content: center;
    align-items: center;
    padding: 10px 8px;
    background: transparent;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .cf-print-bar button.cf-icon-btn {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    min-width: 40px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    background: #fff;
    color: #0f766e;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  }
  .cf-print-bar button.cf-icon-btn svg {
    width: 20px;
    height: 20px;
    display: block;
    pointer-events: none;
  }
  .cf-print-bar .cf-print {
    background: #0f766e;
    border-color: #0f766e;
    color: #fff;
  }
  .cf-print-bar .cf-print:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .cf-print-bar .cf-close {
    background: #fff;
    color: #475569;
    border-color: #cbd5e1;
  }
  #cf-err {
    display: none;
    margin: 0;
    padding: 8px 10px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 600;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  #cf-err.show { display: block; }
  @media print {
    .cf-print-bar, #cf-err { display: none !important; }
  }
</style>
<div class="cf-print-bar">
  <button type="button" class="cf-icon-btn cf-close" id="cf-close" title="Close" aria-label="Close">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  </button>
  <button type="button" class="cf-icon-btn cf-print" id="cf-print" title="Print" aria-label="Print">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
    </svg>
  </button>
</div>
<p id="cf-err"></p>
<script>
  document.getElementById('cf-print')?.addEventListener('click', function () {
    location.href = 'careflow://print';
  });
  document.getElementById('cf-close')?.addEventListener('click', function () {
    location.href = 'careflow://close';
  });
</script>`;

  // Toolbar at end of body (bottom of preview)
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${chrome}</body>`);
  }
  return `${html}${chrome}`;
}

async function showPrintError(win: BrowserWindow, message: string): Promise<void> {
  const safe = JSON.stringify(message);
  await win.webContents.executeJavaScript(`
    (function () {
      var err = document.getElementById('cf-err');
      var btn = document.getElementById('cf-print');
      if (btn) btn.disabled = false;
      if (!err) return;
      err.textContent = ${safe};
      err.classList.add('show');
    })();
  `);
}

async function setPrinting(win: BrowserWindow, printing: boolean): Promise<void> {
  await win.webContents.executeJavaScript(`
    (function () {
      var btn = document.getElementById('cf-print');
      var err = document.getElementById('cf-err');
      if (err) err.classList.remove('show');
      if (btn) {
        btn.disabled = ${printing ? 'true' : 'false'};
        btn.title = ${printing ? JSON.stringify('Printing...') : JSON.stringify('Print')};
        btn.setAttribute('aria-label', btn.title);
      }
    })();
  `);
}

async function openHtmlPreview(html: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = join(app.getPath('temp'), `careflow-print-${randomUUID()}.html`);
  let win: BrowserWindow | null = null;
  let printing = false;

  try {
    writeFileSync(file, withPreviewChrome(html), 'utf8');

    win = new BrowserWindow({
      show: true,
      width: POS_PAPER.previewWidth,
      height: POS_PAPER.previewHeight,
      minWidth: 280,
      minHeight: 420,
      autoHideMenuBar: true,
      title: 'Print',
      backgroundColor: '#ffffff',
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('careflow://')) return;
      event.preventDefault();

      if (url.startsWith('careflow://close')) {
        win?.close();
        return;
      }

      if (url.startsWith('careflow://print') && win && !printing) {
        printing = true;
        const target = win;
        void (async () => {
          try {
            await setPrinting(target, true);
            const result = await printWindow(target, true, 'pos80');
            if (!result.ok) {
              await showPrintError(
                target,
                `${result.error}. Set your POS printer as Windows default (not "Microsoft Print to PDF"), then try again.`,
              );
              return;
            }
            target.close();
          } catch (err) {
            await showPrintError(
              target,
              err instanceof Error ? err.message : 'Print failed',
            );
          } finally {
            printing = false;
            try {
              await setPrinting(target, false);
            } catch {
              /* window may already be closed */
            }
          }
        })();
      }
    });

    const loadDone = waitForLoad(win);
    await win.loadURL(pathToFileURL(file).href);
    await loadDone;
    win.focus();

    win.on('closed', () => {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    });

    return { ok: true };
  } catch (err) {
    try {
      win?.destroy();
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Print preview failed',
    };
  }
}

async function printPdfFile(
  file: string,
  options?: PrintOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const paper = options?.paper ?? 'pos80';

  // Token slip: silent POS print, no OS dialog
  if (options?.printDialog === false && paper === 'pos80') {
    return silentPrintPdf(file, paper, true);
  }

  // Prescription / other PDFs: in-app preview (Electron OS dialog has no PDF preview)
  return openPdfPreview(file, paper);
}

async function silentPrintPdf(
  file: string,
  paper: PrintPaperId,
  cleanupFile = false,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let win: BrowserWindow | null = null;
  const size = previewSize(paper);
  try {
    win = new BrowserWindow({
      show: false,
      width: size.width,
      height: size.height,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const loadDone = waitForLoad(win);
    await win.loadURL(pathToFileURL(file).href);
    await loadDone;
    await new Promise((r) => setTimeout(r, 400));
    return await printWindow(win, true, paper);
  } finally {
    try {
      win?.destroy();
    } catch {
      /* ignore */
    }
    if (cleanupFile) {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }
}

async function openPdfPreview(
  pdfFile: string,
  paper: PrintPaperId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const size = previewSize(paper);
  const shellFile = join(app.getPath('temp'), `careflow-pdf-shell-${randomUUID()}.html`);
  const pdfUrl = pathToFileURL(pdfFile).href;
  let win: BrowserWindow | null = null;
  let printing = false;

  const shellHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #e2e8f0;
    font-family: "Segoe UI", system-ui, sans-serif;
    display: flex;
    flex-direction: column;
  }
  .cf-frame-wrap {
    flex: 1;
    min-height: 0;
    background: #fff;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
  .cf-print-bar {
    flex-shrink: 0;
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    padding: 10px 8px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
  }
  .cf-print-bar button.cf-icon-btn {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #fff;
    color: #0f766e;
  }
  .cf-print-bar .cf-print { background: #0f766e; border-color: #0f766e; color: #fff; }
  .cf-print-bar .cf-print:disabled { opacity: 0.55; cursor: wait; }
  .cf-print-bar .cf-close { color: #475569; }
  #cf-err {
    display: none;
    margin: 0;
    padding: 8px 10px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 600;
  }
  #cf-err.show { display: block; }
  @media print {
    .cf-print-bar, #cf-err { display: none !important; }
    .cf-frame-wrap { height: 100vh; }
  }
</style>
</head>
<body>
  <div class="cf-frame-wrap">
    <iframe id="cf-pdf" src="${pdfUrl}" title="PDF"></iframe>
  </div>
  <p id="cf-err"></p>
  <div class="cf-print-bar">
    <button type="button" class="cf-icon-btn cf-close" id="cf-close" title="Close" aria-label="Close">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <button type="button" class="cf-icon-btn cf-print" id="cf-print" title="Print" aria-label="Print">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
    </button>
  </div>
  <script>
    document.getElementById('cf-print')?.addEventListener('click', function () {
      location.href = 'careflow://print';
    });
    document.getElementById('cf-close')?.addEventListener('click', function () {
      location.href = 'careflow://close';
    });
  </script>
</body>
</html>`;

  try {
    writeFileSync(shellFile, shellHtml, 'utf8');

    win = new BrowserWindow({
      show: true,
      width: size.width,
      height: size.height,
      minWidth: 360,
      minHeight: 480,
      autoHideMenuBar: true,
      title: paper === 'A4' ? 'Prescription · A4' : 'Print',
      backgroundColor: '#e2e8f0',
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        plugins: true,
      },
    });

    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('careflow://')) return;
      event.preventDefault();

      if (url.startsWith('careflow://close')) {
        win?.close();
        return;
      }

      if (url.startsWith('careflow://print') && win && !printing) {
        printing = true;
        const target = win;
        void (async () => {
          try {
            await setPrinting(target, true);
            // Print the PDF document itself (not the shell chrome)
            const result = await silentPrintPdf(pdfFile, paper);
            if (!result.ok) {
              await showPrintError(
                target,
                `${result.error}. Choose your sheet printer as Windows default (not "Microsoft Print to PDF"), then try again.`,
              );
              return;
            }
            target.close();
          } catch (err) {
            await showPrintError(
              target,
              err instanceof Error ? err.message : 'Print failed',
            );
          } finally {
            printing = false;
            try {
              await setPrinting(target, false);
            } catch {
              /* ignore */
            }
          }
        })();
      }
    });

    const loadDone = waitForLoad(win);
    await win.loadURL(pathToFileURL(shellFile).href);
    await loadDone;
    win.focus();

    win.on('closed', () => {
      try {
        unlinkSync(shellFile);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(pdfFile);
      } catch {
        /* ignore */
      }
    });

    return { ok: true };
  } catch (err) {
    try {
      win?.destroy();
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(shellFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(pdfFile);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Print preview failed',
    };
  }
}

async function captureHtmlToPng(
  html: string,
  options?: { width?: number; height?: number },
): Promise<{ ok: true; base64: string } | { ok: false; error: string }> {
  const width = Math.max(120, Math.min(800, Math.round(options?.width ?? 280)));
  const height = Math.max(120, Math.min(1000, Math.round(options?.height ?? 360)));
  const file = join(app.getPath('temp'), `careflow-thumb-${randomUUID()}.html`);
  let win: BrowserWindow | null = null;

  try {
    writeFileSync(file, html, 'utf8');
    win = new BrowserWindow({
      show: false,
      width,
      height,
      useContentSize: true,
      enableLargerThanScreen: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
      },
    });

    const loadDone = waitForLoad(win);
    await win.loadURL(pathToFileURL(file).href);
    await loadDone;
    await new Promise((r) => setTimeout(r, 250));

    const image = await win.webContents.capturePage({
      x: 0,
      y: 0,
      width,
      height,
    });
    const png = image.toPNG();
    if (!png.length) {
      return { ok: false, error: 'Empty thumbnail capture' };
    }
    return { ok: true, base64: png.toString('base64') };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Thumbnail capture failed',
    };
  } finally {
    try {
      win?.destroy();
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

export function registerPrintIpc(): void {
  ipcMain.handle('print:html', async (_event, html: string, _options?: PrintOptions) => {
    if (typeof html !== 'string' || !html.trim()) {
      return { ok: false as const, error: 'Empty HTML' };
    }
    return openHtmlPreview(html);
  });

  ipcMain.handle('print:pdf', async (_event, base64: string, options?: PrintOptions) => {
    if (typeof base64 !== 'string' || !base64.trim()) {
      return { ok: false as const, error: 'Empty PDF data' };
    }

    const file = join(app.getPath('temp'), `careflow-print-${randomUUID()}.pdf`);

    try {
      writeFileSync(file, Buffer.from(base64, 'base64'));
      // printPdfFile owns temp file cleanup (immediate or when preview closes)
      return await printPdfFile(file, options);
    } catch (err) {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Print failed',
      };
    }
  });

  ipcMain.handle(
    'print:captureHtml',
    async (_event, html: string, options?: { width?: number; height?: number }) => {
      if (typeof html !== 'string' || !html.trim()) {
        return { ok: false as const, error: 'Empty HTML' };
      }
      return captureHtmlToPng(html, options);
    },
  );
}
