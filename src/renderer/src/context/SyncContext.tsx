/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface SyncProgressInfo {
  percent: number;
  label: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncTime: number | null;
  peerUrl: string | null;
  peerName?: string;
  message?: string;
  recordsSyncedLastTime?: number;
  progress?: SyncProgressInfo;
}

export interface SyncContextValue {
  status: SyncStatus;
  isSyncing: boolean;
  syncNow: (customPeerUrl?: string) => Promise<{ ok: boolean; recordsSynced?: number; error?: string }>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren): React.JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncTime: null,
    peerUrl: null,
  });

  const invalidateAllData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['tokens'] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    void queryClient.invalidateQueries({ queryKey: ['patients'] });
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['doctors'] });
    void queryClient.invalidateQueries({ queryKey: ['medicines'] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
    void queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
  }, [queryClient]);

  useEffect(() => {
    // Initial status
    void window.clinic?.sync?.status?.().then((s) => {
      if (s) setStatus(s);
    });

    // Listen to status updates from main process
    const unsubStatus = window.clinic?.sync?.onStatusChange?.((newStatus) => {
      setStatus(newStatus);
      if (newStatus.recordsSyncedLastTime && newStatus.recordsSyncedLastTime > 0) {
        invalidateAllData();
      }
    });

    // Listen to data change events
    const unsubData = window.clinic?.sync?.onDataChanged?.(() => {
      invalidateAllData();
    });

    return () => {
      unsubStatus?.();
      unsubData?.();
    };
  }, [invalidateAllData]);

  const syncNow = useCallback(async (customPeerUrl?: string) => {
    if (!window.clinic?.sync?.trigger) {
      return { ok: false, error: 'Sync feature not available.' };
    }
    const res = await window.clinic.sync.trigger(customPeerUrl);
    if (res.ok && res.recordsSynced && res.recordsSynced > 0) {
      invalidateAllData();
    }
    return res;
  }, [invalidateAllData]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      isSyncing: status.state === 'syncing',
      syncNow,
    }),
    [status, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return ctx;
}
