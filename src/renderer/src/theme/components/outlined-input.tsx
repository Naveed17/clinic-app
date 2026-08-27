import { alpha, type Components } from '@mui/material/styles';
import type { Theme } from '../types';

export const MuiOutlinedInput = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: 8,
      backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 1.5%, ${theme.palette.mode === 'dark' ? '#1b221d' : '#f9fafb'} 98.5%)`,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: `inset 0 1px 2px ${alpha(theme.palette.primary.main, 0.015)}`,
      transition: theme.transitions?.create
        ? theme.transitions.create(['background-color', 'box-shadow', 'border-color'], {
            duration: 200,
          })
        : 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: `color-mix(in srgb, ${theme.palette.primary.main} 6%, ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} 94%)`,
        borderRadius: 8,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      '&:hover': {
        backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 2%, ${theme.palette.mode === 'dark' ? '#202823' : '#f8fafc'} 98%)`,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
        },
      },
      '&.Mui-focused': {
        backgroundColor: theme.palette.background.paper,
        boxShadow: 'none',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
          borderWidth: '1px',
        },
      },
      '&.Mui-readOnly, &.Mui-disabled, &.Mui-readOnly:hover, &.Mui-disabled:hover': {
        backgroundColor: `${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'} !important`,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: 'none',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
        },
      },
    }),
    input: {
      padding: '13.5px 8px',
      fontSize: '16px',
      height: 'auto',
    },
    inputSizeSmall: {
      padding: '8px 12px',
      fontSize: '13px',
    },
    multiline: {
      padding: '12px 8px',
    },
    notchedOutline: ({ theme }) => ({
      borderRadius: 8,
      borderColor: `color-mix(in srgb, ${theme.palette.primary.main} 6%, ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} 94%)`,
    }),
  },
} satisfies Components<Theme>['MuiOutlinedInput'];
