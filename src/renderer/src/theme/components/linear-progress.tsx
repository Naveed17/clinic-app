import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiLinearProgress = {
  styleOverrides: { root: { borderRadius: 99 } },
} satisfies Components<Theme>['MuiLinearProgress'];
