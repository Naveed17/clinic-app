import { ipcMain } from 'electron';
import { getPrisma } from '../database/client';
import { signToken } from '../backend/middleware/auth';
import { isLicenseActivated } from '../license/license.ipc';

// Fetch modules from license server
async function fetchLicenseModules(): Promise<Record<string, boolean> | null> {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { app } = await import('electron');
  const filePath = join(app.getPath('userData'), 'license.dat');
  if (!existsSync(filePath)) return null;
  const key = readFileSync(filePath, 'utf-8').trim();
  const API_BASE_URL = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';
  try {
    const res = await fetch(`${API_BASE_URL}/license/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const data = (await res.json()) as { ok: boolean; modules?: Record<string, boolean> };
    return data.ok ? (data.modules ?? null) : null;
  } catch {
    return null; // offline: no restriction
  }
}

const ROLE_MODULE: Record<string, string> = {
  doctor:         'doctorDashboard',
  lab_technician: 'labDashboard',
};

export function registerAuthIpc(): void {
  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const user = await getPrisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });
    if (!user || !user.isActive) return null;
    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) return null;
    const role = user.role.toLowerCase() as import('../backend/types').AppRole;

    // Module check: block login if role's module is disabled
    const moduleKey = ROLE_MODULE[role];
    if (moduleKey) {
      const modules = await fetchLicenseModules();
      if (modules && modules[moduleKey] === false) {
        return { blocked: true, error: 'This role is not enabled for this clinic.' };
      }
    }

    const token = signToken({ userId: user.id, role });
    return {
      token,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role,
      avatar: `${user.firstName[0]}${user.lastName[0]}`.toUpperCase(),
    };
  });

  ipcMain.handle('auth:change-password', async (_e, userId: string, currentPassword: string, newPassword: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) return { ok: false, error: 'User not found.' };
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return { ok: false, error: 'Current password is incorrect.' };
    }
    await getPrisma().user.update({
      where: { id: userId },
      data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
    });
    return { ok: true };
  });
}
