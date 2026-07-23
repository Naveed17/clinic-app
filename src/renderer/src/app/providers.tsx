import type { PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ColorModeContext, type ColorMode } from './colorMode';
import { createAppTheme } from './theme';
import { AuthProvider } from '@/features/auth/AuthContext';
import { useSocket, useRealtimeInvalidation } from '@/hooks';
import { AppointmentToast } from '@/components/AppointmentToast';

function RealtimeBootstrap({ children }: PropsWithChildren): React.JSX.Element {
  useSocket();
  useRealtimeInvalidation();
  return <>{children}<AppointmentToast /></>;
}

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  const [mode, setMode] = useState<ColorMode>(() => {
    const savedMode = window.localStorage.getItem('clinic-color-mode');
    return savedMode === 'dark' ? 'dark' : 'light';
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
            <RealtimeBootstrap>{children}</RealtimeBootstrap>
          </AuthProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </QueryClientProvider>
  );
}
