import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiOutlinedInput = {
  styleOverrides: {
    root: { borderRadius: 4 },
    notchedOutline: { borderRadius: 4 },
  },
} satisfies Components<Theme>['MuiOutlinedInput'];
