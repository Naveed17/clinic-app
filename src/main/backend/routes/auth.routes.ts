import { Router } from 'express';
import { getPrisma } from '../../database/client';
import { asyncHandler } from '../utils/async-handler';
import { signToken } from '../middleware/auth';
import { getLicenseModules } from '../../license/license.ipc';
import { listLoginDirectory } from '../../auth/login-directory';

const ROLE_MODULE: Record<string, string> = {
  doctor:         'doctorDashboard',
  lab_technician: 'labDashboard',
  pharmacist:     'pharmacy',
};

export function createAuthRouter(): Router {
  const router = Router();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');

  router.get('/directory', asyncHandler(async (_req, res) => {
    res.json(await listLoginDirectory());
  }));

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
    if (!user || !user.isActive || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const role = user.role.toLowerCase() as import('../types').AppRole;

    // Module check: block login if role's module is disabled
    const moduleKey = ROLE_MODULE[role];
    if (moduleKey) {
      const modules = await getLicenseModules();
      if (!modules || modules[moduleKey] !== true) {
        res.status(403).json({ error: 'This role is not enabled for this clinic.' });
        return;
      }
    }

    const token = signToken({ userId: user.id, role });
    res.json({
      token,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role,
      avatar: `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase(),
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
