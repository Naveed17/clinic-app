import type { TypographyVariantsOptions } from '@mui/material/styles';

export function pxToRem(value: number): string {
  return `${value / 16}rem`;
}

export const typography: TypographyVariantsOptions = {
  fontFamily: '"Plus Jakarta Sans", Inter, "Segoe UI", Arial, sans-serif',
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 600,
  fontWeightBold: 700,
  fontSize: 14,
  htmlFontSize: 16,
  body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
  body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.57 },
  button: { fontWeight: 600, textTransform: 'none' },
  caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.66 },
  subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.57 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.57 },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.5px',
    lineHeight: 2.5,
    textTransform: 'uppercase',
  },
  h1: { fontSize: '3.5rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h2: { fontSize: '3rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h3: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h4: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h5: { fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h6: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
};
