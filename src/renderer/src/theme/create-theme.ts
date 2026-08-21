import { extendTheme } from '@mui/material/styles';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import { colorSchemes } from './color-schemes';
import { components } from './components/components';
import { shadows } from './shadows';
import type { ColorScheme, Theme } from './types';
import { typography } from './typography';

export function createTheme(mode: ColorScheme): Theme {
  const theme = extendTheme({
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1440 } },
    components,
    colorSchemes: {
      [mode]: colorSchemes[mode],
    },
    defaultColorScheme: mode,
    shadows,
    shape: { borderRadius: 16 },
    typography,
  });

  return theme;
}

export const createAppTheme = createTheme;
export const appTheme = createTheme('light');
