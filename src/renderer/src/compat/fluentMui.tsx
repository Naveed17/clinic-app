/**
 * Temporary Fluent-backed stand-ins for former Material UI primitives.
 * Accepts and ignores `sx` / theme props so pages can finish migrating off
 * the Material UI package without ThemeRegistry / MuiThemeProvider.
 */
import {
  Avatar as FAvatar,
  Badge as FBadge,
  Button as FButton,
  Dialog as FDialog,
  DialogActions as FDialogActions,
  DialogBody,
  DialogContent as FDialogContent,
  DialogSurface,
  Divider as FDivider,
  Input as FInput,
  Link as FLink,
  MenuItem as FMenuItem,
  MessageBar,
  MessageBarBody,
  ProgressBar as FProgressBar,
  Skeleton as FSkeleton,
  Spinner,
  Switch as FSwitch,
  Tab as FTab,
  TabList as FTabList,
  Text as FText,
  Tooltip as FTooltip,
  tokens,
} from '@fluentui/react-components';
import {
  createElement,
  forwardRef,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

type AnyProps = Record<string, unknown> & {
  sx?: unknown;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  component?: keyof React.JSX.IntrinsicElements | React.ElementType;
};

function omitMui(props: AnyProps): Record<string, unknown> {
  const {
    sx: _sx,
    variant: _v,
    color: _c,
    size: _s,
    elevation: _e,
    fullWidth,
    disableRipple: _dr,
    disableElevation: _de,
    gutterBottom: _gb,
    noWrap: _nw,
    fontWeight: _fw,
    letterSpacing: _ls,
    textAlign,
    alignItems,
    justifyContent,
    flexDirection,
    flexWrap,
    spacing: _sp,
    direction,
    gap,
    minRows: _mr,
    multiline: _ml,
    edge: _edge,
    slotProps: _slot,
    InputProps: _ip,
    inputProps: _inp,
    PaperProps: _pp,
    TransitionProps: _tp,
    ...rest
  } = props;
  const style: CSSProperties = { ...(props.style as CSSProperties | undefined) };
  if (fullWidth) style.width = '100%';
  if (typeof textAlign === 'string') style.textAlign = textAlign as CSSProperties['textAlign'];
  if (typeof alignItems === 'string') style.alignItems = alignItems as CSSProperties['alignItems'];
  if (typeof justifyContent === 'string') style.justifyContent = justifyContent as CSSProperties['justifyContent'];
  if (typeof flexDirection === 'string') style.flexDirection = flexDirection as CSSProperties['flexDirection'];
  if (typeof flexWrap === 'string') style.flexWrap = flexWrap as CSSProperties['flexWrap'];
  if (direction === 'row' || direction === 'column') style.flexDirection = direction;
  if (typeof gap === 'number') style.gap = gap * 8;
  if (Object.keys(style).length) rest.style = style;
  return rest;
}

export const Box = forwardRef<HTMLElement, AnyProps>(function Box(props, ref) {
  const { component = 'div', children, ...rest } = props;
  return createElement(component as string, { ...omitMui(rest), ref }, children as ReactNode);
});

export function Stack(props: AnyProps): React.JSX.Element {
  const { children, direction = 'column', spacing = 1, ...rest } = props;
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: (direction as CSSProperties['flexDirection']) || 'column',
    gap: typeof spacing === 'number' ? spacing * 8 : 8,
    ...(props.style as CSSProperties | undefined),
  };
  return <div {...(omitMui(rest) as HTMLAttributes<HTMLDivElement>)} style={style}>{children}</div>;
}

export function Paper(props: AnyProps): React.JSX.Element {
  const style: CSSProperties = {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    ...(props.style as CSSProperties | undefined),
  };
  return <div {...(omitMui(props) as HTMLAttributes<HTMLDivElement>)} style={style}>{props.children}</div>;
}

export function Typography(props: AnyProps & { variant?: string }): React.JSX.Element {
  const { children, variant, color, ...rest } = props;
  const style: CSSProperties = { ...(props.style as CSSProperties | undefined) };
  if (color === 'text.secondary' || color === 'text.disabled') style.color = tokens.colorNeutralForeground2;
  if (typeof color === 'string' && color.includes('.')) {
    /* ignore palette paths */
  } else if (typeof color === 'string') style.color = color;
  if (variant === 'h3' || variant === 'h4' || variant === 'h5' || variant === 'h6') {
    style.fontWeight = 700;
    style.fontSize = variant === 'h3' ? 28 : variant === 'h4' ? 24 : variant === 'h5' ? 20 : 16;
  }
  return <FText {...(omitMui(rest) as object)} style={style}>{children}</FText>;
}

