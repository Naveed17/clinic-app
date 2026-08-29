import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccess } from '@/app/access';
import type { Token } from '@/types/token';

const statusConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  IN_PROGRESS: { label: 'In progress', color: 'info' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function money(value: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function feeNet(token: Token): number {
  const fee = Number(token.consultationFee ?? 0);
  const discount = Number(token.feeDiscount ?? 0);
  const refunded = Number(token.feeRefunded ?? 0);
  return Math.max(0, fee - discount - refunded);
}

export function OpdFeeDetailPage(): React.JSX.Element {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canOpenPatient = user?.role ? canAccess(user.role, '/patients/:id') : false;

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  function goBack(): void {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/opd-reports');
  }

  const query = useQuery({
    queryKey: ['token', id],
    queryFn: () => window.clinic.tokens.getById(id!) as Promise<Token | null>,
    enabled: Boolean(id),
  });

  const token = query.data ?? null;

  if (query.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 1 }}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (!token) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Doctor fee record not found.
        </Alert>
        <Button
          sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back to OPD Reports
        </Button>
      </Box>
    );
  }

  const status = statusConfig[token.status] ?? { label: token.status, color: 'default' as const };
  const patientLabel = `${token.patient.firstName} ${token.patient.lastName}`.trim();
  const doctorLabel = `Dr. ${token.doctor.firstName} ${token.doctor.lastName}`.trim();
  const fee = Number(token.consultationFee ?? 0);
  const discount = Number(token.feeDiscount ?? 0);
  const refunded = Number(token.feeRefunded ?? 0);
  const net = feeNet(token);

  const summaryCards = [
    {
      label: 'Consultation fee',
      value: money(fee),
      note: 'Charged',
      icon: <LocalHospitalOutlinedIcon fontSize="small" />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Discount',
      value: money(discount),
      note: discount > 0 ? 'Applied' : 'None',
      icon: <PaymentsOutlinedIcon fontSize="small" />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Refunded',
      value: money(refunded),
      note: refunded > 0 ? 'Returned' : 'None',
      icon: <UndoOutlinedIcon fontSize="small" />,
      color: theme.palette.error.main,
    },
    {
      label: 'Net fees',
      value: money(net),
      note: 'Collected',
      icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
      color: theme.palette.success.main,
    },
  ];

  const detailRows = [
    {
      icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Token',
      value: String(token.tokenNumber).padStart(3, '0'),
    },
    {
      icon: <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Date',
      value: new Date(`${token.date}T12:00:00`).toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    },
    {
      icon: <PersonOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Patient',
      value: patientLabel,
      hint: token.patient.mrNumber ? `MR ${token.patient.mrNumber}` : undefined,
    },
    {
      icon: <LocalHospitalOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Doctor',
      value: doctorLabel,
    },
    {
      icon: <PaymentsOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Fee Type',
      value: fee === 0 ? 'Free Checkup' : discount > 0 ? '50% Discount' : 'Paid Visit',
    },
    {
      icon: <NotesOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Reason',
      value: token.reason?.trim() || '—',
    },
    {
      icon: <NotesOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
      label: 'Notes',
      value: token.notes?.trim() || '—',
    },
  ];

  return (
    <Stack spacing={2.5} sx={{ pb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { sm: 'flex-end' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Tooltip title="Back">
            <IconButton
              onClick={() => goBack()}
              size="small"
              sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <ArrowBackOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Doctor fee details
            </Typography>
            <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.25 }}>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                Token #{String(token.tokenNumber).padStart(3, '0')}
              </Typography>
              <Chip color={status.color} label={status.label} size="small" sx={chipSx} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
              {patientLabel} · {doctorLabel}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          {canOpenPatient && (
            <Button
              variant="outlined"
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => navigate(`/patients/${token.patientId}`, { state: { from: location.pathname } })}
            >
              Open patient
            </Button>
          )}
          <Button
            variant="contained"
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
            onClick={() => goBack()}
          >
            Back to reports
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.75,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        {summaryCards.map((c) => (
          <Paper key={c.label} elevation={0} sx={{ p: 2.25, ...softCard, position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                position: 'absolute',
                top: -18,
                right: -18,
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: alpha(c.color, 0.1),
              }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {c.label}
                </Typography>
                <Typography fontWeight={900} fontSize={20} sx={{ mt: 0.25, letterSpacing: '-0.02em' }}>
                  {c.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {c.note}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(c.color, 0.12),
                  color: c.color,
                }}
              >
                {c.icon}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' } }}>
        <Paper elevation={0} sx={{ ...softCard, p: 2.5 }}>
          <Typography fontWeight={800} sx={{ mb: 2 }}>
            Visit details
          </Typography>
          <Stack spacing={1.75}>
            {detailRows.map((row) => (
              <Stack key={row.label} direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ mt: 0.15 }}>{row.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {row.label}
                  </Typography>
                  <Typography fontWeight={700} fontSize={14}>
                    {row.value}
                  </Typography>
                  {row.hint ? (
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {row.hint}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ ...softCard, p: 2.5 }}>
          <Typography fontWeight={800} sx={{ mb: 2 }}>
            Doctor
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <DoctorAvatar
              src={token.doctor.avatar}
              name={doctorLabel}
              size={52}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap>
                {doctorLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Consultation {money(fee)}
              </Typography>
            </Box>
          </Stack>
          {token.prescription ? (
            <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                Prescription
              </Typography>
              <Typography fontWeight={700} fontSize={13.5} sx={{ mt: 0.25 }}>
                {token.prescription.diagnosis || 'On file'}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {token.prescription.medicines.length} medicine
                {token.prescription.medicines.length === 1 ? '' : 's'}
                {token.prescription.pharmacyStatus
                  ? ` · ${token.prescription.pharmacyStatus.toLowerCase()}`
                  : ''}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }} fontWeight={600}>
              No prescription linked to this token.
            </Typography>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
