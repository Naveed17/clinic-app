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
}

export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST';
  isActive: boolean;
  doctorProfile?: DoctorProfileInput;
}

export interface UserUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST';
  isActive: boolean;
  password?: string;
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
  return { data, total };
}

export async function createUser(input: UserInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  return getPrisma().user.create({
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
              },
            },
          }
        : {}),
    },
    select: userSelect,
  });
}

export async function updateUser(id: string, input: UserUpdateInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const prisma = getPrisma();

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
              },
              update: {
                specialization: input.doctorProfile.specialization.trim(),
                qualification: input.doctorProfile.qualification?.trim() || null,
                experienceYears: input.doctorProfile.experienceYears ?? 0,
                phone: input.doctorProfile.phone?.trim() || null,
                bio: input.doctorProfile.bio?.trim() || null,
              },
            },
          },
        }
      : {}),
  };
  return prisma.user.update({ where: { id }, data, select: userSelect });
}

export async function deleteUser(id: string): Promise<void> {
  await getPrisma().user.delete({ where: { id } });
  await seedDefaultAdmin();
}