export function Button({
  children,
  loading,
  startIcon,
  endIcon,
  variant,
  onClick,
  disabled,
  type,
  form,
  ...rest
}: AnyProps & {
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
}): React.JSX.Element {
  const appearance =
    variant === 'contained' ? 'primary' : variant === 'outlined' ? 'outline' : variant === 'text' ? 'transparent' : 'secondary';
  return (
    <FButton
      appearance={appearance as 'primary' | 'outline' | 'transparent' | 'secondary'}
      icon={loading ? <Spinner size="tiny" /> : ((startIcon || endIcon) as React.JSX.Element | undefined)}
      iconPosition={endIcon && !startIcon ? 'after' : 'before'}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      form={form}
      {...(omitMui(rest) as object)}
    >
      {children}
    </FButton>
  );
}

export function IconButton(props: AnyProps & { onClick?: () => void; children?: ReactNode }): React.JSX.Element {
  return (
    <FButton appearance="subtle" icon={props.children as React.JSX.Element} onClick={props.onClick as () => void} disabled={props.disabled as boolean | undefined} />
  );
}

export function Chip({ label, children, color, ...rest }: AnyProps & { label?: ReactNode; color?: string }): React.JSX.Element {
  const map: Record<string, 'brand' | 'success' | 'warning' | 'danger' | 'informative' | 'important'> = {
    primary: 'brand',
    success: 'success',
    warning: 'warning',
    error: 'danger',
    info: 'informative',
    default: 'informative',
    secondary: 'important',
  };
  return (
    <FBadge appearance="tint" color={map[color ?? ''] ?? 'informative'} {...(omitMui(rest) as object)}>
      {label ?? children}
    </FBadge>
  );
}

export function Avatar(props: AnyProps & { src?: string; alt?: string; children?: ReactNode }): React.JSX.Element {
  return (
    <FAvatar
      image={props.src ? { src: props.src } : undefined}
      name={typeof props.children === 'string' ? props.children : props.alt}
      style={props.style as CSSProperties}
    />
  );
}

export function Divider(props: AnyProps): React.JSX.Element {
  return <FDivider {...(omitMui(props) as object)} />;
}

export function Link(props: AnyProps & { href?: string; onClick?: () => void }): React.JSX.Element {
  return <FLink href={props.href} onClick={props.onClick}>{props.children}</FLink>;
}

export function Skeleton(props: AnyProps & { height?: number | string; width?: number | string }): React.JSX.Element {
  return <FSkeleton style={{ height: props.height ?? 24, width: props.width ?? '100%', borderRadius: 4, ...(props.style as CSSProperties) }} />;
}

export function LinearProgress(props: AnyProps & { value?: number; variant?: string }): React.JSX.Element {
  if (props.variant === 'indeterminate' || props.value == null) {
    return <FProgressBar />;
  }
  return <FProgressBar value={Math.min(1, Math.max(0, (props.value ?? 0) / 100))} />;
}

export function CircularProgress(props: AnyProps & { value?: number; size?: number }): React.JSX.Element {
  return <Spinner size="medium" style={{ width: props.size, height: props.size }} />;
}

export function Alert({ children, severity, onClose }: AnyProps & { severity?: string; onClose?: () => void }): React.JSX.Element {
  const intent = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : severity === 'success' ? 'success' : 'info';
  return (
    <MessageBar intent={intent as 'error' | 'warning' | 'success' | 'info'}>
      <MessageBarBody>{children}</MessageBarBody>
      {onClose ? <Button appearance="transparent" onClick={onClose}>Dismiss</Button> : null}
    </MessageBar>
  );
}

