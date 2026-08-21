import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiPickersTextField = {
  styleOverrides: {
    root: { backgroundColor: 'transparent' },
  },
} satisfies Components<Theme>['MuiPickersTextField'];

export const MuiPickersOutlinedInput = {
  styleOverrides: {
    root: {
      borderRadius: 4,
      backgroundColor: 'transparent',
    },
    notchedOutline: { borderRadius: 4 },
  },
} satisfies Components<Theme>['MuiPickersOutlinedInput'];

export const MuiPickersInputBase = {
  styleOverrides: {
    root: {
      borderRadius: 4,
      alignItems: 'center',
    },
  },
} satisfies Components<Theme>['MuiPickersInputBase'];
