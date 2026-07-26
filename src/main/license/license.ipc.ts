import { ipcMain, app } from 'electron';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Add your valid license keys here (plain text — they are hashed at runtime)
const VALID_KEYS = [
  'CARE-1234-ABCD-5678',
  'CARE-9999-WXYZ-0001',
];

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
