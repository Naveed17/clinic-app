import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiButton = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 },
    contained: { boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)' },
    sizeSmall: { padding: '6px 16px' },
    sizeMedium: { padding: '8px 20px' },
    sizeLarge: { padding: '11px 24px' },
    textSizeSmall: { padding: '7px 12px' },
    textSizeMedium: { padding: '9px 16px' },
    textSizeLarge: { padding: '12px 16px' },
  },
} satisfies Components<Theme>['MuiButton'];
