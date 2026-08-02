import type { Patient, Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface PatientListInput {
  page: number;
  pageSize: number;
  search: string;
  providerId?: string;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
}

async function generateMrNumber(): Promise<string> {
  const prisma = getPrisma();
  const last = await prisma.patient.findFirst({
    orderBy: { mrNumber: 'desc' },
    select: { mrNumber: true },
  });
  const lastNum = last ? parseInt(last.mrNumber.replace('MR-', ''), 10) : 0;
  return `MR-${String(lastNum + 1).padStart(5, '0')}`;
}

function mapPatientInput(input: PatientInput): Omit<Prisma.PatientCreateInput, 'mrNumber'> {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    bloodGroup: input.bloodGroup?.trim() || null,
    allergies: input.allergies?.trim() || null,
    chronicConditions: input.chronicConditions?.trim() || null,
  };
}

export async function listPatients({ page, pageSize, search, providerId }: PatientListInput): Promise<{
  data: Patient[];
  total: number;
}> {
  const prisma = getPrisma();
  const where: Prisma.PatientWhereInput = {
    ...(providerId ? { appointments: { some: { providerId } } } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { mrNumber: { contains: search } },
      ],
    } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ]);

  return { data, total };
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  const mrNumber = await generateMrNumber();
  return getPrisma().patient.create({ data: { ...mapPatientInput(input), mrNumber } });
}

export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  return getPrisma().patient.update({ where: { id }, data: mapPatientInput(input) });
}

export async function deletePatient(id: string): Promise<void> {
  await getPrisma().patient.delete({ where: { id } });
}
