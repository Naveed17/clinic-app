import {
  Avatar,
  Badge,
  Button,
  Skeleton,
  Spinner,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { LiveClock } from '@/components/LiveClock';
import type { LabOrder, LabOrderStatus } from '@/types/lab';
import { LabReportBuilderDialog } from '@/features/lab/LabReportBuilderDialog';
import { BiotechOutlinedIcon, CheckCircleOutlineIcon, ConfirmationNumberOutlinedIcon, PendingOutlinedIcon, ScienceOutlinedIcon } from '@/icons/fluent';

const statusColor: Record<LabOrderStatus, 'warning' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const statusLabel: Record<LabOrderStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const PALETTE = {
  warning: '#f7630c',
  brand: tokens.colorBrandForeground1,
  success: '#107c10',
  info: '#0078d4',
  secondary: '#8764b8',
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function waitMinutes(fromIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60_000));
}

const useStyles = makeStyles({
  header: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: tokens.spacingVerticalL, gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightSemibold },
  grid: { display: 'grid', gap: tokens.spacingVerticalL, gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' },
  col: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, minWidth: 0 },
  hero: {
    padding: tokens.spacingVerticalXXL,
    borderRadius: '28px',
    background: `linear-gradient(135deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 55%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    position: 'relative',
    overflow: 'hidden',
    minHeight: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    boxShadow: tokens.shadow16,
  },
  heroActions: { display: 'flex', flexDirection: 'row', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalL, flexWrap: 'wrap' },
  stats: { display: 'grid', gap: tokens.spacingVerticalM, gridTemplateColumns: 'repeat(3, 1fr)' },
  softCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  orderList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, maxHeight: '420px', overflowY: 'auto' },
  orderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
  },
  sideCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: '24px',
    background: `linear-gradient(160deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 100%)`,
    color: '#fff',
    boxShadow: tokens.shadow16,
  },
  rings: { display: 'flex', flexDirection: 'row', gap: tokens.spacingHorizontalS },
  ringCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: tokens.spacingVerticalXS },
  miniGrid: { display: 'grid', gap: tokens.spacingVerticalM, gridTemplateColumns: '1fr 1fr' },
  miniCard: {
    padding: tokens.spacingVerticalM,
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '88px',
  },
});

function StatusRing({ label, value, total, color }: { label: string; value: number; total: number; color: string }): React.JSX.Element {
  const styles = useStyles();
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className={styles.ringCol}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
          <circle
            cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 176} 176`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>{value}</div>
      </div>
      <Text size={200} style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{label}</Text>
    </div>
  );
}

