import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiTableCell = {
  styleOverrides: {
    root: {
      borderBottom: 'var(--TableCell-borderWidth, 1px) solid var(--mui-palette-TableCell-border)',
      fontSize: 12,
    },
    head: {
      fontWeight: 700,
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--mui-palette-text-secondary)',
    },
    paddingCheckbox: { padding: '0 0 0 24px' },
  },
} satisfies Components<Theme>['MuiTableCell'];
