import type { Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';
import { seedDefaultAdmin } from '../auth/seed';

export interface UserListInput {
  page: number;
  pageSize: number;
  search: string;
}

export interface DoctorProfileInput {
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
  avatar?: string | null;
}

export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_TECHNICIAN' | 'PHARMACIST';
  isActive: boolean;
  avatar?: string | null;
  doctorProfile?: DoctorProfileInput;
}

export interface UserUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_TECHNICIAN' | 'PHARMACIST';
  isActive: boolean;
  password?: string;
  avatar?: string | null;
  doctorProfile?: DoctorProfileInput;
}

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  doctorProfile: true,
} satisfies Prisma.UserSelect;

function staffAvatar(input: { avatar?: string | null; doctorProfile?: DoctorProfileInput }): string | null {
  const fromUser = input.avatar?.trim();
  if (fromUser) return fromUser;
  const fromDoctor = input.doctorProfile?.avatar?.trim();
  return fromDoctor || null;
}

async function saveUserAvatar(id: string, avatar: string | null): Promise<void> {
  await getPrisma().$executeRawUnsafe('UPDATE "User" SET "avatar" = ? WHERE id = ?', avatar, id);
}

async function withAvatars<T extends { id: string; doctorProfile?: { avatar?: string | null } | null }>(
  users: T[],
): Promise<Array<T & { avatar: string | null }>> {
  if (!users.length) return [];
  const rows = await getPrisma().$queryRawUnsafe<Array<{ id: string; avatar: string | null }>>(
    `SELECT id, avatar FROM "User" WHERE id IN (${users.map(() => '?').join(',')})`,
    ...users.map((user) => user.id),
  );
  const map = new Map(rows.map((row) => [row.id, row.avatar]));
  return users.map((user) => ({
    ...user,
    avatar: map.get(user.id) || user.doctorProfile?.avatar || null,
  }));
}

export async function listUsers({ page, pageSize, search }: UserListInput) {
  const prisma = getPrisma();
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {};
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' }, // Latest added user top par aayega
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { data: await withAvatars(data), total };
}

export async function createUser(input: UserInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const avatar = staffAvatar(input);
  const created = await getPrisma().user.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: bcrypt.hashSync(input.password, 10),
      role: input.role,
      isActive: input.isActive,
      ...(input.role === 'DOCTOR' && input.doctorProfile
        ? {
            doctorProfile: {
              create: {
                specialization: input.doctorProfile.specialization.trim(),
                qualification: input.doctorProfile.qualification?.trim() || null,
                experienceYears: input.doctorProfile.experienceYears ?? 0,
                phone: input.doctorProfile.phone?.trim() || null,
                bio: input.doctorProfile.bio?.trim() || null,
                avatar,
              },
            },
          }
        : {}),
    },
    select: userSelect,
  });
  await saveUserAvatar(created.id, avatar);
  const [withPhoto] = await withAvatars([created]);
  return withPhoto;
}

export async function updateUser(id: string, input: UserUpdateInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const prisma = getPrisma();
  const avatar = input.avatar !== undefined || input.doctorProfile?.avatar !== undefined
    ? staffAvatar(input)
    : undefined;

  if (input.role !== 'DOCTOR') {
    const existing = await prisma.user.findUnique({ where: { id }, select: { doctorProfile: { select: { id: true } } } });
    if (existing?.doctorProfile) {
      await prisma.doctorProfile.delete({ where: { userId: id } });
    }
  }

  const data: Prisma.UserUpdateInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    isActive: input.isActive,
    ...(input.password ? { passwordHash: bcrypt.hashSync(input.password, 10) } : {}),
    ...(input.role === 'DOCTOR' && input.doctorProfile
      ? {
          doctorProfile: {
            upsert: {
              create: {
                specialization: input.doctorProfile.specialization.trim(),
                qualification: input.doctorProfile.qualification?.trim() || null,
                experienceYears: input.doctorProfile.experienceYears ?? 0,
                phone: input.doctorProfile.phone?.trim() || null,
                bio: input.doctorProfile.bio?.trim() || null,
                avatar: avatar ?? null,
              },
              update: {
                specialization: input.doctorProfile.specialization.trim(),
                qualification: input.doctorProfile.qualification?.trim() || null,
                experienceYears: input.doctorProfile.experienceYears ?? 0,
                phone: input.doctorProfile.phone?.trim() || null,
                bio: input.doctorProfile.bio?.trim() || null,
                ...(avatar !== undefined ? { avatar } : {}),
              },
            },
          },
        }
      : {}),
  };
  const updated = await prisma.user.update({ where: { id }, data, select: userSelect });
  if (avatar !== undefined) await saveUserAvatar(id, avatar);
  const [withPhoto] = await withAvatars([updated]);
  return withPhoto;
}

export async function deleteUser(id: string): Promise<void> {
  await getPrisma().user.delete({ where: { id } });
  await seedDefaultAdmin();
}