import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiTextField = {
  styleOverrides: {
    root: {
      backgroundColor: 'transparent',
      '& .MuiOutlinedInput-root': { borderRadius: 4 },
    },
  },
} satisfies Components<Theme>['MuiTextField'];
