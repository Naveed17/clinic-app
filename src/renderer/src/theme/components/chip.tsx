import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiChip = {
  styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
} satisfies Components<Theme>['MuiChip'];
