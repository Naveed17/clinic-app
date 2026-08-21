export type TokenStatus = 'WAITING' | 'DONE' | 'SKIPPED';

export interface TokenPerson {
  id: string;
  mrNumber?: string;
  firstName: string;
  lastName: string;
  consultationFee?: number;
  avatar?: string | null;
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
  consultationFee?: number;
  feeDiscount?: number;
  feeRefunded?: number;
  createdAt: string;
  updatedAt?: string;
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
  consultationFee?: number;
  feeDiscount?: number;
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
  thumbName?: string | null;
  thumbnail?: string | null;
  pharmacyStatus?: 'PENDING' | 'DISPENSED';
  dispensedAt?: string | null;
  invoiceId?: string | null;
  createdAt: string;
}

export interface PrescriptionInput {
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  tests: string[];
  advice: string;
  thumbName?: string | null;
  thumbnail?: string | null;
}

export interface PrescriptionFeedItem {
  id: string;
  tokenId: string;
  tokenNumber: number;
  patientName: string;
  doctorName: string;
  createdAt: string;
}

export interface PharmacyQueueItem {
  prescriptionId: string;
  tokenId: string;
  tokenNumber: number;
  date: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  patientMrNumber: string | null;
  doctorName: string;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  tests: string[];
  advice: string;
  pharmacyStatus: 'PENDING' | 'DISPENSED';
  dispensedAt: string | null;
  invoiceId: string | null;
  appointmentCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
