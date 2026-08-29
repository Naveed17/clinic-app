export interface AppointmentPerson {
  role?: string;
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  consultationFee?: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  reason: string | null;
  notes: string | null;
  feeType?: 'PAID' | 'FREE' | 'HALF' | string | null;
  recurrenceRule: string | null;
  parentId: string | null;
  tokenId: string | null;
  tokenNumber: number | null;
  patient: AppointmentPerson;
  provider: AppointmentPerson;
}

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  notes?: string | null;
  feeType?: 'PAID' | 'FREE' | 'HALF' | string | null;
  recurrenceRule?: string | null;
  tokenId?: string | null;
}
