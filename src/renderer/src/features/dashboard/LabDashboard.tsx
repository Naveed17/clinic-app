import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { LiveClock } from '@/components/LiveClock';
import { chipSx } from '@/components/TableUI';
import type { LabOrder, LabOrderStatus } from '@/types/lab';
import { LabReportBuilderDialog } from '@/features/lab/LabReportBuilderDialog';

const statusColor: Record<LabOrderStatus, 'warning' | 'primary' | 'success' | 'error'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusLabel: Record<LabOrderStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function waitMinutes(fromIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60_000));
}

function StatusRing({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}): React.JSX.Element {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <Stack alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={64} thickness={3.5} sx={{ color: alpha(color, 0.15) }} />
        <CircularProgress
          variant="determinate"
          value={pct}
          size={64}
          thickness={3.5}
          sx={{ color, position: 'absolute', left: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
        />
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'common.white' }}>{value}</Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: alpha('#fff', 0.85), fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

export function LabDashboard(): React.JSX.Element {
  const theme = useTheme();
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
    staleTime: 30_000,
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
    () =>
      orders
        .filter((o) => o.status !== 'CANCELLED' && sameDay(new Date(o.orderedAt), today))
        .sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()),
    [orders, today],
  );

  const [ordersLimit, setOrdersLimit] = useState(20);

  const displayedTodaysOrders = useMemo(
    () => todaysOrders.slice(0, ordersLimit),
    [todaysOrders, ordersLimit],
  );

  const handleOrdersScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setOrdersLimit((prev) => (prev < todaysOrders.length ? Math.min(todaysOrders.length, prev + 20) : prev));
    }
  };

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

  const heroFilledSx = {
    borderRadius: 2,
    fontWeight: 700,
    bgcolor: '#fff',
    color: theme.palette.primary.dark,
    boxShadow: 'none',
    '&:hover': { bgcolor: alpha('#fff', 0.92), boxShadow: 'none' },
  } as const;
  const heroOutlineSx = {
    borderRadius: 2,
    fontWeight: 700,
    borderColor: alpha('#fff', 0.5),
    color: '#fff',
    '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) },
  } as const;

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2.5, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Hi {user?.name || 'Lab Technician'},
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
            Welcome Back!
          </Typography>
        </Box>
        <LiveClock />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 4.5 },
              borderRadius: '28px',
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 100%)`,
              color: theme.palette.primary.contrastText,
              position: 'relative',
              overflow: 'hidden',
              minHeight: { xs: 180, sm: 200 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 3,
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.28)}`,
              border: 'none',
            }}
          >
            <Box sx={{ position: 'absolute', right: -10, top: -40, width: 220, height: 220, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.12)}` }} />
            <Box sx={{ position: 'absolute', right: 80, bottom: -70, width: 180, height: 180, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.08)}` }} />
            <Box sx={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ opacity: 0.88, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Now Serving
              </Typography>
              {isPending ? (
                <>
                  <Skeleton variant="text" width={260} height={52} sx={{ bgcolor: alpha('#fff', 0.28), mt: 1 }} />
                  <Skeleton variant="text" width={180} height={24} sx={{ bgcolor: alpha('#fff', 0.18) }} />
                </>
              ) : currentOrder ? (
                <>
                  <Typography
                    variant="h3"
                    fontWeight={800}
                    onClick={() => navigate(`/lab/${currentOrder.id}`)}
                    sx={{
                      letterSpacing: '-0.02em',
                      mt: 0.75,
                      mb: 0.5,
                      lineHeight: 1.2,
                      textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}`,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {currentOrder.tokenNumber != null ? `#${String(currentOrder.tokenNumber).padStart(3, '0')} ` : ''}
                    {currentOrder.patientName}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                    {currentOrder.test}
                    {currentOrder.orderedByName ? ` · ${currentOrder.orderedByName}` : ''}
                    {waitingCount > 0 ? ` · ${waitingCount} waiting` : ''}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2.25 }} flexWrap="wrap" useFlexGap>
                    <Button
                      variant={started ? 'outlined' : 'contained'}
                      loading={startMutation.isPending}
                      disabled={started || startMutation.isPending}
                      onClick={() => startMutation.mutate(currentOrder.id)}
                      sx={started ? heroOutlineSx : heroFilledSx}
                    >
                      {started ? 'In progress' : 'Start sample'}
                    </Button>
                    <Button
                      variant={started ? 'contained' : 'outlined'}
                      disabled={!started}
                      onClick={() => setBuilderOrder(currentOrder)}
                      sx={started ? heroFilledSx : heroOutlineSx}
                    >
                      Build report
                    </Button>
                    <Button variant="outlined" onClick={() => navigate(`/lab/${currentOrder.id}`)} sx={heroOutlineSx}>
                      Open details
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 1, lineHeight: 1.3 }}>
                    No samples waiting
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                    Pending and in-progress orders appear here live, same as the waiting room queue.
                  </Typography>
                  <Button variant="contained" onClick={() => navigate('/lab')} sx={{ ...heroFilledSx, mt: 2.25 }}>
                    Open Lab
                  </Button>
                </>
              )}
            </Box>
            {currentOrder && (
              <Box sx={{ position: 'relative', zIndex: 1, flexShrink: 0, pr: { xs: 0, md: 1 } }}>
                <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Waiting
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
                  <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {waitMinutes(currentOrder.orderedAt, nowMs)}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.8, fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
                    min
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>

          {isPending ? (
            <StatCardsSkeleton count={3} />
          ) : (
            <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
              {[
                { label: 'Pending Orders', value: pending, icon: <PendingOutlinedIcon />, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.12) },
                { label: 'In Progress', value: inProgress, icon: <BiotechOutlinedIcon />, color: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.12) },
                { label: 'Completed Today', value: completedToday, icon: <CheckCircleOutlineIcon />, color: theme.palette.success.dark, bg: alpha(theme.palette.success.main, 0.12) },
              ].map((c) => (
                <Paper key={c.label} elevation={0} sx={{ p: 2.1, ...softCard, bgcolor: c.bg, border: 'none' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>
                        {c.label}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(c.color, 0.15), color: c.color }}>
                      {c.icon}
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Box>
          )}

          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800} fontSize={16}>Today&apos;s Lab Orders</Typography>
                <Typography variant="caption" color="text.secondary">
                  {today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate('/lab')} sx={{ fontWeight: 700 }}>
                View all
              </Button>
            </Stack>
            {isError ? (
              <Typography color="error" variant="body2">
                {error instanceof Error ? error.message : 'Unable to load lab orders.'}
              </Typography>
            ) : isPending ? (
              <ListCardsSkeleton count={5} />
            ) : todaysOrders.length === 0 ? (
              <Box sx={{ display: 'grid', minHeight: 120, placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No lab orders for today.
                </Typography>
              </Box>
            ) : (
              <Stack
                onScroll={handleOrdersScroll}
                spacing={1}
                sx={{
                  maxHeight: 420,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {displayedTodaysOrders.map((order) => (
                  <Box
                    key={order.id}
                    onClick={() => navigate(`/lab/${order.id}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      border: `1px solid ${theme.palette.divider}`,
                      borderLeft: '4px solid',
                      borderLeftColor: `${statusColor[order.status]}.main`,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.07) },
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {initials(order.patientName)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography fontWeight={800} fontSize={14} noWrap>
                          {order.patientName}
                        </Typography>
                        {order.tokenNumber != null && (
                          <Chip
                            size="small"
                            icon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                            label={`#${String(order.tokenNumber).padStart(3, '0')}`}
                            sx={{ ...chipSx, height: 22, fontWeight: 800 }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {order.test} · {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {order.orderedByName ? ` · ${order.orderedByName}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={statusColor[order.status]}
                      label={statusLabel[order.status]}
                      sx={{ ...chipSx, height: 22, fontWeight: 700 }}
                    />
                  </Box>
                ))}
                {displayedTodaysOrders.length < todaysOrders.length && (
                  <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ display: 'block', py: 1.5, fontStyle: 'italic' }}>
                    Scroll down to load more ({displayedTodaysOrders.length} of {todaysOrders.length} lab orders loaded)...
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              background: `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${darken(theme.palette.primary.main, 0.12)} 100%)`,
              color: '#fff',
              boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.28)}`,
            }}
          >
            <Typography fontWeight={800} fontSize={16} sx={{ color: alpha(theme.palette.common.white, 0.7), mb: 2 }}>
              Today&apos;s status
            </Typography>
            <Stack direction="row" spacing={1}>
              <StatusRing label="Pending" value={todaysOrders.filter((o) => o.status === 'PENDING').length} total={todaysOrders.length || 1} color={theme.palette.warning.light} />
              <StatusRing label="In lab" value={todaysOrders.filter((o) => o.status === 'IN_PROGRESS').length} total={todaysOrders.length || 1} color={theme.palette.info.light} />
              <StatusRing label="Done" value={completedToday} total={todaysOrders.length || 1} color={theme.palette.primary.light} />
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
            {[
              { label: 'Open queue', value: openQueue, bg: alpha(theme.palette.warning.main, 0.14), accent: theme.palette.warning.dark },
              { label: 'Orders today', value: todaysOrders.length, bg: alpha(theme.palette.success.main, 0.14), accent: theme.palette.success.dark },
              { label: 'In progress', value: inProgress, bg: alpha(theme.palette.info.main, 0.12), accent: theme.palette.info.dark },
              { label: 'Completed', value: completedToday, bg: alpha(theme.palette.secondary.main, 0.12), accent: theme.palette.secondary.dark },
            ].map((m) => (
              <Paper
                key={m.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: 'none',
                  bgcolor: m.bg,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: 88,
                }}
              >
                <Typography fontWeight={800} fontSize={22} sx={{ color: m.accent, lineHeight: 1.1 }}>
                  {m.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>
                  {m.label}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <ScienceOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography fontWeight={700} fontSize={14}>Work in queue</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {openQueue === 0
                ? 'No pending or in-progress samples.'
                : `${pending} pending, ${inProgress} in progress. Open Lab to start or complete reports.`}
            </Typography>
            <Button fullWidth variant="contained" sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }} onClick={() => navigate('/lab')}>
              Open Lab
            </Button>
          </Paper>
        </Stack>
      </Box>
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
