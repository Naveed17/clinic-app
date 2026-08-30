import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiCheckbox: Components<Theme>['MuiCheckbox'] = {
  styleOverrides: {
    root: {
      padding: '3px',
    },
  },
};
