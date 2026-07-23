import type { PatientInput, PatientListInput } from '@/types/patient';

export const patientsService = {
  list: (input: PatientListInput) => window.clinic.patients.list(input),
  create: (input: PatientInput) => window.clinic.patients.create(input),
  update: (id: string, input: PatientInput) => window.clinic.patients.update(id, input),
  delete: (id: string) => window.clinic.patients.delete(id),
};
