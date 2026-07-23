import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';

interface ToastItem {
  id: string;
  kind: RealtimeNotification['kind'];
  entity?: string;
  title: string;
  message: string;
  createdAt: string;
}

const kindColor: Record<RealtimeNotification['kind'], string> = {
  success: '#2e7d32',
  info:    '#0288d1',
  warning: '#ed6c02',
  error:   '#d32f2f',
};

function ToastIcon({ entity, kind }: { entity?: string; kind: RealtimeNotification['kind'] }): React.JSX.Element {
  const color = kindColor[kind];
  const sx = { fontSize: 20, color };

  if (entity === 'appointment') return <CalendarMonthOutlinedIcon sx={sx} />;
  if (entity === 'patient')     return <PersonOutlinedIcon sx={sx} />;
  if (entity === 'token')       return <ConfirmationNumberOutlinedIcon sx={sx} />;
  if (kind === 'success')       return <CheckCircleOutlineIcon sx={sx} />;
  if (kind === 'warning')       return <WarningAmberOutlinedIcon sx={sx} />;
  if (kind === 'error')         return <ErrorOutlineIcon sx={sx} />;
  return <InfoOutlinedIcon sx={sx} />;
}

export function AppointmentToast(): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = realtimeService.onNotification((n: RealtimeNotification) => {
      const entity = n.payload?.entity as string | undefined;
      setToasts((prev) => [...prev, { id: n.id, kind: n.kind, entity, title: n.title, message: n.message, createdAt: n.createdAt }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000);
    });
    return unsubscribe;
  }, []);

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {toasts.map((toast) => (
        <Collapse key={toast.id} in unmountOnExit>
          <Paper
            elevation={4}
            sx={{ width: 320, p: 1.75, borderLeft: '4px solid', borderColor: kindColor[toast.kind], borderRadius: 2 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ mt: 0.2, flexShrink: 0 }}>
                <ToastIcon entity={toast.entity} kind={toast.kind} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700}>{toast.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{toast.message}</Typography>
                <Typography variant="caption" color="text.disabled">
                  {new Date(toast.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <IconButton size="small" sx={{ mt: -0.5, mr: -0.5 }} onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          </Paper>
        </Collapse>
      ))}
    </Box>
  );
}
