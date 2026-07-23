import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';

const ENTITY_QUERY_MAP: Record<string, string[]> = {
  patient: ['patients'],
  appointment: ['appointments'],
  doctor: ['doctors'],
  invoice: ['invoices'],
  token: ['tokens'],
};

export function useRealtimeInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = realtimeService.onNotification((notification: RealtimeNotification) => {
      const entity = notification.payload?.entity as string | undefined;
      if (!entity) return;
      const keys = ENTITY_QUERY_MAP[entity];
      if (!keys) return;
      keys.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: [key] });
      });
    });
    return unsubscribe;
  }, [queryClient]);
}
