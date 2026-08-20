import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';

const ENTITY_QUERY_MAP: Record<string, string[]> = {
  patient: ['patients'],
  appointment: ['appointments'],
  doctor: ['doctors'],
  invoice: ['invoices'],
  token: ['tokens'],
  prescription: ['prescription-feed', 'tokens'],
  lab: ['lab-orders', 'lab-patients', 'lab-orders-token'],
  medicine: ['medicines'],
  chat: ['chat'],
};

export function useRealtimeInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate on notification (existing path)
    const unsubNotification = realtimeService.onNotification((notification: RealtimeNotification) => {
      const entity = notification.payload?.entity as string | undefined;
      if (!entity) return;
      const keys = ENTITY_QUERY_MAP[entity];
      keys?.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
    });

    // Invalidate on data:changed (new path — covers tokens, lab, and all routes)
    const unsubData = realtimeService.onDataChanged(({ entity }) => {
      const keys = ENTITY_QUERY_MAP[entity];
      keys?.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
    });

    return () => {
      unsubNotification();
      unsubData();
    };
  }, [queryClient]);
}