export function TextField({
  label,
  value,
  onChange,
  helperText,
  error,
  type,
  select,
  children,
  ...rest
}: AnyProps & {
  label?: string;
  value?: unknown;
  onChange?: (e: { target: { value: string } }) => void;
  helperText?: ReactNode;
  error?: boolean;
  type?: string;
  select?: boolean;
}): React.JSX.Element {
  if (select) {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label ? <span>{label}</span> : null}
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
          style={{ padding: 8, borderRadius: 4 }}
        >
          {children}
        </select>
        {helperText ? <span style={{ fontSize: 12, color: error ? tokens.colorPaletteRedForeground1 : tokens.colorNeutralForeground3 }}>{helperText}</span> : null}
      </label>
    );
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {label ? <span>{label}</span> : null}
      <FInput
        type={type as 'text' | 'number' | 'password' | 'email' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'month' | 'week' | 'datetime-local' | undefined}
        value={value == null ? undefined : String(value)}
        onChange={(_, d) => onChange?.({ target: { value: d.value } })}
        {...(omitMui(rest) as object)}
      />
      {helperText ? <span style={{ fontSize: 12, color: error ? tokens.colorPaletteRedForeground1 : tokens.colorNeutralForeground3 }}>{helperText}</span> : null}
    </label>
  );
}

export function Switch(props: AnyProps & { checked?: boolean; onChange?: (e: unknown, checked?: boolean) => void }): React.JSX.Element {
  return (
    <FSwitch
      checked={Boolean(props.checked)}
      onChange={(_, d) => props.onChange?.(null, d.checked)}
      disabled={props.disabled as boolean | undefined}
    />
  );
}

export function FormControlLabel({ control, label }: { control: ReactNode; label: ReactNode }): React.JSX.Element {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{control}{label}</label>;
}

export function FormControl({ children, ...rest }: AnyProps): React.JSX.Element {
  return <div {...(omitMui(rest) as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
}

export function InputLabel({ children }: { children?: ReactNode }): React.JSX.Element {
  return <span style={{ fontSize: 12, fontWeight: 600 }}>{children}</span>;
}

export function Select({
  value,
  onChange,
  children,
  label,
  renderValue: _rv,
}: AnyProps & {
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  label?: string;
  renderValue?: (value: unknown) => ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
      {label ? <InputLabel>{label}</InputLabel> : null}
      <select value={value == null ? '' : String(value)} onChange={(e) => onChange?.({ target: { value: e.target.value } })} style={{ padding: 8, borderRadius: 4 }}>
        {children}
      </select>
    </label>
  );
}

export function MenuItem({ value, children, onClick, selected, dense: _d, disabled }: AnyProps & { value?: string | number; onClick?: () => void; selected?: boolean; dense?: boolean; disabled?: boolean }): React.JSX.Element {
  if (onClick) {
    return (
      <FMenuItem disabled={disabled} onClick={onClick}>
        {children}
      </FMenuItem>
    );
  }
  return <option value={value == null ? undefined : String(value)} disabled={disabled}>{children}</option>;
}

export function Dialog({
  open,
  onClose,
  children,
  fullWidth: _fw,
  maxWidth: _mw,
  ...rest
}: AnyProps & { open: boolean; onClose?: () => void }): React.JSX.Element {
  return (
    <FDialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose?.(); }}>
      <DialogSurface style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }} {...(omitMui(rest) as object)}>
        {children}
      </DialogSurface>
    </FDialog>
  );
}

export function DialogContent({ children, ...rest }: AnyProps): React.JSX.Element {
  return (
    <DialogBody>
      <FDialogContent style={{ padding: 16 }} {...(omitMui(rest) as object)}>{children}</FDialogContent>
    </DialogBody>
  );
}

export function DialogActions({ children, ...rest }: AnyProps): React.JSX.Element {
  return <FDialogActions style={{ padding: 12, gap: 8 }} {...(omitMui(rest) as object)}>{children}</FDialogActions>;
}

export function Tabs({
  value,
  onChange,
  children,
  sx: _sx,
}: {
  value: string | number;
  onChange?: (e: unknown, v: string | number) => void;
  children?: ReactNode;
  sx?: unknown;
}): React.JSX.Element {
  return (
    <FTabList
      selectedValue={String(value)}
      onTabSelect={(_, d) => onChange?.(null, d.value as string)}
    >
      {children}
    </FTabList>
  );
}

export function Tab({
  value,
  label,
  icon,
  children,
  ...rest
}: AnyProps & { value?: string; label?: ReactNode; icon?: ReactNode; iconPosition?: string }): React.JSX.Element {
  return (
    <FTab value={String(value ?? '')} icon={icon as React.JSX.Element} {...(omitMui(rest) as object)}>
      {label ?? children}
    </FTab>
  );
}

export function Tooltip({ title, children }: { title?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <FTooltip content={String(title ?? '')} relationship="label">
      {children as React.JSX.Element}
    </FTooltip>
  );
}

