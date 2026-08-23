import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Warning24Regular } from '@fluentui/react-icons';
import type { ButtonProps } from '@fluentui/react-components';
import type { CSSProperties, ReactNode } from 'react';

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  surfaceXs: {
    maxWidth: '400px',
  },
  surfaceWide: {
    maxWidth: '720px',
  },
  titleBar: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    flexShrink: 0,
  },
  titleBarDanger: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  warnIcon: {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
    flexShrink: 0,
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  subtitle: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
});

/**
 * Legacy MUI Dialog PaperProps — kept until all dialogs use Fluent DialogSurface.
 * Compatible with MUI `PaperProps={dialogPaperProps}`.
 */
export const dialogPaperProps = {
  sx: {
    borderRadius: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '90vh',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
};

/** Legacy MUI DialogContent sx */
export const dialogContentSx = {
  px: 3,
  py: 2.5,
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
} as const;

/** Legacy MUI DialogActions sx */
export const dialogActionsSx = {
  px: 3,
  py: 2,
  borderTop: '1px solid',
  borderColor: 'divider',
  gap: 1,
  flexShrink: 0,
  bgcolor: 'background.paper',
} as const;

export const dialogFormSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
} as const;

/** Tel input inside MUI Dialog — focus quirks. */
export const telInputDialogProps = {
  disableEnforceFocus: true,
  disableRestoreFocus: true,
} as const;

export const dialogCancelBtnSx = {
  borderRadius: 2,
  fontWeight: 700,
  px: 2,
} as CSSProperties;

export const dialogSubmitBtnSx = {
  borderRadius: 2,
  fontWeight: 700,
  px: 2.5,
} as CSSProperties;

type SubmitButtonProps = ButtonProps & {
  loading?: boolean;
  /** MUI-compat alias for Fluent `icon` */
  startIcon?: ReactNode;
  /** Ignored — Fluent uses className */
  sx?: unknown;
  variant?: string;
  color?: string;
  fullWidth?: boolean;
};

/** Primary action button with loading spinner (Fluent). */
export function SubmitButton({
  loading = false,
  children,
  disabled,
  startIcon,
  icon,
  sx: _sx,
  variant: _variant,
  color: _color,
  fullWidth,
  style,
  ...rest
}: SubmitButtonProps): React.JSX.Element {
  return (
    <Button
      appearance="primary"
      disabled={disabled || loading}
      icon={loading ? <Spinner size="tiny" /> : (icon ?? (startIcon as ButtonProps['icon']))}
      style={{ width: fullWidth ? '100%' : undefined, ...style }}
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
  const styles = useStyles();
  return (
    <div className={styles.titleBar}>
      <DialogTitle as="h2">{title}</DialogTitle>
      {subtitle ? <Text className={styles.subtitle}>{subtitle}</Text> : null}
    </div>
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
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | false;
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
  const styles = useStyles();
  const wide = maxWidth === 'md' || maxWidth === 'lg';

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={`${styles.surface} ${wide ? styles.surfaceWide : styles.surfaceXs}`}>
        <div className={`${styles.titleBar} ${styles.titleBarDanger}`}>
          <div className={styles.warnIcon}>
            <Warning24Regular />
          </div>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <Text className={styles.subtitle}>This action cannot be undone.</Text>
          </div>
        </div>
        <DialogBody>
          <DialogContent className={styles.body}>
            {typeof message === 'string' ? <Text>{message}</Text> : message}
            {error}
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            appearance="primary"
            onClick={onConfirm}
            disabled={loading}
            icon={loading ? <Spinner size="tiny" /> : undefined}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
