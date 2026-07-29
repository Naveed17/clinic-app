import { ipcMain, app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';

const API_BASE_URL = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';

function getLicenseFilePath(): string {
  return join(app.getPath('userData'), 'license.dat');
}

// Computer ka Machine/Hardware ID
function getHWID(): string {
  try {
    return machineIdSync();
  } catch {
    return 'UNKNOWN_HWID';
  }
}

function getDeviceName(): string {
  try {
    return os.hostname() || 'Unknown Device';
  } catch {
    return 'Unknown Device';
  }
}

function getSavedKey(): string | null {
  try {
    const file = getLicenseFilePath();
    if (!existsSync(file)) return null;
    return readFileSync(file, 'utf-8').trim();
  } catch {
    return null;
  }
}

// 1. App Startup Validation
export async function isLicenseActivated(): Promise<boolean> {
  const savedKey = getSavedKey();
  if (!savedKey) return false;

  try {
    const hwid = getHWID();
    const response = await fetch(`${API_BASE_URL}/license/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: savedKey, hwid }),
    });

    const data = (await response.json()) as { valid: boolean };

    if (!data.valid) {
      try {
        unlinkSync(getLicenseFilePath());
      } catch {}
      return false;
    }

    return true;
  } catch {
    // Offline mode support: server drop hone par local key valid manna
    return savedKey !== null;
  }
}

// 2. IPC Communication Handlers
export function registerLicenseIpc(): void {
  // Status check IPC
  ipcMain.handle('license:status', async () => {
    return await isLicenseActivated();
  });

  // Modules fetch IPC
  ipcMain.handle('license:modules', async () => {
    const savedKey = getSavedKey();
    if (!savedKey) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/license/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: savedKey }),
      });
      const data = (await response.json()) as { ok: boolean; modules?: Record<string, boolean> };
      return data.ok ? data.modules ?? null : null;
    } catch {
      return null; // offline: null means all modules enabled (fallback)
    }
  });

  // Activation IPC
  ipcMain.handle('license:activate', async (_e, key: string) => {
    const formattedKey = key.trim().toUpperCase();
    if (!formattedKey) return { ok: false, error: 'Please enter a key.' };

    try {
      const hwid = getHWID();
      const deviceName = getDeviceName();

      const response = await fetch(`${API_BASE_URL}/license/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: formattedKey, hwid, deviceName }), 
      });

      const data = (await response.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        writeFileSync(getLicenseFilePath(), formattedKey, 'utf-8');
        return { ok: true };
      }

      return { ok: false, error: data.error || 'Activation failed.' };
    } catch {
      return { ok: false, error: 'Cannot connect to server. Check your internet connection.' };
    }
  });
}