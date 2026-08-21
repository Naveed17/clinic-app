import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiTable = {
  styleOverrides: {
    root: {
      '&.MuiTable-root': {
        tableLayout: 'auto',
      },
    },
  },
} satisfies Components<Theme>['MuiTable'];
