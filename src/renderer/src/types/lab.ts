export type LabOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface LabOrder {
  id: string;
  patientId: string;
  orderedById: string;
  tokenId: string | null;
  tokenNumber: number | null;
  test: string;
  status: LabOrderStatus;
  result: string | null;
  notes: string | null;
  orderedAt: string;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  orderedByName: string;
  patientMrNumber?: string | null;
  patientDob?: string | Date | null;
  patientPhone?: string | null;
  patientBloodGroup?: string | null;
}
