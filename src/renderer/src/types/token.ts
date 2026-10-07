export type TokenStatus = 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED' | 'ON_HOLD' | 'COMPLETED' | 'CALLED' | 'IN_CONSULTATION' | 'CANCELLED';
export type TokenPriority = 'NORMAL' | 'URGENT' | 'SENIOR' | 'CHILD';

export interface TokenVitals {
  bp?: string;
  pulse?: number | string;
  temp?: number | string;
  spo2?: number | string;
  rbs?: number | string;
  weight?: number | string;
  notes?: string;
  recordedAt?: string;
}

export interface TokenPerson {
  id: string;
  mrNumber?: string;
  firstName: string;
  lastName: string;
  gender?: string | null;
  age?: number | null;
  weight?: number | null;
  phone?: string | null;
  address?: string | null;
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
  priority?: TokenPriority;
  vitals?: TokenVitals | null;
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
  priority?: TokenPriority | string;
  vitals?: TokenVitals | null;
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
