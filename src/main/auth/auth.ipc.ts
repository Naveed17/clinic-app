import { ipcMain } from 'electron';
import { getPrisma } from '../database/client';
import { signToken } from '../backend/middleware/auth';

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
