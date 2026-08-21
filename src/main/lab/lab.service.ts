import { getPrisma } from '../database/client';

export interface LabOrderInput {
  patientId: string;
  orderedById: string;
  tokenId?: string | null;
  test: string;
  notes?: string | null;
}

const include = {
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mrNumber: true,
      dateOfBirth: true,
      phone: true,
      bloodGroup: true,
    },
  },
  orderedBy: { select: { id: true, firstName: true, lastName: true } },
  token: { select: { id: true, tokenNumber: true } },
} as const;

type LabOrderWithRelations = {
  id: string;
  patientId: string;
  orderedById: string;
  tokenId: string | null;
  test: string;
  status: string;
  result: string | null;
  notes: string | null;
  orderedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrNumber: string;
    dateOfBirth: Date | null;
    phone: string | null;
    bloodGroup: string | null;
  };
  orderedBy: { id: string; firstName: string; lastName: string };
  token: { id: string; tokenNumber: number } | null;
};

function serialize(order: LabOrderWithRelations) {
  return {
    ...order,
    tokenNumber: order.token?.tokenNumber ?? null,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`,
    orderedByName: `${order.orderedBy.firstName} ${order.orderedBy.lastName}`,
    patientMrNumber: order.patient.mrNumber,
    patientDob: order.patient.dateOfBirth,
    patientPhone: order.patient.phone,
    patientBloodGroup: order.patient.bloodGroup,
  };
}

export async function listLabOrders() {
  const orders = await getPrisma().labOrder.findMany({
    include,
    orderBy: { orderedAt: 'desc' }, // Latest order sab se top par
  });
  return orders.map(serialize);
}

export async function getLabOrder(id: string) {
  const order = await getPrisma().labOrder.findUnique({ where: { id }, include });
  return order ? serialize(order) : null;
}

export async function listLabOrdersByToken(tokenId: string) {
  const orders = await getPrisma().labOrder.findMany({
    where: { tokenId },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(serialize);
}

export async function createLabOrder(input: LabOrderInput) {
  const order = await getPrisma().labOrder.create({
    data: {
      patientId: input.patientId,
      orderedById: input.orderedById,
      tokenId: input.tokenId ?? null,
      test: input.test,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    },
    include,
  });
  return serialize(order);
}

export async function updateLabOrderStatus(id: string, status: string) {
  const order = await getPrisma().labOrder.update({
    where: { id },
    data: { status: status as import('@prisma/client').LabOrderStatus, updatedAt: new Date() },
    include,
  });
  return serialize(order);
}

export async function saveLabResult(id: string, result: string) {
  const order = await getPrisma().labOrder.update({
    where: { id },
    data: { result: result.trim(), status: 'COMPLETED', updatedAt: new Date() },
    include,
  });
  return serialize(order);
}

export async function labPatients() {
  return getPrisma().patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'desc' }, 
  });
}