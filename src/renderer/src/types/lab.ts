export type LabOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface LabOrder {
  id: string;
  patientId: string;
  orderedById: string;
  test: string;
  status: LabOrderStatus;
  result: string | null;
  notes: string | null;
  orderedAt: string;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  orderedByName: string;
}
