import { getPrisma } from '../database/client';

export interface LabOrderInput {
  patientId: string;
  orderedById: string;
  test: string;
  notes?: string | null;
}

const include = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  orderedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

type LabOrderWithRelations = {
  id: string;
  patientId: string;
  orderedById: string;
  test: string;
  status: string;
  result: string | null;
  notes: string | null;
  orderedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  patient: { id: string; firstName: string; lastName: string };
  orderedBy: { id: string; firstName: string; lastName: string };
};

function serialize(order: LabOrderWithRelations) {
  return {
    ...order,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`,
    orderedByName: `${order.orderedBy.firstName} ${order.orderedBy.lastName}`,
  };
}

export async function listLabOrders() {
  const orders = await getPrisma().labOrder.findMany({
    include,
    orderBy: { orderedAt: 'desc' },
  });
  return orders.map(serialize);
}

export async function createLabOrder(input: LabOrderInput) {
  const order = await getPrisma().labOrder.create({
    data: {
      patientId: input.patientId,
      orderedById: input.orderedById,
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
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}
