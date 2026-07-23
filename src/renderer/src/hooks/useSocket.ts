import { useEffect, useRef } from 'react';
import { realtimeService } from '@/services/realtime.service';

export function useSocket(): void {
  const connected = useRef(false);

  useEffect(() => {
    if (connected.current) return;
    connected.current = true;
    void realtimeService.connect();
    return () => {
      realtimeService.disconnect();
      connected.current = false;
    };
  }, []);
}
