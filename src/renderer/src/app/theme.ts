import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
  const isLight = mode === 'light';
  return createTheme({
    palette: {
      mode,
      primary: { main: '#16a34a', contrastText: '#fff' },
      secondary: { main: '#2563eb' },
      background: {
        default: isLight ? '#ebebeb' : '#0f1410',
        paper: isLight ? '#ffffff' : '#1a2420',
      },
      divider: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)',
    },
    shape: { borderRadius: 16 },
    shadows: [
      'none',
      '0 1px 4px rgba(0,0,0,0.06)',
      '0 2px 8px rgba(0,0,0,0.08)',
      '0 4px 16px rgba(0,0,0,0.10)',
      '0 6px 24px rgba(0,0,0,0.12)',
      ...Array(20).fill('0 8px 32px rgba(0,0,0,0.14)'),
    ] as any,
    typography: {
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      h5: { fontWeight: 800, letterSpacing: '-0.02em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 },
          contained: { boxShadow: '0 2px 8px rgba(22,163,74,0.25)' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 16,
            border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)',
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { borderRadius: 16 } },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 8 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' },
          head: { fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: isLight ? '#6b7280' : '#9ca3af' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 99 } },
      },
    },
  });
}

export const appTheme = createAppTheme('light');
