import type { Components } from '@mui/material/styles';
import { tableCellClasses } from '@mui/material/TableCell';
import { tableRowClasses } from '@mui/material/TableRow';
import type { Theme } from '../types';

export const MuiTableBody = {
  styleOverrides: {
    root: {
      [`& .${tableRowClasses.root}:last-child`]: { [`& .${tableCellClasses.root}`]: { '--TableCell-borderWidth': 0 } },
      '.MuiTableCell-root': {
        padding: '8px 16px',
      },
    },
  },
} satisfies Components<Theme>['MuiTableBody'];
