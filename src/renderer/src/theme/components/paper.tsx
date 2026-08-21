import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiPaper = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: {
      backgroundImage: 'none',
      borderRadius: 16,
      border: '1px solid var(--mui-palette-divider)',
    },
  },
} satisfies Components<Theme>['MuiPaper'];
