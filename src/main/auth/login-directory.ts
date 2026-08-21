import { getPrisma } from '../database/client';

export type LoginDirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
};

export async function listLoginDirectory(): Promise<LoginDirectoryUser[]> {
  const rows = await getPrisma().user.findMany({
    where: { isActive: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      doctorProfile: { select: { avatar: true } },
    },
  });

  return rows.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: String(user.role || '').toLowerCase(),
    avatar: user.avatar?.trim() || user.doctorProfile?.avatar?.trim() || null,
  }));
}
