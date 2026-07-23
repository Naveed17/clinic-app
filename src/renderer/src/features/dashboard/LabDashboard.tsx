import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { Box, Paper, Stack, Typography, Chip, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

// Static demo lab orders — will be replaced when lab IPC is wired
const DEMO_ORDERS = [
  { id: '1', patient: 'Ahmed Raza',    test: 'CBC',           status: 'PENDING',     time: '09:00 AM', dr: 'Dr. Sarah Khan' },
  { id: '2', patient: 'Fatima Malik',  test: 'Blood Sugar',   status: 'IN_PROGRESS', time: '09:30 AM', dr: 'Dr. Sarah Khan' },
  { id: '3', patient: 'Usman Ali',     test: 'Urine R/E',     status: 'COMPLETED',   time: '10:00 AM', dr: 'Dr. Sarah Khan' },
  { id: '4', patient: 'Sara Hussain',  test: 'Lipid Profile', status: 'PENDING',     time: '10:30 AM', dr: 'Dr. Sarah Khan' },
  { id: '5', patient: 'Bilal Sheikh',  test: 'LFTs',          status: 'PENDING',     time: '11:00 AM', dr: 'Dr. Sarah Khan' },
];

const statusColor: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  PENDING: 'warning', IN_PROGRESS: 'primary', COMPLETED: 'success',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
};

export function LabDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const pending = DEMO_ORDERS.filter((o) => o.status === 'PENDING').length;
  const inProgress = DEMO_ORDERS.filter((o) => o.status === 'IN_PROGRESS').length;
  const completed = DEMO_ORDERS.filter((o) => o.status === 'COMPLETED').length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          Lab Dashboard — <Box component="span" color="primary.main">{user?.name}</Box>
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' } }}>
        {[
          { label: 'Pending Orders',  value: pending,    icon: <PendingOutlinedIcon />,       color: theme.palette.warning.main },
          { label: 'In Progress',     value: inProgress, icon: <BiotechOutlinedIcon />,        color: theme.palette.primary.main },
          { label: 'Completed Today', value: completed,  icon: <CheckCircleOutlineIcon />,     color: theme.palette.success.main },
        ].map((c) => (
          <Paper key={c.label} variant="outlined" sx={{ p: 2.5, borderTop: `3px solid ${c.color}` }}>
            <Box sx={{ color: c.color, mb: 1 }}>{c.icon}</Box>
            <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{c.value}</Typography>
            <Typography variant="caption" color="text.secondary">{c.label}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Orders list */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={700}>Today's Lab Orders</Typography>
          <Button size="small" variant="outlined" onClick={() => navigate('/lab')} sx={{ borderRadius: 2 }}>
            View All
          </Button>
        </Stack>
        <Stack spacing={1}>
          {DEMO_ORDERS.map((order) => (
            <Box
              key={order.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: `4px solid ${
                  order.status === 'PENDING' ? theme.palette.warning.main :
                  order.status === 'IN_PROGRESS' ? theme.palette.primary.main :
                  theme.palette.success.main
                }`,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Box sx={{ color: 'primary.main' }}><AssignmentOutlinedIcon fontSize="small" /></Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{order.patient}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {order.test} · {order.time} · {order.dr}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={statusLabel[order.status]}
                color={statusColor[order.status]}
                sx={{ borderRadius: 1, fontSize: 10 }}
              />
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
