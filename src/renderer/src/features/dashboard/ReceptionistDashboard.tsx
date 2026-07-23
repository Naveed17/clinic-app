import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import { Box, Paper, Stack, Typography, Chip, Avatar, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { useNavigate } from 'react-router-dom';

const statusColor: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'error', NO_SHOW: 'default',
};

export function ReceptionistDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();

  const { data: appointments = [], isLoading } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list, refetchInterval: 15_000 });
  const { data: patientsData } = useQuery({ queryKey: ['patients', { page: 1, pageSize: 1, search: '' }], queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }), refetchInterval: 30_000 });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, refetchInterval: 30_000 });

  const today = new Date();
  const todaysAppts = appointments.filter((a) => {
    const d = new Date(a.startsAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && a.status !== 'CANCELLED';
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const checkedIn = todaysAppts.filter((a) => a.status === 'CHECKED_IN').length;
  const pendingBilling = invoices.filter((i) => i.status === 'DRAFT').length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>Reception Desk</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {today.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' } }}>
        {[
          { label: 'Patients Today',  value: todaysAppts.length, icon: <CalendarMonthOutlinedIcon />, color: theme.palette.primary.main },
          { label: 'Checked In',      value: checkedIn,          icon: <HowToRegOutlinedIcon />,      color: theme.palette.success.main },
          { label: 'Total Patients',  value: patientsData?.total ?? 0, icon: <GroupOutlinedIcon />,   color: theme.palette.secondary.main },
          { label: 'Pending Billing', value: pendingBilling,     icon: <PaymentsOutlinedIcon />,      color: theme.palette.warning.main },
        ].map((c) => (
          <Paper key={c.label} variant="outlined" sx={{ p: 2.5, borderTop: `3px solid ${c.color}` }}>
            <Box sx={{ color: c.color, mb: 1 }}>{c.icon}</Box>
            <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{c.value}</Typography>
            <Typography variant="caption" color="text.secondary">{c.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr auto' } }}>
        {/* Today's queue */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography fontWeight={700}>Today's Queue</Typography>
            <Button size="small" variant="outlined" onClick={() => navigate('/appointments')} sx={{ borderRadius: 2 }}>
              Manage
            </Button>
          </Stack>
          {isLoading ? (
            <Typography variant="body2" color="text.secondary">Loading…</Typography>
          ) : todaysAppts.length === 0 ? (
            <Box sx={{ display: 'grid', minHeight: 100, placeItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">No appointments today.</Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {todaysAppts.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.6), border: `1px solid ${theme.palette.divider}` }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                    {a.patient.firstName[0]}{a.patient.lastName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{a.patient.firstName} {a.patient.lastName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' · Dr. '}{a.provider.firstName} {a.provider.lastName}
                    </Typography>
                  </Box>
                  <Chip size="small" label={a.status.replace('_', ' ')} color={statusColor[a.status]} sx={{ borderRadius: 1, fontSize: 10 }} />
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Quick actions */}
        <Paper variant="outlined" sx={{ p: 3, minWidth: 200 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Quick Actions</Typography>
          <Stack spacing={1.5}>
            {[
              { label: 'Register Patient',  icon: <PersonAddOutlinedIcon />,     color: theme.palette.primary.main,   path: '/patients' },
              { label: 'Book Appointment',  icon: <CalendarMonthOutlinedIcon />, color: theme.palette.secondary.main, path: '/appointments' },
              { label: 'Create Invoice',    icon: <PaymentsOutlinedIcon />,      color: theme.palette.success.main,   path: '/billing' },
            ].map((action) => (
              <Button
                key={action.label}
                variant="outlined"
                startIcon={action.icon}
                onClick={() => navigate(action.path)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start', borderRadius: 2, py: 1.2,
                  borderColor: alpha(action.color, 0.4), color: action.color,
                  '&:hover': { bgcolor: alpha(action.color, 0.06), borderColor: action.color },
                }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
