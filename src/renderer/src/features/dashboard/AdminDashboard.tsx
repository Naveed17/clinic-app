import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { Box, Paper, Stack, Typography, Chip, Avatar, LinearProgress } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { appointmentsService } from '@/services/appointments.service';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

export function AdminDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();

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

      {/* Recent patients */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={700}>Quick Actions</Typography>
        </Stack>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' } }}>
          {[
            { label: 'New Patient', icon: <PersonAddOutlinedIcon />, color: theme.palette.primary.main, path: '/patients' },
            { label: 'New Appointment', icon: <CalendarMonthOutlinedIcon />, color: theme.palette.secondary.main, path: '/appointments' },
            { label: 'New Invoice', icon: <PaymentsOutlinedIcon />, color: theme.palette.success.main, path: '/billing' },
          ].map((action) => (
            <Paper
              key={action.label}
              onClick={() => void navigate(action.path)}
              sx={{
                p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                border: `1px solid ${alpha(action.color, 0.2)}`,
                '&:hover': { bgcolor: alpha(action.color, 0.06), borderColor: alpha(action.color, 0.5), transform: 'translateY(-1px)', boxShadow: `0 4px 16px ${alpha(action.color, 0.15)}` },
                transition: 'all 0.18s ease',
              }}
            >
              <Box sx={{ color: action.color }}>{action.icon}</Box>
              <Typography variant="body2" fontWeight={600}>{action.label}</Typography>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Stack>
  );
}
