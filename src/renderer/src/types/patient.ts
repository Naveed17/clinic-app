export interface Patient {
  id: string;
  mrNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string | null;
  gender?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  primaryDoctorId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  /** Age in years — converted to approximate dateOfBirth on save when provided. */
  age?: number | string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  primaryDoctorId?: string | null;
}

export interface PatientListInput {
  page: number;
  pageSize: number;
  search: string;
  providerId?: string;
}
