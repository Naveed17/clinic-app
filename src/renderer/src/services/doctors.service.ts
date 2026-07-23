import type { DoctorInput, DoctorListInput, DoctorUpdateInput } from '@/types/doctor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clinic = (window as any).clinic;

export const doctorsService = {
  list: (input: DoctorListInput) => clinic.doctors.list(input),
  create: (input: DoctorInput) => clinic.doctors.create(input),
  update: (id: string, input: DoctorUpdateInput) => clinic.doctors.update(id, input),
  delete: (id: string) => clinic.doctors.delete(id),
};
