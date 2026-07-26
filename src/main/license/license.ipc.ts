import { ipcMain, app } from 'electron';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Add your valid license keys here (plain text — they are hashed at runtime)
const VALID_KEYS = [
  'CLINIC-9F8A-3E2B-7C4D-1A09',
  'CLINIC-K82M-P7X9-W3Q1-V6Y4',
  'CLINIC-E5T2-9A8U-3H7Z-B1C4',
  'CLINIC-X9P4-Q2W8-R7T1-M5N3',
  'CLINIC-7H1J-4K9L-2M3N-5P8Q',
] as const;

const VALID_HASHES = new Set(
  VALID_KEYS.map((k) => createHash('sha256').update(k.trim().toUpperCase()).digest('hex')),
);

function licenseFile(): string {
  return join(app.getPath('userData'), 'license.dat');
}

function hashKey(key: string): string {
  return createHash('sha256').update(key.trim().toUpperCase()).digest('hex');
}

export function isLicenseActivated(): boolean {
  try {
    const file = licenseFile();
    if (!existsSync(file)) return false;
    return VALID_HASHES.has(readFileSync(file, 'utf-8').trim());
  } catch {
    return false;
  }
}

export function registerLicenseIpc(): void {
  ipcMain.handle('license:status', () => isLicenseActivated());

  ipcMain.handle('license:activate', (_e, key: string) => {
    const hash = hashKey(key);
    if (!VALID_HASHES.has(hash)) return { ok: false, error: 'Invalid license key.' };
    try {
      writeFileSync(licenseFile(), hash, 'utf-8');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not save license.' };
    }
  });
}
