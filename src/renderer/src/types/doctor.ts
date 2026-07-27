export interface DoctorProfile {
  id: string;
  userId: string;
  specialization: string;
  qualification: string | null;
  experienceYears: number;
  phone: string | null;
  bio: string | null;
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'DOCTOR';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  doctorProfile: DoctorProfile | null;
}

export interface DoctorInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isActive: boolean;
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
}

export interface DoctorUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  password?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
}

export interface DoctorListInput {
  page: number;
  pageSize: number;
  search: string;
}
