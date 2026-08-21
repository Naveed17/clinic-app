import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiTab = {
  styleOverrides: {
    root: {
      fontSize: '14px',
      fontWeight: 500,
      lineHeight: 1.71,
      minWidth: 'auto',
      textTransform: 'none',
    },
  },
} satisfies Components<Theme>['MuiTab'];
