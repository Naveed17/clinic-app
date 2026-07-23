import { Router } from 'express';
import { getPrisma } from '../../database/client';
import { asyncHandler } from '../utils/async-handler';

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
    res.json({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role.toLowerCase(),
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
