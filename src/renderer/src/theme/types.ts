import type { CssVarsTheme, Theme as BaseTheme } from '@mui/material/styles';

export type Theme = Omit<BaseTheme, 'palette'> & CssVarsTheme;

export type ColorScheme = 'dark' | 'light';

export type PaletteRange = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
};

declare module '@mui/material/styles' {
  interface Palette {
    neutral: PaletteRange;
  }

  interface PaletteOptions {
    neutral?: PaletteRange;
  }

  interface TypeBackground {
    level1: string;
    level2: string;
    level3: string;
  }
}
