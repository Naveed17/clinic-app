export interface AppointmentPerson {
  id: string;
  firstName: string;
  lastName: string;
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
  recurrenceRule: string | null;
  parentId: string | null;
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
  recurrenceRule?: string | null;
}