export function LabDashboard(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [builderOrder, setBuilderOrder] = useState<LabOrder | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: orders = [], isPending, isError, error } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list(),
    refetchInterval: 15_000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => window.clinic.lab.updateStatus(id, 'IN_PROGRESS'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-orders'] }),
    meta: { toast: 'Sample started', errorToast: 'Could not start sample.' },
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todaysOrders = useMemo(
    () => orders.filter((o) => o.status !== 'CANCELLED' && sameDay(new Date(o.orderedAt), today)).sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()),
    [orders, today],
  );

  const queue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'PENDING' || o.status === 'IN_PROGRESS')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'IN_PROGRESS' ? -1 : 1;
          return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime();
        }),
    [orders],
  );
  const currentOrder = queue[0] ?? null;
  const waitingCount = queue.filter((o) => o.id !== currentOrder?.id).length;
  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const completedToday = todaysOrders.filter((o) => o.status === 'COMPLETED').length;
  const openQueue = pending + inProgress;
  const started = currentOrder?.status === 'IN_PROGRESS';

  return (
    <>
      <div className={styles.header}>
        <div>
          <Text className={styles.muted}>Hi {user?.name || 'Lab Technician'},</Text>
          <Title2 style={{ letterSpacing: '-0.02em', marginTop: 2 }}>Welcome Back!</Title2>
        </div>
        <LiveClock />
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.hero}>
            <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
              <Text size={200} weight="bold" style={{ opacity: 0.88, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Now Serving</Text>
              {isPending ? (
                <>
                  <Skeleton style={{ width: 260, height: 52, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.28)' }} />
                  <Skeleton style={{ width: 180, height: 24, backgroundColor: 'rgba(255,255,255,0.18)' }} />
                </>
              ) : currentOrder ? (
                <>
                  <Title2
                    style={{ letterSpacing: '-0.02em', marginTop: 8, marginBottom: 4, lineHeight: 1.2, cursor: 'pointer' }}
                    onClick={() => navigate(`/lab/${currentOrder.id}`)}
                  >
                    {currentOrder.tokenNumber != null ? `#${String(currentOrder.tokenNumber).padStart(3, '0')} ` : ''}
                    {currentOrder.patientName}
                  </Title2>
                  <Text>
                    {currentOrder.test}
                    {currentOrder.orderedByName ? ` · ${currentOrder.orderedByName}` : ''}
                    {waitingCount > 0 ? ` · ${waitingCount} waiting` : ''}
                  </Text>
                  <div className={styles.heroActions}>
                    <Button
                      appearance={started ? 'outline' : 'primary'}
                      disabled={started || startMutation.isPending}
                      icon={startMutation.isPending ? <Spinner size="tiny" /> : undefined}
                      onClick={() => startMutation.mutate(currentOrder.id)}
                      style={started ? { borderColor: 'rgba(255,255,255,0.5)', color: '#fff' } : { backgroundColor: '#fff', color: tokens.colorBrandForeground1 }}
                    >
                      {started ? 'In progress' : 'Start sample'}
                    </Button>
                    <Button
                      appearance={started ? 'primary' : 'outline'}
                      disabled={!started}
                      onClick={() => setBuilderOrder(currentOrder)}
                      style={started ? { backgroundColor: '#fff', color: tokens.colorBrandForeground1 } : { borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}
                    >
                      Build report
                    </Button>
                    <Button appearance="outline" onClick={() => navigate(`/lab/${currentOrder.id}`)} style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}>
                      Open details
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Title2 style={{ letterSpacing: '-0.02em', marginTop: 8, marginBottom: 8 }}>No samples waiting</Title2>
                  <Text>Pending and in-progress orders appear here live, same as the waiting room queue.</Text>
                  <Button appearance="primary" onClick={() => navigate('/lab')} style={{ marginTop: 18, backgroundColor: '#fff', color: tokens.colorBrandForeground1 }}>
                    Open Lab
                  </Button>
                </>
              )}
            </div>
            {currentOrder && (
              <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
                <Text size={200} weight="bold" style={{ opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Waiting</Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <Title2>{waitMinutes(currentOrder.orderedAt, nowMs)}</Title2>
                  <Text>min</Text>
                </div>
              </div>
            )}
          </div>

          {isPending ? (
            <StatCardsSkeleton count={3} />
          ) : (
            <div className={styles.stats}>
              {[
                { label: 'Pending Orders', value: pending, icon: <PendingOutlinedIcon />, color: PALETTE.warning, bg: 'rgba(247,99,12,0.12)' },
                { label: 'In Progress', value: inProgress, icon: <BiotechOutlinedIcon />, color: PALETTE.brand, bg: tokens.colorBrandBackground2 },
                { label: 'Completed Today', value: completedToday, icon: <CheckCircleOutlineIcon />, color: PALETTE.success, bg: 'rgba(16,124,16,0.12)' },
              ].map((c) => (
                <div key={c.label} className={styles.softCard} style={{ backgroundColor: c.bg, border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
                      <Text size={200} weight="bold" className={styles.muted} style={{ marginTop: 6, display: 'block' }}>{c.label}</Text>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', backgroundColor: 'rgba(0,0,0,0.06)', color: c.color }}>
                      {c.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.softCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Text weight="bold" style={{ fontSize: 16 }}>Today&apos;s Lab Orders</Text>
                <Text size={200} className={styles.muted} style={{ display: 'block' }}>
                  {today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
              </div>
              <Button appearance="transparent" size="small" onClick={() => navigate('/lab')}>View all</Button>
            </div>
            {isError ? (
              <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error instanceof Error ? error.message : 'Unable to load lab orders.'}</Text>
            ) : isPending ? (
              <ListCardsSkeleton count={5} />
            ) : todaysOrders.length === 0 ? (
              <div style={{ display: 'grid', minHeight: 120, placeItems: 'center' }}>
                <Text className={styles.muted}>No lab orders for today.</Text>
              </div>
            ) : (
              <div className={styles.orderList}>
                {todaysOrders.map((order) => (
                  <div
                    key={order.id}
                    className={styles.orderRow}
                    style={{ borderLeftColor: statusColor[order.status] === 'brand' ? tokens.colorBrandStroke1 : undefined }}
                    onClick={() => navigate(`/lab/${order.id}`)}
                  >
                    <Avatar name={order.patientName} color="brand" style={{ width: 42, height: 42, borderRadius: 8, fontWeight: 800, fontSize: 13 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text weight="bold" truncate>{order.patientName}</Text>
                        {order.tokenNumber != null && (
                          <Badge appearance="outline" icon={<ConfirmationNumberOutlinedIcon style={{ fontSize: 14 }} />}>
                            #{String(order.tokenNumber).padStart(3, '0')}
                          </Badge>
                        )}
                      </div>
                      <Text size={200} className={styles.muted} style={{ display: 'block' }}>
                        {order.test} · {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {order.orderedByName ? ` · ${order.orderedByName}` : ''}
                      </Text>
                    </div>
                    <Badge appearance="tint" color={statusColor[order.status]}>{statusLabel[order.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.sideCard}>
            <Text weight="bold" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16, display: 'block', fontSize: 16 }}>Today&apos;s status</Text>
            <div className={styles.rings}>
              <StatusRing label="Pending" value={todaysOrders.filter((o) => o.status === 'PENDING').length} total={todaysOrders.length || 1} color="#ffb900" />
              <StatusRing label="In lab" value={todaysOrders.filter((o) => o.status === 'IN_PROGRESS').length} total={todaysOrders.length || 1} color="#50e6ff" />
              <StatusRing label="Done" value={completedToday} total={todaysOrders.length || 1} color="#dff6dd" />
            </div>
          </div>

          <div className={styles.miniGrid}>
            {[
              { label: 'Open queue', value: openQueue, bg: 'rgba(247,99,12,0.14)', accent: '#8a3707' },
              { label: 'Orders today', value: todaysOrders.length, bg: 'rgba(16,124,16,0.14)', accent: '#0b5a0b' },
              { label: 'In progress', value: inProgress, bg: 'rgba(0,120,212,0.12)', accent: '#004578' },
              { label: 'Completed', value: completedToday, bg: 'rgba(135,100,184,0.12)', accent: '#5c2d91' },
            ].map((m) => (
              <div key={m.label} className={styles.miniCard} style={{ backgroundColor: m.bg }}>
                <Text weight="bold" style={{ color: m.accent, fontSize: 22, lineHeight: 1.1 }}>{m.value}</Text>
                <Text size={200} className={styles.muted} style={{ marginTop: 4 }}>{m.label}</Text>
              </div>
            ))}
          </div>

          <div className={styles.softCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ScienceOutlinedIcon style={{ fontSize: 18 }} />
              <Text weight="semibold">Work in queue</Text>
            </div>
            <Text className={styles.muted}>
              {openQueue === 0
                ? 'No pending or in-progress samples.'
                : `${pending} pending, ${inProgress} in progress. Open Lab to start or complete reports.`}
            </Text>
            <Button appearance="primary" style={{ marginTop: 16, width: '100%' }} onClick={() => navigate('/lab')}>
              Open Lab
            </Button>
          </div>
        </div>
      </div>

      {builderOrder && (
        <LabReportBuilderDialog
          order={builderOrder}
          onClose={() => setBuilderOrder(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['lab-orders'] });
            setBuilderOrder(null);
          }}
        />
      )}
    </>
  );
}
