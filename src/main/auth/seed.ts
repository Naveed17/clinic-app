import { getPrisma } from '../database/client';

export async function seedDefaultAdmin(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const prisma = getPrisma();
  const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (adminExists) return;
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
  console.warn('[seed] Default admin account created. Change the password after first login.');
}
