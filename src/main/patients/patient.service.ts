import type { Patient, Prisma } from '@prisma/client';
import { getPrisma } from '../database/client';
import { ageToDateOfBirth } from '../../shared/patientAge';
import { toWhatsAppNumber } from '../../shared/whatsappPhone';

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
  age?: number | string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  /** Doctor who registered / owns this patient (not an appointment). */
  primaryDoctorId?: string | null;
}

async function generateMrNumber(): Promise<string> {
  const prisma = getPrisma();
  const res = await prisma.$queryRawUnsafe<{ maxNum: number | bigint | null }[]>(
    `SELECT MAX(CAST(SUBSTR("mrNumber", 4) AS INTEGER)) as maxNum FROM "Patient" WHERE "mrNumber" LIKE 'MR-%'`,
  );
  const raw = res[0]?.maxNum;
  const lastNum = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0;
  return `MR-${String(lastNum + 1).padStart(5, '0')}`;
}

function resolveDateOfBirth(input: PatientInput): Date | null {
  if (input.dateOfBirth) return new Date(input.dateOfBirth);
  if (input.age != null && String(input.age).trim() !== '') {
    return ageToDateOfBirth(input.age);
  }
  return null;
}

function mapPatientInput(input: PatientInput): Omit<Prisma.PatientCreateInput, 'mrNumber'> {
  const data = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dateOfBirth: resolveDateOfBirth(input),
    gender: input.gender?.trim() || null,
    phone: toWhatsAppNumber(input.phone) || input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    bloodGroup: input.bloodGroup?.trim() || null,
    allergies: input.allergies?.trim() || null,
    chronicConditions: input.chronicConditions?.trim() || null,
    ...(input.primaryDoctorId ? { primaryDoctor: { connect: { id: input.primaryDoctorId } } } : {}),
  };
  return data as Omit<Prisma.PatientCreateInput, 'mrNumber'>;
}

export async function listPatients({ page, pageSize, search, providerId }: PatientListInput): Promise<{
  data: Patient[];
  total: number;
}> {
  const prisma = getPrisma();
  const where: Prisma.PatientWhereInput = {
    ...(providerId
      ? {
          OR: [
            { primaryDoctorId: providerId },
            { appointments: { some: { providerId } } },
            { tokens: { some: { doctorId: providerId } } },
          ],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
            { mrNumber: { contains: search } },
          ],
        }
      : {}),
  };

  // When both provider + search, Prisma ANDs top-level keys — but two OR keys collide.
  // Build AND explicitly when both are present.
  const whereFinal: Prisma.PatientWhereInput =
    providerId && search
      ? {
          AND: [
            {
              OR: [
                { primaryDoctorId: providerId },
                { appointments: { some: { providerId } } },
                { tokens: { some: { doctorId: providerId } } },
              ],
            },
            {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { phone: { contains: search } },
                { email: { contains: search } },
                { mrNumber: { contains: search } },
              ],
            },
          ],
        }
      : where;

  const [data, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where: whereFinal,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where: whereFinal }),
  ]);

  // Ensure deterministic descending sort by parsed UNIX timestamp (newest patient first)
  data.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (tB !== tA) return tB - tA;
    const mrA = parseInt((a.mrNumber || '').replace(/\D/g, ''), 10) || 0;
    const mrB = parseInt((b.mrNumber || '').replace(/\D/g, ''), 10) || 0;
    return mrB - mrA;
  });

  return { data, total };
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  const mrNumber = await generateMrNumber();
  return getPrisma().patient.create({ data: { ...mapPatientInput(input), mrNumber } });
}

export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  const data = mapPatientInput(input);
  // Do not re-assign primary doctor on normal demographic edits unless explicitly sent
  if (input.primaryDoctorId === undefined) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
  } else if (!input.primaryDoctorId) {
    delete (data as { primaryDoctor?: unknown }).primaryDoctor;
    (data as Prisma.PatientUpdateInput).primaryDoctor = { disconnect: true };
  }
  return getPrisma().patient.update({ where: { id }, data });
}

export async function deletePatient(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({ where: { patientId: id }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length > 0) {
      await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { patientId: id } });
    }

    const labOrders = await tx.labOrder.findMany({ where: { patientId: id }, select: { id: true } });
    const labOrderIds = labOrders.map((o) => o.id);
    if (labOrderIds.length > 0) {
      await tx.labReport.deleteMany({ where: { labOrderId: { in: labOrderIds } } });
      await tx.labOrder.deleteMany({ where: { patientId: id } });
    }

    const tokens = await tx.token.findMany({ where: { patientId: id }, select: { id: true } });
    if (tokens.length > 0) {
      // Prescription is SQLite-only (not in Prisma schema); remove before tokens.
      for (const token of tokens) {
        await tx.$executeRawUnsafe('DELETE FROM "Prescription" WHERE "tokenId" = ?', token.id);
      }
      await tx.token.deleteMany({ where: { patientId: id } });
    }

    await tx.appointment.deleteMany({ where: { patientId: id } });
    await tx.patientDocument.deleteMany({ where: { patientId: id } });
    await tx.patient.delete({ where: { id } });
  });
}
