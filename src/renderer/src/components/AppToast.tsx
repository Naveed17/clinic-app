import { makeStyles, Text, tokens } from '@fluentui/react-components';
import { CheckmarkCircle24Filled, ErrorCircle24Filled } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';

export type AppToastType = 'success' | 'error';

type ToastItem = {
  id: number;
  type: AppToastType;
  message: string;
};

type ShowInput = { type: AppToastType; message: string };

let pushToast: ((input: ShowInput) => void) | null = null;
let toastSeq = 0;

export function showAppToast(input: ShowInput): void {
  const message = input.message.trim();
  if (!message) return;
  pushToast?.(input);
}

const useStyles = makeStyles({
  host: {
    position: 'fixed',
    left: '50%',
    bottom: '28px',
    transform: 'translateX(-50%)',
    zIndex: 14000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: '7px',
    paddingBottom: '7px',
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: '999px',
    boxShadow: '0 10px 32px rgba(15, 23, 42, 0.35)',
    maxWidth: 'min(92vw, 420px)',
  },
  message: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '-0.01em',
    color: '#fff',
    lineHeight: tokens.lineHeightBase300,
  },
});

export function AppToastHost(): React.JSX.Element {
  const styles = useStyles();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = ({ type, message }) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className={styles.host}>
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          {toast.type === 'success' ? (
            <CheckmarkCircle24Filled style={{ color: '#4ade80', fontSize: 18 }} />
          ) : (
            <ErrorCircle24Filled style={{ color: '#f87171', fontSize: 18 }} />
          )}
          <Text className={styles.message}>{toast.message}</Text>
        </div>
      ))}
    </div>
  );
}
