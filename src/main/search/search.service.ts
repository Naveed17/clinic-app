import { getPrisma } from '../database/client';
import type { SearchScope } from '../../shared/searchAccess';

export interface GlobalSearchResult {
  patients: Array<{
    id: string;
    mrNumber: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    bloodGroup: string | null;
    createdAt: Date;
  }>;
  appointments: Array<{
    id: string;
    reason: string | null;
    status: string;
    startsAt: Date;
    patientId: string;
    patientName: string;
    patientMrNumber: string;
    providerName: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    amountPaid: number;
    patientId: string;
    patientName: string;
    patientMrNumber: string;
    createdAt: Date;
  }>;
  labOrders: Array<{
    id: string;
    test: string;
    status: string;
    patientId: string;
    patientName: string;
    patientMrNumber: string;
    orderedAt: Date;
  }>;
}

export async function globalSearch(
  query: string,
  scope: SearchScope,
): Promise<GlobalSearchResult> {
  const empty: GlobalSearchResult = { patients: [], appointments: [], invoices: [], labOrders: [] };
  if (!query || query.trim().length < 2) {
    return empty;
  }

  const q = query.trim();
  const prisma = getPrisma();

  const [patients, appointments, invoices, labOrders] = await Promise.all([
    scope.patients
      ? prisma.patient.findMany({
          where: {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
              { mrNumber: { contains: q } },
            ],
          },
          select: {
            id: true,
            mrNumber: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            bloodGroup: true,
            createdAt: true,
          },
          take: 8,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        })
      : Promise.resolve([]),

    scope.appointments
      ? prisma.appointment.findMany({
          where: {
            OR: [
              { reason: { contains: q } },
              { patient: { firstName: { contains: q } } },
              { patient: { lastName: { contains: q } } },
              { patient: { mrNumber: { contains: q } } },
              { patient: { phone: { contains: q } } },
            ],
          },
          select: {
            id: true,
            reason: true,
            status: true,
            startsAt: true,
            patientId: true,
            patient: { select: { firstName: true, lastName: true, mrNumber: true } },
            provider: { select: { firstName: true, lastName: true } },
          },
          take: 5,
          orderBy: { startsAt: 'desc' },
        })
      : Promise.resolve([]),

    scope.invoices
      ? prisma.invoice.findMany({
          where: {
            OR: [
              { invoiceNumber: { contains: q } },
              { patient: { firstName: { contains: q } } },
              { patient: { lastName: { contains: q } } },
              { patient: { mrNumber: { contains: q } } },
              { patient: { phone: { contains: q } } },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            amountPaid: true,
            patientId: true,
            createdAt: true,
            patient: { select: { firstName: true, lastName: true, mrNumber: true } },
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    scope.labOrders
      ? prisma.labOrder.findMany({
          where: {
            OR: [
              { test: { contains: q } },
              { patient: { firstName: { contains: q } } },
              { patient: { lastName: { contains: q } } },
              { patient: { mrNumber: { contains: q } } },
              { patient: { phone: { contains: q } } },
            ],
          },
          select: {
            id: true,
            test: true,
            status: true,
            patientId: true,
            orderedAt: true,
            patient: { select: { firstName: true, lastName: true, mrNumber: true } },
          },
          take: 5,
          orderBy: { orderedAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  return {
    patients,
    appointments: appointments.map((a) => ({
      id: a.id,
      reason: a.reason,
      status: a.status,
      startsAt: a.startsAt,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName || ''}`.trim(),
      patientMrNumber: a.patient.mrNumber,
      providerName: `${a.provider.firstName} ${a.provider.lastName}`,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      total: Number(i.total),
      amountPaid: Number(i.amountPaid),
      patientId: i.patientId,
      patientName: `${i.patient.firstName} ${i.patient.lastName || ''}`.trim(),
      patientMrNumber: i.patient.mrNumber,
      createdAt: i.createdAt,
    })),
    labOrders: labOrders.map((l) => ({
      id: l.id,
      test: l.test,
      status: l.status,
      patientId: l.patientId,
      patientName: `${l.patient.firstName} ${l.patient.lastName || ''}`.trim(),
      patientMrNumber: l.patient.mrNumber,
      orderedAt: l.orderedAt,
    })),
  };
}
