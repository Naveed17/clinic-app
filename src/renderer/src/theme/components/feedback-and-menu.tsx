import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiAlert = {
  styleOverrides: {
    root: {
      borderRadius: 8,
    },
  },
} satisfies Components<Theme>['MuiAlert'];

export const MuiMenu = {
  styleOverrides: {
    paper: {
      borderRadius: 8,
    },
  },
} satisfies Components<Theme>['MuiMenu'];

export const MuiPopover = {
  styleOverrides: {
    paper: {
      borderRadius: 8,
    },
  },
} satisfies Components<Theme>['MuiPopover'];
