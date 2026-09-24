import { getPrisma } from '../database/client';

export async function seedDefaultAdmin(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const prisma = getPrisma();
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@clinic.com' },
          { role: 'ADMIN' },
        ],
      },
    });
    if (existing) return;
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@clinic.com',
        passwordHash: bcrypt.hashSync('admin123', 10),
        role: 'ADMIN',
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.warn('[seed] Default admin account created (admin@clinic.com / admin123).');
  } catch (err) {
    console.error('[seed] Failed to seed default admin account:', err);
  }
}
