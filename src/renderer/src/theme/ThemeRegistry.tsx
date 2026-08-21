import { useMemo, type JSX, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useColorMode } from '@/app/colorMode';
import { createTheme } from './create-theme';
import { GlobalStyles } from './globalStyles';

export interface ThemeRegistryProps {
  children: ReactNode;
}

export function ThemeRegistry({ children }: ThemeRegistryProps): JSX.Element {
  const { mode } = useColorMode();
  const theme = useMemo(() => createTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles />
      {children}
    </MuiThemeProvider>
  );
}
