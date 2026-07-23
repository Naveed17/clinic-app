import type { Appointment, AppointmentInput } from '@/types/appointment';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clinic = (window as any).clinic;


export const appointmentsService = {
  list: () => clinic.appointments.list() as Promise<Appointment[]>,
  patients: () => clinic.appointments.patients(),
  doctors: () => clinic.appointments.doctors(),
  create: (input: AppointmentInput) => clinic.appointments.create(input),
  update: (id: string, input: AppointmentInput) => clinic.appointments.update(id, input),
  updateStatus: (id: string, status: Appointment['status']) => clinic.appointments.updateStatus(id, status),
  cancel: (id: string) => clinic.appointments.cancel(id),
};