export function Snackbar({
  open,
  children,
  onClose: _onClose,
}: AnyProps & { open?: boolean; autoHideDuration?: number; anchorOrigin?: unknown; onClose?: () => void }): React.JSX.Element | null {
  if (!open) return null;
  return <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 2000 }}>{children}</div>;
}

export function ToggleButtonGroup({
  value,
  onChange,
  children,
  sx: _sx,
  style,
  exclusive: _ex,
  size: _size,
}: {
  value?: string;
  exclusive?: boolean;
  size?: string;
  sx?: unknown;
  style?: CSSProperties;
  onChange?: (e: unknown, v: string | null) => void;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', ...style }} data-value={value} onClick={(e) => {
      const t = (e.target as HTMLElement).closest('[data-toggle-value]') as HTMLElement | null;
      if (t) onChange?.(e, t.dataset.toggleValue ?? null);
    }}>
      {children}
    </div>
  );
}

export function ToggleButton({
  value,
  children,
  selected,
}: AnyProps & { value?: string; selected?: boolean }): React.JSX.Element {
  return (
    <FButton appearance={selected ? 'primary' : 'outline'} data-toggle-value={value}>
      {children}
    </FButton>
  );
}

export function Stepper({
  activeStep = 0,
  children,
  sx: _sx,
  style,
}: {
  activeStep?: number;
  children?: ReactNode;
  sx?: unknown;
  style?: CSSProperties;
}): React.JSX.Element {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, ...style }}>
      {items.map((child, i) => (
        <div key={i} style={{ opacity: i === activeStep ? 1 : 0.5, fontWeight: i === activeStep ? 700 : 400 }}>{child}</div>
      ))}
    </div>
  );
}

export function Step({ children }: { children?: ReactNode }): React.JSX.Element {
  return <div>{children}</div>;
}

export function StepLabel({ children }: { children?: ReactNode }): React.JSX.Element {
  return <span>{children}</span>;
}

export function Autocomplete<T>({
  options = [],
  value,
  onChange,
  getOptionLabel,
  renderInput,
  renderOption,
  isOptionEqualToValue,
  disabled,
}: {
  options?: T[];
  value?: T | null;
  onChange?: (e: unknown, v: T | null) => void;
  getOptionLabel?: (o: T) => string;
  renderInput?: (params: { label?: string }) => ReactNode;
  renderOption?: (props: object, option: T) => ReactNode;
  isOptionEqualToValue?: (a: T, b: T) => boolean;
  disabled?: boolean;
}): React.JSX.Element {
  const label = getOptionLabel && value ? getOptionLabel(value) : '';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {renderInput?.({ label: 'Search' })}
      <select
        disabled={disabled}
        value={value ? options.findIndex((o) => (isOptionEqualToValue ? isOptionEqualToValue(o, value) : o === value)) : -1}
        onChange={(e) => {
          const idx = Number(e.target.value);
          onChange?.(null, idx >= 0 ? options[idx] : null);
        }}
        style={{ padding: 8, borderRadius: 4 }}
      >
        <option value={-1}>{label || '—'}</option>
        {options.map((o, i) => (
          <option key={i} value={i}>{getOptionLabel?.(o) ?? String(o)}</option>
        ))}
      </select>
    </label>
  );
}

