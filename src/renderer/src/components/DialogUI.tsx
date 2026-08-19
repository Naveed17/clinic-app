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
import type { ComponentProps, ReactNode } from 'react';

/** Paper: column layout, capped height — body scrolls, chrome stays put */
export const dialogPaperProps = {
  sx: {
    borderRadius: '20px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    boxShadow: (theme: { palette: { common: { black: string } } }) =>
      `0 12px 40px ${alpha(theme.palette.common.black, 0.12)}`,
  },
};

/** Scrollable body */
export const dialogContentSx = {
  px: 3,
  py: 2.5,
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
};

/** Sticky footer actions */
export const dialogActionsSx = {
  px: 3,
  py: 2,
  borderTop: '1px solid',
  borderColor: 'divider',
  gap: 1,
  flexShrink: 0,
  bgcolor: 'background.paper',
};

/** Wrap DialogContent + DialogActions when using <Box component="form"> */
export const dialogFormSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
} as const;

/** MuiTelInput / country menu inside Dialog — without this, digits often cannot be typed. */
export const telInputDialogProps: Pick<DialogProps, 'disableEnforceFocus' | 'disableRestoreFocus'> = {
  disableEnforceFocus: true,
  disableRestoreFocus: true,
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

/** Primary dialog/page action button — shows MUI loading spinner during API calls. */
export function SubmitButton({
  loading = false,
  children,
  disabled,
  sx,
  ...rest
}: ComponentProps<typeof Button> & { loading?: boolean }): React.JSX.Element {
  return (
    <Button
      variant="contained"
      loading={loading}
      disabled={disabled || loading}
      sx={{ ...dialogSubmitBtnSx, ...((sx as object) || {}) }}
      {...rest}
    >
      {children}
    </Button>
  );
}

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
        flexShrink: 0,
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
          flexShrink: 0,
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
        <Button onClick={onClose} disabled={loading} sx={dialogCancelBtnSx}>{cancelLabel}</Button>
        <Button
          color="error"
          loading={loading}
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
