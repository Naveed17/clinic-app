import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiCardContent = {
  styleOverrides: { root: { padding: 16, '&:last-child': { paddingBottom: 16 } } },
} satisfies Components<Theme>['MuiCardContent'];