export function Menu({
  open,
  onClose,
  anchorEl,
  children,
  anchorReference,
  anchorPosition,
}: AnyProps & {
  open?: boolean;
  onClose?: () => void;
  anchorEl?: HTMLElement | null;
  anchorReference?: string;
  anchorPosition?: { top: number; left: number };
}): React.JSX.Element | null {
  if (!open) return null;
  const top = anchorPosition?.top ?? (anchorEl ? anchorEl.getBoundingClientRect().bottom : 0);
  const left = anchorPosition?.left ?? (anchorEl ? anchorEl.getBoundingClientRect().left : 0);
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1400 }}
      onClick={() => onClose?.()}
      onContextMenu={(e) => { e.preventDefault(); onClose?.(); }}
    >
      <div
        style={{
          position: 'fixed',
          top,
          left,
          background: tokens.colorNeutralBackground1,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: 8,
          boxShadow: tokens.shadow16,
          minWidth: 180,
          padding: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ListItemIcon({ children }: { children?: ReactNode }): React.JSX.Element {
  return <span style={{ display: 'inline-flex', marginRight: 8 }}>{children}</span>;
}

export function ListItemText({
  primary,
  secondary,
  children,
  primaryTypographyProps: _p,
}: {
  primary?: ReactNode;
  secondary?: ReactNode;
  children?: ReactNode;
  primaryTypographyProps?: unknown;
}): React.JSX.Element {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span>{primary ?? children}</span>
      {secondary ? (
        <span style={{ fontSize: 12, color: tokens.colorNeutralForeground2 }}>{secondary}</span>
      ) : null}
    </span>
  );
}

export function List({
  children,
  dense: _d,
  disablePadding: _dp,
  ...rest
}: AnyProps & { dense?: boolean; disablePadding?: boolean }): React.JSX.Element {
  return (
    <ul
      {...(omitMui(rest) as HTMLAttributes<HTMLUListElement>)}
      style={{ listStyle: 'none', margin: 0, padding: 0, ...(rest.style as CSSProperties | undefined) }}
    >
      {children}
    </ul>
  );
}

export function ListItem({
  children,
  secondaryAction,
  ...rest
}: AnyProps & { secondaryAction?: ReactNode }): React.JSX.Element {
  return (
    <li
      {...(omitMui(rest) as HTMLAttributes<HTMLLIElement>)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 0',
        ...(rest.style as CSSProperties | undefined),
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
      {secondaryAction}
    </li>
  );
}

export function InputAdornment({
  children,
  position: _p,
}: {
  children?: ReactNode;
  position?: 'start' | 'end';
}): React.JSX.Element {
  return <span style={{ display: 'inline-flex', alignItems: 'center', marginInline: 4 }}>{children}</span>;
}

export function ButtonGroup({ children, ...rest }: AnyProps): React.JSX.Element {
  return (
    <div
      {...(omitMui(rest) as HTMLAttributes<HTMLDivElement>)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...(rest.style as CSSProperties | undefined),
      }}
    >
      {children}
    </div>
  );
}

export function Fade({
  children,
  in: _in,
  timeout: _t,
  ..._rest
}: AnyProps & { in?: boolean; timeout?: number }): React.JSX.Element {
  return <>{children}</>;
}

export function Popper({
  open,
  anchorEl,
  children,
  placement: _placement,
  transition: _transition,
  modifiers: _modifiers,
  ...rest
}: AnyProps & {
  open?: boolean;
  anchorEl?: HTMLElement | null;
  placement?: string;
  transition?: boolean;
  modifiers?: unknown[];
  children?: ReactNode | ((props: { TransitionProps: Record<string, unknown> }) => ReactNode);
}): React.JSX.Element | null {
  if (!open || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const content =
    typeof children === 'function' ? children({ TransitionProps: { in: true } }) : children;
  return (
    <div
      {...(omitMui(rest) as HTMLAttributes<HTMLDivElement>)}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 320),
        zIndex: 1400,
        ...(rest.style as CSSProperties | undefined),
      }}
    >
      {content}
    </div>
  );
}

export function useTheme() {
  return useMemo(
    () => ({
      palette: {
        mode: 'light' as 'light' | 'dark',
        primary: { main: tokens.colorBrandForeground1, dark: tokens.colorBrandForeground1, light: tokens.colorBrandBackground2, contrastText: '#fff' },
        secondary: { main: '#8764b8', dark: '#5c2d91', light: '#b4a0d4' },
        success: { main: '#107c10', dark: '#0b5a0b', light: '#dff6dd' },
        warning: { main: '#f7630c', dark: '#8a3707', light: '#fff4ce' },
        error: { main: '#d13438', dark: '#a4262c', light: '#fde7e9' },
        info: { main: '#0078d4', dark: '#004578', light: '#c7e0f4' },
        text: { primary: tokens.colorNeutralForeground1, secondary: tokens.colorNeutralForeground2, disabled: tokens.colorNeutralForeground3 },
        background: { paper: tokens.colorNeutralBackground1, default: tokens.colorNeutralBackground2 },
        divider: tokens.colorNeutralStroke2,
        action: { hover: tokens.colorNeutralBackground1Hover, active: tokens.colorNeutralForeground3 },
        common: { white: '#fff', black: '#000' },
        grey: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
      typography: {
        fontFamily: tokens.fontFamilyBase,
      },
      shadows: Array.from({ length: 25 }, () => tokens.shadow4),
    }),
    [],
  );
}

export function alpha(color: string, opacity: number): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color;
}

export function darken(color: string, _amount: number): string {
  return color;
}

export default {
  Box,
  Stack,
  Paper,
  Typography,
  Button,
};
