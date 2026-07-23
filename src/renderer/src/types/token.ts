export type TokenStatus = 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';

export interface TokenPerson {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Token {
  id: string;
  tokenNumber: number;
  date: string;
  patientId: string;
  doctorId: string;
  status: TokenStatus;
  notes: string | null;
  createdAt: string;
  patient: TokenPerson;
  doctor: TokenPerson;
}

export interface TokenInput {
  patientId: string;
  doctorId: string;
  date: string;
  notes?: string | null;
}
