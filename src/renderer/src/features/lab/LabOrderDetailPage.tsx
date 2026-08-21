import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { LabReportBuilderDialog } from '@/features/lab/LabReportBuilderDialog';
import { LabReportPrint } from '@/features/lab/LabReportPrint';
import { ResultBody } from '@/features/lab/LabOrderResultView';
import { labReportNumber } from '@/features/lab/labReportNumber';
import type { LabOrderStatus } from '@/types/lab';

const statusColor: Record<LabOrderStatus, 'warning' | 'primary' | 'success' | 'error'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export function LabOrderDetailPage(): React.JSX.Element {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isLabTech = user?.role === 'lab_technician';
  const isDoctor = user?.role === 'doctor';
  const canBuild = isLabTech || isDoctor;

  const [builderOpen, setBuilderOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const query = useQuery({
    queryKey: ['lab-order', id],
    queryFn: () => window.clinic.lab.get(id!),
    enabled: Boolean(id),
  });

  const order = query.data ?? null;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['lab-order', id] });
    await qc.invalidateQueries({ queryKey: ['lab-orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => window.clinic.lab.updateStatus(id!, status),
    onSuccess: () => void invalidate(),
    meta: { toast: 'Lab status updated', errorToast: 'Could not update status.' },
  });

  if (query.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 1 }}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (!order) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Lab order not found.
        </Alert>
        <Button
          sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/lab')}
        >
          Back to Lab Orders
        </Button>
      </Box>
    );
  }

  const reportNo = labReportNumber(order.id);
  const statusLabel = order.status.replace('_', ' ');
  const canPrint = order.status === 'COMPLETED' && Boolean(order.result?.trim());
  const tokenLabel = order.tokenNumber != null ? `#${String(order.tokenNumber).padStart(3, '0')}` : '—';

  const summaryCards = [
    {
      label: 'Status',
      value: statusLabel,
      note: 'Current',
      icon: <ScienceOutlinedIcon fontSize="small" />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Report no.',
      value: reportNo,
      note: 'Accession',
      icon: <BiotechOutlinedIcon fontSize="small" />,
      color: theme.palette.info.main,
    },
    {
      label: 'Ordered',
      value: new Date(order.orderedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      note: new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: <AccessTimeOutlinedIcon fontSize="small" />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Token',
      value: tokenLabel,
      note: 'Visit token',
      icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
      color: theme.palette.success.main,
    },
  ];

  const infoRows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <PersonOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Patient',
      value: order.patientName,
    },
    {
      icon: <BadgeOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'MR number',
      value: order.patientMrNumber || '—',
    },
    {
      icon: <LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Phone',
      value: order.patientPhone?.trim() || '—',
    },
    {
      icon: <PersonOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Ordered by',
      value: (
        <Stack direction="row" alignItems="center" spacing={1}>
          <DoctorAvatar name={order.orderedByName} size={28} />
          <Typography fontWeight={600}>{order.orderedByName}</Typography>
        </Stack>
      ),
    },
    {
      icon: <NotesOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Notes',
      value: order.notes?.trim() || '—',
    },
  ];

  return (
    <>
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
            <Tooltip title="Back to lab orders">
              <IconButton
                onClick={() => navigate('/lab')}
                size="small"
                sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Lab test details
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  {order.test}
                </Typography>
                <Chip color={statusColor[order.status]} label={statusLabel} size="small" sx={chipSx} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
                {order.patientName} · {reportNo}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => navigate(`/patients/${order.patientId}`)}
            >
              Open patient
            </Button>
            {isLabTech && order.status === 'PENDING' && (
              <Button
                variant="contained"
                loading={statusMutation.isPending}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => statusMutation.mutate('IN_PROGRESS')}
              >
                Start
              </Button>
            )}
            {canBuild && (order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') && (
              <Button
                startIcon={<ScienceOutlinedIcon />}
                variant={order.status === 'IN_PROGRESS' ? 'contained' : 'outlined'}
                color={order.status === 'IN_PROGRESS' ? 'success' : 'primary'}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setBuilderOpen(true)}
              >
                {order.status === 'IN_PROGRESS' ? 'Build report' : 'Open report'}
              </Button>
            )}
            {canPrint && (
              <Button
                startIcon={<PrintOutlinedIcon />}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setPrintOpen(true)}
              >
                Print
              </Button>
            )}
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
                <Box sx={{ minWidth: 0, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {c.label}
                  </Typography>
                  <Typography
                    fontWeight={900}
                    fontSize={c.label === 'Report no.' ? 16 : 22}
                    sx={{
                      mt: 0.25,
                      letterSpacing: '-0.02em',
                      fontFamily: c.label === 'Report no.' ? 'ui-monospace, Consolas, monospace' : undefined,
                      wordBreak: 'break-word',
                    }}
                  >
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
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
            alignItems: 'start',
          }}
        >
          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Typography fontWeight={800} sx={{ mb: 2 }}>
              Order details
            </Typography>
            <Stack spacing={1.75}>
              {infoRows.map((row) => (
                <Stack key={row.label} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: 'primary.main',
                      flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {row.label}
                    </Typography>
                    {typeof row.value === 'string' ? (
                      <Typography fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                        {row.value}
                      </Typography>
                    ) : (
                      row.value
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Typography fontWeight={800} sx={{ mb: 1.5 }}>
              Result
            </Typography>
            {order.result?.trim() || order.notes?.trim() ? (
              <ResultBody result={order.result} notes={order.notes} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No result recorded yet.
              </Typography>
            )}
          </Paper>
        </Box>
      </Stack>

      {builderOpen && (
        <LabReportBuilderDialog
          order={order}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => {
            void invalidate();
            setBuilderOpen(false);
          }}
        />
      )}

      {printOpen && <LabReportPrint order={order} onClose={() => setPrintOpen(false)} />}
    </>
  );
}
