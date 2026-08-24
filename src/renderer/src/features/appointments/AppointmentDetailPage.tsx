import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
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
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog } from '@/components/DialogUI';
import { chipSx } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { AppointmentDialog } from '@/features/appointments/AppointmentsPage';
import { AppointmentVisitList } from '@/features/appointments/AppointmentVisitList';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { appointmentsService } from '@/services/appointments.service';
import type { Appointment } from '@/types/appointment';

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  SCHEDULED: { label: 'Scheduled', color: 'primary' },
  CHECKED_IN: { label: 'Checked In', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'default' },
  NO_SHOW: { label: 'No Show', color: 'error' },
};

function personName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export function AppointmentDetailPage(): React.JSX.Element {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tokenPrint = usePrintAppointmentToken();
  const visitsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });

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
    navigate('/appointments');
  }

  const query = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsService.get(id!),
    enabled: Boolean(id),
  });

  const appointment = query.data ?? null;
  const forbidden =
    Boolean(appointment) &&
    user?.role === 'doctor' &&
    appointment!.providerId !== user.id;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['appointment', id] });
    await qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: Appointment['status']) => appointmentsService.updateStatus(id!, status),
    onSuccess: () => void invalidate(),
    meta: { toast: 'Appointment updated', errorToast: 'Could not update status.' },
  });

  const cancelMutation = useMutation({
    mutationFn: () => appointmentsService.cancel(id!),
    onSuccess: () => void invalidate(),
    meta: { toast: 'Appointment cancelled', errorToast: 'Could not cancel.' },
  });

  const deleteMutation = useMutation({
    mutationFn: () => appointmentsService.delete(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      goBack();
    },
    meta: { toast: 'Appointment deleted', errorToast: 'Could not delete.' },
  });

  if (query.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 1 }}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (!appointment || forbidden) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Appointment not found.
        </Alert>
        <Button
          sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back to Appointments
        </Button>
      </Box>
    );
  }

  const status = statusConfig[appointment.status] ?? { label: appointment.status, color: 'default' as const };
  const closed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);
  const patientLabel = personName(appointment.patient.firstName, appointment.patient.lastName);
  const patientVisits = (visitsQuery.data ?? [])
    .filter((a) => a.patientId === appointment.patientId)
    .filter((a) => user?.role !== 'doctor' || a.providerId === user.id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const doctorLabel = `Dr. ${personName(appointment.provider.firstName, appointment.provider.lastName)}`;
  const dateLabel = new Date(appointment.startsAt).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = `${new Date(appointment.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(appointment.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const tokenLabel = appointment.tokenNumber
    ? `#${String(appointment.tokenNumber).padStart(3, '0')}`
    : '—';

  const summaryCards = [
    {
      label: 'Date',
      value: new Date(appointment.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      note: new Date(appointment.startsAt).toLocaleDateString([], { weekday: 'long' }),
      icon: <CalendarMonthOutlinedIcon fontSize="small" />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Time',
      value: new Date(appointment.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: `Until ${new Date(appointment.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      icon: <AccessTimeOutlinedIcon fontSize="small" />,
      color: theme.palette.info.main,
    },
    {
      label: 'Token',
      value: tokenLabel,
      note: 'Queue number',
      icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Status',
      value: status.label,
      note: 'Current',
      icon: <CheckCircleOutlinedIcon fontSize="small" />,
      color: theme.palette.success.main,
    },
  ];

  const detailRows = [
    {
      icon: <PersonOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Doctor',
      value: (
        <Stack direction="row" alignItems="center" spacing={1}>
          <DoctorAvatar src={appointment.provider.avatar} name={doctorLabel} size={28} />
          <Typography fontWeight={600}>{doctorLabel}</Typography>
        </Stack>
      ),
    },
    {
      icon: <LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Patient phone',
      value: appointment.patient.phone || '—',
    },
    {
      icon: <NotesOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Reason',
      value: appointment.reason || '—',
    },
    {
      icon: <NotesOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Notes',
      value: appointment.notes || '—',
    },
    ...(appointment.recurrenceRule
      ? [
          {
            icon: <RepeatOutlinedIcon sx={{ fontSize: 18 }} />,
            label: 'Recurrence',
            value: appointment.recurrenceRule,
          },
        ]
      : []),
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
                Appointment details
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  {patientLabel}
                </Typography>
                <Chip color={status.color} label={status.label} size="small" sx={chipSx} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
                {dateLabel} · {timeLabel}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              startIcon={<PrintOutlinedIcon />}
              variant="outlined"
              loading={tokenPrint.printingId === appointment.id}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => tokenPrint.printFor(appointment)}
            >
              Print token
            </Button>
            {(user?.role === 'receptionist' || user?.role === 'doctor' || user?.role === 'lab_technician') && (
              <Button
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => navigate(`/patients/${appointment.patientId}`)}
              >
                Open patient
              </Button>
            )}
            {!closed && (
              <Button
                startIcon={<EditOutlinedIcon />}
                variant="contained"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            )}
            {appointment.status === 'SCHEDULED' && (
              <Button
                startIcon={<LoginOutlinedIcon />}
                variant="outlined"
                loading={statusMutation.isPending}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => statusMutation.mutate('CHECKED_IN')}
              >
                Check in
              </Button>
            )}
            {appointment.status === 'CHECKED_IN' && (
              <Button
                startIcon={<CheckCircleOutlinedIcon />}
                variant="outlined"
                color="success"
                loading={statusMutation.isPending}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => statusMutation.mutate('COMPLETED')}
              >
                Complete
              </Button>
            )}
            {['SCHEDULED', 'CHECKED_IN'].includes(appointment.status) && (
              <>
                <Button
                  startIcon={<PersonOffOutlinedIcon />}
                  variant="outlined"
                  color="warning"
                  loading={statusMutation.isPending}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                  onClick={() => statusMutation.mutate('NO_SHOW')}
                >
                  No show
                </Button>
                <Button
                  startIcon={<CancelOutlinedIcon />}
                  variant="outlined"
                  color="inherit"
                  loading={cancelMutation.isPending}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              startIcon={<DeleteOutlineIcon />}
              variant="outlined"
              color="error"
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
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
                  <Typography fontWeight={900} fontSize={22} sx={{ mt: 0.25, letterSpacing: '-0.02em' }}>
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

        <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
          <Typography fontWeight={800} sx={{ mb: 2 }}>
            Visit details
          </Typography>
          <Stack spacing={1.75}>
            {detailRows.map((row) => (
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

        {patientVisits.length > 1 && (
          <Paper elevation={0} sx={{ ...softCard, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, pt: 2.25, pb: 0.5 }}>
              <Typography fontWeight={800}>All visits</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Token details and reprint for every appointment
              </Typography>
            </Box>
            <AppointmentVisitList
              appointments={patientVisits}
              currentId={appointment.id}
              onOpen={(a) => {
                if (a.id !== appointment.id) navigate(`/appointments/${a.id}`);
              }}
              onPrint={tokenPrint.printFor}
              printingId={tokenPrint.printingId}
              showNotes
            />
          </Paper>
        )}
      </Stack>

      <AppointmentDialog
        appointment={appointment}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        defaultProviderId={user?.role === 'doctor' ? user.id : undefined}
        onSuccess={() => void invalidate()}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete appointment?"
        message={`Delete appointment for ${patientLabel} on ${new Date(appointment.startsAt).toLocaleString()}?`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteOpen(false)}
      />

      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </>
  );
}
