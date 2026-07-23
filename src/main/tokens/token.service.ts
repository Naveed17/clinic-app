import type { TokenStatus } from '@prisma/client';
import { getPrisma } from '../database/client';

export interface TokenInput {
  patientId: string;
  doctorId: string;
  date: string;
  notes?: string | null;
}

const tokenInclude = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  doctor:  { select: { id: true, firstName: true, lastName: true } },
};

export async function listTokens(date: string) {
  return getPrisma().token.findMany({
    where: { date },
    include: tokenInclude,
    orderBy: { tokenNumber: 'asc' },
  });
}

export async function listTokenDoctors() {
  return getPrisma().user.findMany({
    where: { role: 'DOCTOR', isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function listTokenPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function createToken(input: TokenInput) {
  const last = await getPrisma().token.findFirst({
    where: { date: input.date, doctorId: input.doctorId },
    orderBy: { tokenNumber: 'desc' },
    select: { tokenNumber: true },
  });
  const tokenNumber = (last?.tokenNumber ?? 0) + 1;
  return getPrisma().token.create({
    data: {
      tokenNumber,
      date: input.date,
      patientId: input.patientId,
      doctorId: input.doctorId,
      notes: input.notes?.trim() ?? null,
    },
    include: tokenInclude,
  });
}

export async function updateTokenStatus(id: string, status: TokenStatus) {
  return getPrisma().token.update({
    where: { id },
    data: { status },
    include: tokenInclude,
  });
}

export async function deleteToken(id: string) {
  return getPrisma().token.delete({ where: { id } });
}
