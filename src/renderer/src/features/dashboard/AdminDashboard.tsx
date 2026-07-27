import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import { Box, Paper, Stack, Typography, Chip, Avatar, LinearProgress } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { appointmentsService } from '@/services/appointments.service';
import type { Token, TokenStatus } from '@/types/token';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

export function AdminDashboard(): React.JSX.Element {
  const theme = useTheme();

  const summary = useQuery({ queryKey: ['reports:summary'], queryFn: reportsService.summary, refetchInterval: 30_000 });
  const patients = useQuery({ queryKey: ['patients', { page: 1, pageSize: 1, search: '' }], queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }), refetchInterval: 30_000 });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, refetchInterval: 30_000 });
  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list, refetchInterval: 30_000 });

  const totalRevenue = (invoices.data ?? []).reduce((s, inv) => s + inv.total, 0);
  const paidInvoices = (invoices.data ?? []).filter((i) => i.status === 'PAID').length;
  const totalInvoices = invoices.data?.length ?? 0;
  const completedAppts = (appointments.data ?? []).filter((a) => a.status === 'COMPLETED').length;
  const totalAppts = appointments.data?.length ?? 0;

  // Doctor load
  const doctorMap = new Map<string, { name: string; initials: string; count: number }>();
  (appointments.data ?? []).forEach((a) => {
    if (a.status === 'CANCELLED') return;
    const key = a.provider.id;
    if (!doctorMap.has(key)) {
      doctorMap.set(key, {
        name: `Dr. ${a.provider.firstName} ${a.provider.lastName}`,
        initials: `${a.provider.firstName[0]}${a.provider.lastName[0]}`.toUpperCase(),
        count: 0,
      });
    }
    doctorMap.get(key)!.count += 1;
  });
  const doctors = Array.from(doctorMap.values()).sort((a, b) => b.count - a.count);

  const statCards = [
    { label: 'Total Patients', value: patients.data?.total ?? 0, icon: <GroupOutlinedIcon />, color: theme.palette.primary.main },
    { label: 'Appointments Today', value: summary.data?.todaysPatients ?? 0, icon: <CalendarMonthOutlinedIcon />, color: theme.palette.secondary.main },
    { label: 'Monthly Revenue', value: money(summary.data?.monthlyRevenue ?? 0), icon: <TrendingUpOutlinedIcon />, color: theme.palette.success.main },
    { label: 'Total Invoices', value: totalInvoices, icon: <PaymentsOutlinedIcon />, color: theme.palette.warning.main },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>Admin Dashboard</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          Full clinic overview
        </Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' } }}>
        {statCards.map((c) => (
          <Paper key={c.label} sx={{ p: 2.5, bgcolor: 'background.paper', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', bottom: -12, right: -12, width: 72, height: 72, borderRadius: '50%', bgcolor: alpha(c.color, 0.1) }} />
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="body2" color="text.secondary" fontWeight={500}>{c.label}</Typography>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: alpha(c.color, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>{c.icon}</Box>
            </Stack>
            <Typography sx={{ mt: 2, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{c.value}</Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        {/* Billing health */}
        <Paper sx={{ p: 3 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Billing Health</Typography>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Paid invoices</Typography>
                <Typography variant="body2" fontWeight={700}>{paidInvoices}/{totalInvoices}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={totalInvoices ? (paidInvoices / totalInvoices) * 100 : 0} sx={{ borderRadius: 99, height: 8 }} color="success" />
            </Box>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Completed appointments</Typography>
                <Typography variant="body2" fontWeight={700}>{completedAppts}/{totalAppts}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={totalAppts ? (completedAppts / totalAppts) * 100 : 0} sx={{ borderRadius: 99, height: 8 }} color="primary" />
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
              <Typography fontWeight={800} color="success.main" fontSize={18}>{money(totalRevenue)}</Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* Provider load */}
        <Paper sx={{ p: 3 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Provider Load</Typography>
          {doctors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No data.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {doctors.map((doc) => (
                <Box key={doc.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>{doc.initials}</Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{doc.name}</Typography>
                  </Box>
                  <Chip label={doc.count} size="small" color="primary" sx={{ borderRadius: 1, fontWeight: 700 }} />
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

      </Box>

      {/* Token Queue */}
      <TokenQueuePanel />

    </Stack>
  );
}

const statusConfig: Record<TokenStatus, { label: string; color: 'warning' | 'success' | 'default' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  DONE:    { label: 'Done',    color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function TokenQueuePanel(): React.JSX.Element {
  const theme = useTheme();
  const { data: tokens = [], isLoading } = useQuery<Token[]>({
    queryKey: ['tokens', todayStr()],
    queryFn: () => window.clinic.tokens.list(todayStr()),
    refetchInterval: 10_000,
  });

  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const done    = tokens.filter((t) => t.status === 'DONE').length;
  const current = tokens.find((t) => t.status === 'WAITING');

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography fontWeight={700}>Today's Token Queue</Typography>
        <Stack direction="row" gap={1}>
          <Chip label={`${waiting} Waiting`} color="warning" size="small" variant="outlined" sx={{ borderRadius: 1, fontWeight: 600 }} />
          <Chip label={`${done} Done`} color="success" size="small" variant="outlined" sx={{ borderRadius: 1, fontWeight: 600 }} />
        </Stack>
      </Stack>

      {current && (
        <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1.5px solid ${alpha(theme.palette.primary.main, 0.25)}`, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ textAlign: 'center', minWidth: 64 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>NOW SERVING</Typography>
            <Typography sx={{ fontSize: 40, fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>
              {String(current.tokenNumber).padStart(3, '0')}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={700}>{current.patient.firstName} {current.patient.lastName}</Typography>
            <Typography variant="body2" color="text.secondary">Dr. {current.doctor.firstName} {current.doctor.lastName}</Typography>
          </Box>
          <Chip label={statusConfig[current.status].label} color={statusConfig[current.status].color} sx={{ fontWeight: 700 }} />
        </Box>
      )}

      {isLoading ? (
        <Typography variant="body2" color="text.secondary">Loading queue...</Typography>
      ) : tokens.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No tokens issued today.</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {tokens.map((token) => {
            const cfg = statusConfig[token.status];
            const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
            return (
              <Box
                key={token.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                  borderRadius: 1, border: '1px solid', borderColor: 'divider',
                  opacity: isDone ? 0.5 : 1,
                  borderLeft: '4px solid',
                  borderLeftColor: token.status === 'WAITING' ? 'warning.main' : token.status === 'DONE' ? 'success.main' : 'divider',
                }}
              >
                <Avatar
                  sx={{
                    width: 38, height: 38, fontWeight: 900, fontSize: 14,
                    bgcolor: alpha(cfg.color === 'default' ? theme.palette.action.active : theme.palette[cfg.color].main, 0.12),
                    color: cfg.color === 'default' ? 'text.secondary' : `${cfg.color}.main`,
                  }}
                >
                  {String(token.tokenNumber).padStart(3, '0')}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontSize={13.5} fontWeight={600}>{token.patient.firstName} {token.patient.lastName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Dr. {token.doctor.firstName} {token.doctor.lastName}{token.reason ? ` · ${token.reason}` : ''}
                  </Typography>
                </Box>
                <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontWeight: 600, minWidth: 88 }} />
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
