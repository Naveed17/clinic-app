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
  avatar?: string | null;
  consultationFee?: number;
}

export interface DoctorUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  password?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
  avatar?: string | null;
  consultationFee?: number;
}

function parseFee(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function withConsultationFee<T extends { doctorProfile?: { consultationFee?: unknown } | null }>(row: T): T {
  if (!row.doctorProfile) return row;
  return {
    ...row,
    doctorProfile: { ...row.doctorProfile, consultationFee: parseFee(row.doctorProfile.consultationFee) },
  };
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

export async function getDoctor(id: string) {
  const prisma = getPrisma();
  const doctor = await prisma.user.findUnique({
    where: { id },
    select: { ...doctorSelect, schedules: { orderBy: { dayOfWeek: 'asc' } } },
  });
  if (!doctor) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [totalAppointments, todayTokens] = await prisma.$transaction([
    prisma.appointment.count({ where: { providerId: id } }),
    prisma.token.count({ where: { doctorId: id, date: today } }),
  ]);
  return { ...withConsultationFee(doctor), totalAppointments, todayTokens };
}

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
  return { data: data.map(withConsultationFee), total };
}

export async function createDoctor(input: DoctorInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const created = await getPrisma().user.create({
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
          avatar: input.avatar?.trim() || null,
          consultationFee: parseFee(input.consultationFee),
        },
      },
    },
    select: doctorSelect,
  });
  await getPrisma().$executeRawUnsafe(
    'UPDATE "User" SET "avatar" = ? WHERE id = ?',
    input.avatar?.trim() || null,
    created.id,
  );
  return withConsultationFee(created);
}

export async function updateDoctor(id: string, input: DoctorUpdateInput) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  const hasProfile = input.specialization !== undefined;
  const updated = await getPrisma().user.update({
    where: { id },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: bcrypt.hashSync(input.password, 10) } : {}),
      ...(hasProfile ? {
        doctorProfile: {
          upsert: {
            create: {
              specialization: input.specialization!.trim(),
              qualification: input.qualification?.trim() || null,
              experienceYears: input.experienceYears ?? 0,
              phone: input.phone?.trim() || null,
              bio: input.bio?.trim() || null,
              avatar: input.avatar?.trim() || null,
              consultationFee: parseFee(input.consultationFee),
            },
            update: {
              specialization: input.specialization!.trim(),
              qualification: input.qualification?.trim() || null,
              experienceYears: input.experienceYears ?? 0,
              phone: input.phone?.trim() || null,
              bio: input.bio?.trim() || null,
              consultationFee: parseFee(input.consultationFee),
              ...(input.avatar !== undefined ? { avatar: input.avatar?.trim() || null } : {}),
            },
          },
        },
      } : {}),
    },
    select: doctorSelect,
  });
  if (input.avatar !== undefined) {
    await getPrisma().$executeRawUnsafe(
      'UPDATE "User" SET "avatar" = ? WHERE id = ?',
      input.avatar?.trim() || null,
      id,
    );
  }
  return withConsultationFee(updated);
}

export async function deleteDoctor(id: string): Promise<void> {
  await getPrisma().user.delete({ where: { id } });
}
