import type { Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface DoctorListInput {
  page: number;
  pageSize: number;
  search: string;
}

export interface DoctorInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isActive: boolean;
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
}

export interface DoctorUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  password?: string;
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
}

const doctorSelect = {
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

export async function listDoctors({ page, pageSize, search }: DoctorListInput) {
  const prisma = getPrisma();
  const where: Prisma.UserWhereInput = {
    role: 'DOCTOR',
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { doctorProfile: { specialization: { contains: search } } },
          ],
        }
      : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: doctorSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { data, total };
}

export async function createDoctor(input: DoctorInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  return getPrisma().user.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: bcrypt.hashSync(input.password, 10),
      role: 'DOCTOR',
      isActive: input.isActive,
      doctorProfile: {
        create: {
          specialization: input.specialization.trim(),
          qualification: input.qualification?.trim() || null,
          experienceYears: input.experienceYears ?? 0,
          phone: input.phone?.trim() || null,
          bio: input.bio?.trim() || null,
        },
      },
    },
    select: doctorSelect,
  });
}

export async function updateDoctor(id: string, input: DoctorUpdateInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  return getPrisma().user.update({
    where: { id },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      isActive: input.isActive,
      ...(input.password ? { passwordHash: bcrypt.hashSync(input.password, 10) } : {}),
      doctorProfile: {
        upsert: {
          create: {
            specialization: input.specialization.trim(),
            qualification: input.qualification?.trim() || null,
            experienceYears: input.experienceYears ?? 0,
            phone: input.phone?.trim() || null,
            bio: input.bio?.trim() || null,
          },
          update: {
            specialization: input.specialization.trim(),
            qualification: input.qualification?.trim() || null,
            experienceYears: input.experienceYears ?? 0,
            phone: input.phone?.trim() || null,
            bio: input.bio?.trim() || null,
          },
        },
      },
    },
    select: doctorSelect,
  });
}

export async function deleteDoctor(id: string): Promise<void> {
  await getPrisma().user.delete({ where: { id } });
}
