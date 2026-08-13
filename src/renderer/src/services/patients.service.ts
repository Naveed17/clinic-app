import type { PatientInput, PatientListInput } from '@/types/patient';
import { toWhatsAppNumber } from '@shared/whatsappPhone';

function withWhatsAppPhone(input: PatientInput): PatientInput {
  return {
    ...input,
    phone: toWhatsAppNumber(input.phone) || input.phone?.trim() || null,
  };
}

export const patientsService = {
  list: (input: PatientListInput) => window.clinic.patients.list(input),
  create: (input: PatientInput) => window.clinic.patients.create(withWhatsAppPhone(input)),
  update: (id: string, input: PatientInput) => window.clinic.patients.update(id, withWhatsAppPhone(input)),
  delete: (id: string) => window.clinic.patients.delete(id),
};
