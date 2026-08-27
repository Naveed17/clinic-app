import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiInputBase = {
  styleOverrides: {
    input: ({ theme }) => ({
      '&:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? '#1b221d' : '#f9fafb'} inset !important`,
        WebkitTextFillColor: 'var(--mui-palette-text-primary) !important',
        transition: 'background-color 5000s ease-in-out 0s !important',
      },
    }),
    root: ({ theme }) => ({
      '&.Mui-readOnly, &.Mui-disabled': {
        color: `${theme.palette.text.secondary} !important`,
        WebkitTextFillColor: `${theme.palette.text.secondary} !important`,
        backgroundColor: `${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'} !important`,
      },
    }),
  },
} satisfies Components<Theme>['MuiInputBase'];
