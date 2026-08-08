import type { PropsWithChildren } from 'react';
import React, { useMemo, useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ColorModeContext, type ColorMode } from './colorMode';
import { createAppTheme } from './theme';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LicenseModulesProvider } from '@/features/auth/LicenseModulesContext';
import { useSocket, useRealtimeInvalidation } from '@/hooks';
import { AppointmentToast } from '@/components/AppointmentToast';
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

  return <>{children}<AppointmentToast /><UpdateBanner /></>;
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
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
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
  const theme = useMemo(() => createAppTheme(mode as PaletteMode), [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <DatabaseModeProvider>
              <LicenseModulesProvider>
                <UpdateProvider>
                  <RealtimeBootstrap>{children}</RealtimeBootstrap>
                </UpdateProvider>
              </LicenseModulesProvider>
            </DatabaseModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </QueryClientProvider>
  );
}
