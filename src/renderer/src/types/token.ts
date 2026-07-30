export type TokenStatus = 'WAITING' | 'DONE' | 'SKIPPED';

export interface TokenPerson {
  id: string;
  mrNumber?: string;
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
  reason: string | null;
  createdAt: string;
  patient: TokenPerson;
  doctor: TokenPerson;
  prescription: Prescription | null;
}

export interface TokenInput {
  patientId: string;
  doctorId: string;
  date: string;
  notes?: string | null;
  reason?: string | null;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  tokenId: string;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  tests: string[];
  advice: string;
  createdAt: string;
}

export interface PrescriptionInput {
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  tests: string[];
  advice: string;
}

export interface PrescriptionFeedItem {
  id: string;
  tokenId: string;
  tokenNumber: number;
  patientName: string;
  doctorName: string;
  createdAt: string;
}
