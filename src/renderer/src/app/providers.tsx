import type { PropsWithChildren } from 'react';
import React, { useMemo, useState, useEffect } from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ColorModeContext, type ColorMode } from './colorMode';
import { ThemeRegistry } from '@/theme';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LicenseModulesProvider } from '@/features/auth/LicenseModulesContext';
import { useSocket, useRealtimeInvalidation } from '@/hooks';
import { AppointmentToast } from '@/components/AppointmentToast';
import { AppToastHost, showAppToast } from '@/components/AppToast';
import { UpdateBanner } from '@/components/UpdateBanner';
import { UpdateProvider } from '@/context/updateProvider';
import { DatabaseModeProvider } from '@/context/DatabaseModeProvider';

function RealtimeBootstrap({ children }: PropsWithChildren): React.JSX.Element {
  useSocket();
  useRealtimeInvalidation();

  useEffect(() => {
    const off = window.clinic.settings.onLanReconnected(() => {
      window.location.reload();
    });
    return off;
  }, []);

  return <>{children}<AppointmentToast /><AppToastHost /><UpdateBanner /></>;
}

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  const [mode, setMode] = useState<ColorMode>(() => {
    const savedMode = window.localStorage.getItem('clinic-color-mode');
    if (savedMode === 'dark' || savedMode === 'light') return savedMode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            gcTime: 300_000,
          },
        },
        mutationCache: new MutationCache({
          onSuccess: (_data, _vars, _ctx, mutation) => {
            const meta = mutation.meta;
            if (meta?.silent || !meta?.toast) return;
            showAppToast({ type: 'success', message: meta.toast });
          },
          onError: (error, _vars, _ctx, mutation) => {
            const meta = mutation.meta;
            if (meta?.silent || meta?.errorToast === false) return;
            const fromErr = error instanceof Error ? error.message.trim() : '';
            const fallback = typeof meta?.errorToast === 'string' ? meta.errorToast : '';
            const message = fromErr || fallback;
            if (message) showAppToast({ type: 'error', message });
          },
        }),
      }),
  );
  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((currentMode) => {
          const nextMode = currentMode === 'light' ? 'dark' : 'light';
          window.localStorage.setItem('clinic-color-mode', nextMode);
          return nextMode;
        });
      },
    }),
    [mode],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeRegistry>
          <AuthProvider>
            <DatabaseModeProvider>
              <LicenseModulesProvider>
                <UpdateProvider>
                  <RealtimeBootstrap>{children}</RealtimeBootstrap>
                </UpdateProvider>
              </LicenseModulesProvider>
            </DatabaseModeProvider>
          </AuthProvider>
        </ThemeRegistry>
      </ColorModeContext.Provider>
    </QueryClientProvider>
  );
}
