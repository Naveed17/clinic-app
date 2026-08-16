import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import { Box, Fade, Typography } from '@mui/material';
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

export function AppToastHost(): React.JSX.Element {
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
    <Box
      sx={{
        position: 'fixed',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        zIndex: 14000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <Fade key={toast.id} in>
          <Box
            sx={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.25,
              pr: 2,
              py: 0.85,
              bgcolor: '#111827',
              color: '#fff',
              borderRadius: 999,
              boxShadow: '0 10px 32px rgba(15, 23, 42, 0.35)',
              maxWidth: 'min(92vw, 420px)',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#4ade80' }} />
            ) : (
              <ErrorRoundedIcon sx={{ fontSize: 18, color: '#f87171' }} />
            )}
            <Typography
              sx={{
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#fff',
                lineHeight: 1.3,
              }}
            >
              {toast.message}
            </Typography>
          </Box>
        </Fade>
      ))}
    </Box>
  );
}
