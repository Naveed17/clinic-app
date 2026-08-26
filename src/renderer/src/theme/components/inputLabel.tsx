import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiInputLabel = {
  styleOverrides: {
    root: {
      fontSize: '16px',
    },
    outlined: {
      transform: 'translate(14px, 11.5px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
      },
    },
    sizeSmall: {
      transform: 'translate(12px, 8px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
      },
    },
  },
} satisfies Components<Theme>['MuiInputLabel'];
