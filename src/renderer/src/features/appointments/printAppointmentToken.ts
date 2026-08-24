import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { Appointment } from '@/types/appointment';
import type { Token } from '@/types/token';
import { localDateStr } from '@/utils/appointmentSlot';

export function appointmentLocalDate(startsAt: string): string {
  return localDateStr(new Date(startsAt));
}

export async function loadTokenForAppointment(appointment: Appointment): Promise<Token | null> {
  if (appointment.tokenId) {
    const byId = await window.clinic.tokens.getById(appointment.tokenId);
    if (byId) return byId;
  }
  return window.clinic.tokens.getForPatient(
    appointment.patientId,
    appointmentLocalDate(appointment.startsAt),
    appointment.providerId,
  );
}

export function usePrintAppointmentToken() {
  const [printToken, setPrintToken] = useState<Token | null>(null);

  const mutation = useMutation({
    mutationFn: async (appointment: Appointment) => {
      const token = await loadTokenForAppointment(appointment);
      if (!token) throw new Error('No token found for this visit.');
      return token;
    },
    onSuccess: (token) => setPrintToken(token),
    meta: { errorToast: 'No token found for this visit.' },
  });

  return {
    printToken,
    closePrint: () => setPrintToken(null),
    printFor: (appointment: Appointment) => mutation.mutate(appointment),
    printingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  };
}
