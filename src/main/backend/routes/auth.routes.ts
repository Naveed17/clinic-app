import { Router } from 'express';
import { getPrisma } from '../../database/client';
import { asyncHandler } from '../utils/async-handler';
import { signToken } from '../middleware/auth';

const ROLE_MODULE: Record<string, string> = {
  doctor:         'doctorDashboard',
  lab_technician: 'labDashboard',
};

async function fetchLicenseModules(key: string): Promise<Record<string, boolean> | null> {
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
    return null;
  }
}

export function createAuthRouter(): Router {
  const router = Router();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required.' });
      return;
    }
    const user = await getPrisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, passwordHash: true },
    });
    if (!user || !user.isActive || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const role = user.role.toLowerCase() as import('../types').AppRole;

    // Module check: block login if role's module is disabled
    const moduleKey = ROLE_MODULE[role];
    if (moduleKey) {
      const { readFileSync, existsSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { app } = await import('electron');
      const filePath = join(app.getPath('userData'), 'license.dat');
      if (existsSync(filePath)) {
        const key = readFileSync(filePath, 'utf-8').trim();
        const modules = await fetchLicenseModules(key);
        if (modules && modules[moduleKey] === false) {
          res.status(403).json({ error: 'This role is not enabled for this clinic.' });
          return;
        }
      }
    }

    const token = signToken({ userId: user.id, role });
    res.json({
      token,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role,
      avatar: `${user.firstName[0]}${user.lastName[0]}`.toUpperCase(),
    });
  }));

  router.post('/change-password', asyncHandler(async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body as { userId: string; currentPassword: string; newPassword: string };
    const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) { res.status(404).json({ ok: false, error: 'User not found.' }); return; }
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      res.status(400).json({ ok: false, error: 'Current password is incorrect.' });
      return;
    }
    await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: bcrypt.hashSync(newPassword, 10) } });
    res.json({ ok: true });
  }));

  return router;
}
