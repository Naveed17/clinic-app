export type UserRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_TECHNICIAN' | 'PHARMACIST';

export interface DoctorProfile {
  id: string;
  userId: string;
  specialization: string;
  qualification: string | null;
  experienceYears: number;
  phone: string | null;
  bio: string | null;
  avatar: string | null;
  consultationFee?: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
  doctorProfile: DoctorProfile | null;
}

export interface DoctorProfileInput {
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  phone?: string;
  bio?: string;
  avatar?: string | null;
  consultationFee?: number;
}

export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string | null;
  doctorProfile?: DoctorProfileInput;
}

export interface UserUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  password?: string;
  avatar?: string | null;
  doctorProfile?: DoctorProfileInput;
}

export interface UserListInput {
  page: number;
  pageSize: number;
  search: string;
}
