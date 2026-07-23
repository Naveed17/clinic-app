import type { Patient, Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface PatientListInput {
  page: number;
  pageSize: number;
  search: string;
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

function mapPatientInput(input: PatientInput): Prisma.PatientCreateInput {
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

export async function listPatients({ page, pageSize, search }: PatientListInput): Promise<{
  data: Patient[];
  total: number;
}> {
  const prisma = getPrisma();
  const where: Prisma.PatientWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {};
  const [data, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ]);

  return { data, total };
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  return getPrisma().patient.create({ data: mapPatientInput(input) });
}

export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  return getPrisma().patient.update({ where: { id }, data: mapPatientInput(input) });
}

export async function deletePatient(id: string): Promise<void> {
  await getPrisma().patient.delete({ where: { id } });
}
