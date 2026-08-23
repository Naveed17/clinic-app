import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import {
  BiotechOutlinedIcon,
  CalendarMonthOutlinedIcon,
  CheckCircleOutlineIcon,
  CloseIcon,
  ConfirmationNumberOutlinedIcon,
  ErrorOutlineIcon,
  InfoOutlinedIcon,
  MedicalServicesOutlinedIcon,
  PersonOutlinedIcon,
  WarningAmberOutlinedIcon,
} from '@/icons/fluent';

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
  info: '#0288d1',
  warning: '#ed6c02',
  error: '#d32f2f',
};

const useStyles = makeStyles({
  stack: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  paper: {
    width: '380px',
    padding: tokens.spacingVerticalL,
    borderLeft: '4px solid',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },
  iconWrap: {
    marginTop: '2px',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
  },
  time: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
});

function ToastIcon({ entity, kind }: { entity?: string; kind: RealtimeNotification['kind'] }): React.JSX.Element {
  const color = kindColor[kind];
  const style = { fontSize: 20, color };

  if (entity === 'appointment') return <CalendarMonthOutlinedIcon style={style} />;
  if (entity === 'patient') return <PersonOutlinedIcon style={style} />;
  if (entity === 'token') return <ConfirmationNumberOutlinedIcon style={style} />;
  if (entity === 'prescription') return <MedicalServicesOutlinedIcon style={style} />;
  if (entity === 'lab') return <BiotechOutlinedIcon style={style} />;
  if (kind === 'success') return <CheckCircleOutlineIcon style={style} />;
  if (kind === 'warning') return <WarningAmberOutlinedIcon style={style} />;
  if (kind === 'error') return <ErrorOutlineIcon style={style} />;
  return <InfoOutlinedIcon style={style} />;
}

function playNotificationSound(): void {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
  osc.onended = () => ctx.close();
}

/** Doctors only see queue-relevant alerts (their tokens / patients / appointments). */
function shouldShowNotification(
  n: RealtimeNotification,
  role?: string,
  userId?: string,
): boolean {
  const entity = n.payload?.entity as string | undefined;
  if (role !== 'doctor') return true;

  if (entity === 'patient') return true;
  if (entity === 'token') {
    const doctorId = n.payload?.doctorId as string | undefined;
    return !doctorId || doctorId === userId;
  }
  if (entity === 'appointment') {
    const providerId = n.payload?.providerId as string | undefined;
    return !providerId || providerId === userId;
  }
  if (entity === 'lab') {
    const orderedById = n.payload?.orderedById as string | undefined;
    return !orderedById || orderedById === userId;
  }
  if (entity === 'invoice' || entity === 'medicine' || entity === 'inventory-batch') return false;
  return true;
}

export function AppointmentToast(): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = realtimeService.onNotification((n: RealtimeNotification) => {
      if (!shouldShowNotification(n, user?.role, user?.id)) return;
      const entity = n.payload?.entity as string | undefined;
      setToasts((prev) => [
        ...prev,
        { id: n.id, kind: n.kind, entity, title: n.title, message: n.message, createdAt: n.createdAt },
      ]);
      playNotificationSound();
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000);
    });
    return unsubscribe;
  }, [user?.id, user?.role]);

  return (
    <div className={styles.stack}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={styles.paper}
          style={{ borderLeftColor: kindColor[toast.kind] }}
        >
          <div className={styles.row}>
            <div className={styles.iconWrap}>
              <ToastIcon entity={toast.entity} kind={toast.kind} />
            </div>
            <div className={styles.body}>
              <Text weight="semibold">{toast.title}</Text>
              <Text className={styles.message} size={200} block>
                {toast.message}
              </Text>
              <Text className={styles.time}>
                {new Date(toast.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<CloseIcon style={{ fontSize: 16 }} />}
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
