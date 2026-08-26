import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiAutocomplete = {
  styleOverrides: {
    root: {
      '& .MuiOutlinedInput-root': {
        paddingTop: '7.5px !important',
        paddingBottom: '7.5px !important',
        paddingLeft: '8px !important',
        paddingRight: '38px !important',
        '& .MuiAutocomplete-input': {
          padding: '6px 0 !important',
          fontSize: '16px !important',
        },
      },
      '& .MuiInputLabel-outlined': {
        transform: 'translate(8px, 13.5px) scale(1)',
        '&.MuiInputLabel-shrink': {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
      },
    },
    inputRoot: {
      paddingTop: '7.5px !important',
      paddingBottom: '7.5px !important',
      paddingLeft: '8px !important',
      paddingRight: '38px !important',
      '& .MuiAutocomplete-input': {
        padding: '6px 0 !important',
        fontSize: '16px !important',
      },
    },
  },
} satisfies Components<Theme>['MuiAutocomplete'];
