import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiInputBase = {
  styleOverrides: {
    input: {
      '&:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 1000px var(--mui-palette-background-paper) inset !important',
        WebkitTextFillColor: 'var(--mui-palette-text-primary) !important',
        transition: 'background-color 5000s ease-in-out 0s !important',
      },
    },
    root: {
      '&.Mui-readOnly': {
        color: 'var(--mui-palette-text-secondary) !important',
        WebkitTextFillColor: 'var(--mui-palette-text-secondary) !important',
        backgroundColor: 'var(--mui-palette-background-level1) !important',
      },
    },
  },
} satisfies Components<Theme>['MuiInputBase'];
