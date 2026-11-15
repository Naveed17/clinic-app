import { app, type BrowserWindow } from 'electron';
import { appendFileSync, mkdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Keeps one bad async error in a timer / IPC handler from killing the whole app,
 * and brings a crashed renderer back instead of leaving a white screen.
 * Every error is written to userData/logs/main-errors.log so it can be fixed later.
 */

const MAX_LOG_BYTES = 2 * 1024 * 1024;

function logFile(): string {
  const dir = join(app.getPath('userData'), 'logs');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'main-errors.log');
}

export function logMainError(kind: string, error: unknown): void {
  const text = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`[CareFlow] ${kind}:`, error);
  try {
    const file = logFile();
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      renameSync(file, `${file}.old`);
    }
    appendFileSync(file, `[${new Date().toISOString()}] ${kind}: ${text}\n\n`, 'utf-8');
  } catch {
    /* logging must never throw */
  }
}

let installed = false;

export function installProcessCrashGuards(): void {
  if (installed) return;
  installed = true;
  process.on('unhandledRejection', (reason) => logMainError('unhandledRejection', reason));
  process.on('uncaughtException', (err) => logMainError('uncaughtException', err));
}

/** Reload the window if its renderer crashes — at most once per minute to avoid a reload loop. */
export function guardRendererCrashes(window: BrowserWindow): void {
  let lastReload = 0;
  window.webContents.on('render-process-gone', (_event, details) => {
    logMainError('render-process-gone', `${details.reason} (exitCode ${details.exitCode})`);
    if (details.reason === 'clean-exit' || window.isDestroyed()) return;
    const now = Date.now();
    if (now - lastReload < 60_000) return;
    lastReload = now;
    setTimeout(() => {
      if (!window.isDestroyed()) window.webContents.reload();
    }, 500);
  });
  window.on('unresponsive', () => logMainError('window-unresponsive', 'Renderer stopped responding'));
}
