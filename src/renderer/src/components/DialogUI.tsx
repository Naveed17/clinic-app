import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  type DialogProps,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

export const dialogPaperProps = {
  sx: {
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: (theme: { palette: { common: { black: string } } }) =>
      `0 12px 40px ${alpha(theme.palette.common.black, 0.12)}`,
  },
};

export const dialogContentSx = {
  px: 3,
  py: 2.5,
};

export const dialogActionsSx = {
  px: 3,
  py: 2,
  borderTop: '1px solid',
  borderColor: 'divider',
  gap: 1,
};

export const dialogCancelBtnSx = {
  borderRadius: 2,
  fontWeight: 700,
  px: 2,
};

export const dialogSubmitBtnSx = {
  borderRadius: 2,
  fontWeight: 700,
  px: 2.5,
};

interface FormDialogTitleProps {
  title: string;
  subtitle?: string;
}

export function FormDialogTitle({ title, subtitle }: FormDialogTitleProps): React.JSX.Element {
  return (
    <Box
      sx={{
        px: 3,
        pt: 2.75,
        pb: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  maxWidth?: DialogProps['maxWidth'];
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  error,
  onConfirm,
  onClose,
  maxWidth = 'xs',
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} PaperProps={dialogPaperProps}>
      <Box
        sx={{
          px: 3,
          pt: 2.75,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.error.main, 0.05),
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
            color: 'error.main',
            flexShrink: 0,
          }}
        >
          <WarningAmberOutlinedIcon />
        </Box>
        <Box>
          <DialogTitle sx={{ p: 0, fontWeight: 800, fontSize: 18, lineHeight: 1.3 }}>{title}</DialogTitle>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            This action cannot be undone.
          </Typography>
        </Box>
      </Box>
      <DialogContent sx={dialogContentSx}>
        {typeof message === 'string' ? <Typography>{message}</Typography> : message}
        {error}
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx}>{cancelLabel}</Button>
        <Button
          color="error"
          disabled={loading}
          onClick={onConfirm}
          variant="contained"
          sx={dialogSubmitBtnSx}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
