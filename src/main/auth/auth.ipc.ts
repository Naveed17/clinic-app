import { ipcMain } from 'electron';
import { getPrisma, ensureDatabaseReady } from '../database/client';
import { signToken } from '../backend/middleware/auth';
import { getLicenseModules } from '../license/license.ipc';
import { listLoginDirectory } from './login-directory';
import { seedDefaultAdmin } from './seed';

const ROLE_MODULE: Record<string, string> = {
  doctor:         'doctorDashboard',
  lab_technician: 'labDashboard',
  pharmacist:     'pharmacy',
};

export function registerAuthIpc(): void {
  ipcMain.handle('auth:directory', async () => {
    try {
      await ensureDatabaseReady();
      return await listLoginDirectory();
    } catch (err) {
      console.error('[auth:directory] Error listing directory:', err);
      return [];
    }
  });

  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    try {
      await ensureDatabaseReady();

      const prisma = getPrisma();

      // If database is completely empty on fresh install, auto-seed default admin
      try {
        const userCount = await prisma.user.count();
        if (userCount === 0) {
          await seedDefaultAdmin();
        }
      } catch (countErr) {
        console.warn('[auth:login] Error checking user count:', countErr);
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return { ok: false, error: 'Email and password are required.' };
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatar: true,
          doctorProfile: { select: { avatar: true } },
          isActive: true,
          passwordHash: true,
        },
      });

      if (!user) {
        return { ok: false, error: 'Invalid email or password.' };
      }
      if (!user.isActive) {
        return { ok: false, error: 'This account has been deactivated. Please contact the administrator.' };
      }
      if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
        return { ok: false, error: 'Invalid email or password.' };
      }

      const role = user.role.toLowerCase() as import('../backend/types').AppRole;

      // Module check: block login if role's module is disabled
      const moduleKey = ROLE_MODULE[role];
      if (moduleKey) {
        const modules = await getLicenseModules();
        // No verified permissions available (e.g. first run while offline) is denied.
        if (!modules || modules[moduleKey] !== true) {
          return { ok: false, blocked: true, error: 'This role is not enabled for this clinic.' };
        }
      }

      const token = signToken({ userId: user.id, role });
      const userAvatar = user.avatar?.trim() || user.doctorProfile?.avatar?.trim() || null;
      return {
        ok: true,
        token,
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role,
        avatar: userAvatar,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[auth:login] Uncaught login error:', err);
      return { ok: false, error: `Login error: ${msg}` };
    }
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

  ipcMain.handle('auth:update-avatar', async (_e, userId: string, avatar: string | null) => {
    await ensureDatabaseReady();
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe('UPDATE "User" SET "avatar" = ? WHERE id = ?', avatar, userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, doctorProfile: { select: { id: true } } },
    });
    if (user?.role === 'DOCTOR' && user.doctorProfile) {
      await prisma.doctorProfile.update({ where: { userId }, data: { avatar } });
    }
    return { ok: true, avatar };
  });
}
