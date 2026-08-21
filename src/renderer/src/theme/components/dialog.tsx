import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiDialog = {
  styleOverrides: { paper: { borderRadius: 8 } },
} satisfies Components<Theme>['MuiDialog'];
