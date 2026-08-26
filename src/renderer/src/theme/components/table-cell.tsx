import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiTableCell = {
  styleOverrides: {
    root: {
      borderBottom: 'var(--TableCell-borderWidth, 1px) solid var(--mui-palette-TableCell-border)',
      fontSize: '13.5px',
      color: 'var(--mui-palette-text-primary)',
    },
    body: {
      fontSize: '13.5px',
      color: 'var(--mui-palette-text-primary)',
    },
    head: {
      fontWeight: 800,
      fontSize: '10.5px',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--mui-palette-primary-dark, #15803d)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backgroundColor: 'rgba(236, 253, 243, 0.70)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1.5px solid rgba(22, 163, 74, 0.2)',
    },
    paddingCheckbox: { padding: '0 0 0 24px' },
  },
} satisfies Components<Theme>['MuiTableCell'];
