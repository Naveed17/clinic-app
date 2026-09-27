import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TvIcon from '@mui/icons-material/Tv';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import CampaignIcon from '@mui/icons-material/Campaign';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ElderlyOutlinedIcon from '@mui/icons-material/ElderlyOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { showAppToast } from '@/components/AppToast';
import {
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
  dialogSubmitBtnSx,
  FormDialogTitle,
} from '@/components/DialogUI';
import { LiveClock } from '@/components/LiveClock';
import { FetchingBar, ListCardsSkeleton } from '@/components/LoadingUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientHistoryDialog } from '@/features/patients/PatientHistoryDialog';
import { OrderLabDialog } from '@/features/lab/OrderLabDialog';
import { appointmentsService } from '@/services/appointments.service';
import { VitalsDialog, VitalChips, PriorityBadge } from './VitalsDialog';
import { WaitingDisplayPage } from './WaitingDisplayPage';
import {
  announceTokenCall,
  isAudioAnnounceEnabled,
  setAudioAnnounceEnabled,
} from '@/utils/audioAnnounce';
import type { Appointment } from '@/types/appointment';
import type { Patient } from '@/types/patient';
import type { Token, TokenPriority } from '@/types/token';

const DEFAULT_CONSULT_MIN = 15;
const MIN_AVG_SAMPLES = 3;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

function formatElapsed(fromIso: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameDayAppt(appt: Appointment, token: Token): boolean {
  if (appt.patientId !== token.patientId || appt.providerId !== token.doctorId) return false;
  if (['CANCELLED', 'NO_SHOW'].includes(appt.status)) return false;
  return new Date(appt.startsAt).toLocaleDateString('en-CA') === token.date;
}

function linkedAppointment(token: Token, appointments: Appointment[]): Appointment | undefined {
  const day = appointments.filter((a) => sameDayAppt(a, token));
  return day.find((a) => a.status === 'CHECKED_IN')
    ?? day.find((a) => a.status === 'SCHEDULED')
    ?? day.find((a) => a.status === 'COMPLETED');
}

function avgConsultMinutes(done: Token[]): number {
  const samples = done
    .map((t) => {
      const start = new Date(t.createdAt).getTime();
      const end = new Date(t.updatedAt ?? t.createdAt).getTime();
      return (end - start) / 60_000;
    })
    .filter((m) => m >= 5 && m <= 120);
  if (samples.length < MIN_AVG_SAMPLES) return DEFAULT_CONSULT_MIN;
  const avg = samples.reduce((s, n) => s + n, 0) / samples.length;
  return Math.round(Math.min(60, Math.max(8, avg)));
}

function fallbackPatient(patientId: string, firstName: string, lastName: string): Patient {
  return {
    id: patientId,
    mrNumber: '',
    firstName,
    lastName,
    dateOfBirth: null,
    phone: null,
    email: null,
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    bloodGroup: null,
    allergies: null,
    chronicConditions: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function WaitingRoomPage(): React.JSX.Element {
  const { user } = useAuth();
  const { can } = useLicense();
  const canViewPatientHistory = can('managePatients');
  const canOrderLab = can('labDashboard');
  const qc = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const date = todayStr();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [labOrderToken, setLabOrderToken] = useState<Token | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [offDayOpen, setOffDayOpen] = useState(false);
  const [pendingIssue, setPendingIssue] = useState<Appointment | null>(null);
  const [vitalsToken, setVitalsToken] = useState<Token | null>(null);
  const [tvDisplayOpen, setTvDisplayOpen] = useState(false);
  const [audioEnabled, setAudioState] = useState(isAudioAnnounceEnabled);
  const [priorityMenuAnchor, setPriorityMenuAnchor] = useState<{ el: HTMLElement; token: Token } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: tokens = [], isLoading, isFetching, isError } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
  });

  const { data: rawAppts = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });

  const isDoctor = user?.role === 'doctor';
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(isDoctor ? (user?.id ?? 'ALL') : 'ALL');

  useEffect(() => {
    if (isDoctor && user?.id) {
      setSelectedDoctorId(user.id);
    }
  }, [isDoctor, user?.id]);

  const doctorsList = useMemo(() => {
    const map = new Map<string, string>();
    tokens.forEach((t) => {
      if (t.doctorId && t.doctor) {
        map.set(t.doctorId, `Dr. ${t.doctor.firstName} ${t.doctor.lastName}`.trim());
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tokens]);

  const mine = useMemo(() => {
    if (selectedDoctorId === 'ALL') return tokens;
    return tokens.filter((t) => t.doctorId === selectedDoctorId);
  }, [tokens, selectedDoctorId]);

  const appointments = useMemo(() => {
    if (selectedDoctorId === 'ALL') return rawAppts as Appointment[];
    return (rawAppts as Appointment[]).filter((a) => a.providerId === selectedDoctorId);
  }, [rawAppts, selectedDoctorId]);

  const waitingAll = useMemo(
    () =>
      mine
        .filter((t) => t.status === 'WAITING')
        .sort((a, b) => {
          const aUrgent = a.priority === 'URGENT' ? 1 : 0;
          const bUrgent = b.priority === 'URGENT' ? 1 : 0;
          if (aUrgent !== bUrgent) return bUrgent - aUrgent;
          return a.tokenNumber - b.tokenNumber;
        }),
    [mine],
  );
  const onHoldTokens = useMemo(
    () => mine.filter((t) => t.status === 'ON_HOLD').sort((a, b) => a.tokenNumber - b.tokenNumber),
    [mine],
  );
  const currentToken = waitingAll[0] ?? null;
  const waitingRest = waitingAll.slice(1);
  const [waitingLimit, setWaitingLimit] = useState(20);

  useEffect(() => {
    setWaitingLimit(20);
  }, [date, user?.id]);

  const displayedWaitingRest = useMemo(
    () => waitingRest.slice(0, waitingLimit),
    [waitingRest, waitingLimit],
  );

  const handleWaitingScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setWaitingLimit((prev) => (prev < waitingRest.length ? Math.min(waitingRest.length, prev + 20) : prev));
    }
  };
  const pendingAppointments = useMemo(
    () => {
      const tokened = new Set(mine.map((t) => t.patientId));
      return appointments
        .filter((a) => {
          if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(a.status)) return false;
          if (new Date(a.startsAt).toLocaleDateString('en-CA') !== date) return false;
          if (tokened.has(a.patientId)) return false;
          return a.tokenNumber == null;
        })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    },
    [appointments, date, mine],
  );
  const avgMinutes = useMemo(
    () => avgConsultMinutes(mine.filter((t) => t.status === 'DONE')),
    [mine],
  );

  const waitingIndex = useMemo(() => {
    const map = new Map<string, number>();
    waitingAll.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [waitingAll]);

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const outlineBtn = {
    borderRadius: 2,
    fontWeight: 700,
    fontSize: 12,
    px: 1.25,
    py: 0.45,
    textTransform: 'none' as const,
    borderColor: alpha(theme.palette.primary.main, 0.4),
    color: theme.palette.primary.main,
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: theme.palette.primary.main },
  } as const;


  async function ensureLinkedAppointment(token: Token): Promise<Appointment> {
    const existing = linkedAppointment(token, appointments);
    if (existing) return existing;
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + DEFAULT_CONSULT_MIN * 60_000).toISOString();
    return appointmentsService.ensureSameDay({
      patientId: token.patientId,
      providerId: token.doctorId,
      startsAt,
      endsAt,
      reason: token.reason,
      notes: token.notes,
      recurrenceRule: null,
    });
  }

  const startVisitMutation = useMutation({
    mutationFn: async (token: Token) => {
      const appt = await ensureLinkedAppointment(token);
      if (appt.status === 'CHECKED_IN') return appt;
      return appointmentsService.updateStatus(appt.id, 'CHECKED_IN');
    },
    onSuccess: async (appt) => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      // Navigate to consultation page for the current token's appointment
      if (appt?.id) {
        navigate(`/consultation/${appt.id}`);
      }
    },
    meta: { silent: true },
  });

  const completeMutation = useMutation({
    mutationFn: async (token: Token) => {
      const appt = await ensureLinkedAppointment(token);
      if (appt.status !== 'COMPLETED') {
        await appointmentsService.updateStatus(appt.id, 'COMPLETED');
      }
      return token;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      showAppToast({ type: 'success', message: 'Visit completed successfully.' });
    },
    meta: { silent: true },
  });

  const skipMutation = useMutation({
    mutationFn: (id: string) => window.clinic.tokens.updateStatus(id, 'SKIPPED'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
    },
    meta: { silent: true },
  });

  const holdMutation = useMutation({
    mutationFn: (id: string) => window.clinic.tokens.updateStatus(id, 'ON_HOLD'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      showAppToast({ type: 'success', message: 'Patient put on hold.' });
    },
    meta: { silent: true },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => window.clinic.tokens.updateStatus(id, 'WAITING'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      showAppToast({ type: 'success', message: 'Patient returned to active queue.' });
    },
    meta: { silent: true },
  });

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      window.clinic.tokens.updatePriority(id, priority),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      showAppToast({ type: 'success', message: 'Triage priority updated.' });
    },
    meta: { silent: true },
  });

  const handleCallPatient = (token: Token): void => {
    const docName = token.doctor
      ? `Dr. ${token.doctor.firstName} ${token.doctor.lastName}`.trim()
      : (user?.name ?? undefined);
    void announceTokenCall({
      tokenNumber: token.tokenNumber,
      patientName: `${token.patient.firstName} ${token.patient.lastName}`.trim(),
      doctorName: docName,
    });
  };

  const handleToggleAudio = (): void => {
    const next = !audioEnabled;
    setAudioState(next);
    setAudioAnnounceEnabled(next);
    showAppToast({ type: 'success', message: next ? 'Voice announcement & chime enabled.' : 'Voice announcement muted.' });
  };

  const issueTokenMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const tokenDate = date;
      const token = await window.clinic.tokens.create({
        patientId: appt.patientId,
        doctorId: appt.providerId,
        date: tokenDate,
        reason: appt.reason,
        notes: appt.notes,
      }) as Token;
      const waiting = token.status === 'WAITING'
        ? token
        : await window.clinic.tokens.updateStatus(token.id, 'WAITING') as Token;
      return waiting;
    },
    onSuccess: async (token) => {
      setOffDayOpen(false);
      setPendingIssue(null);
      qc.setQueryData<Token[]>(['tokens', date], (prev) => {
        const list = prev ?? [];
        const next = list.some((t) => t.id === token.id)
          ? list.map((t) => (t.id === token.id ? token : t))
          : [...list, token];
        return next;
      });
      await Promise.all([
        qc.refetchQueries({ queryKey: ['tokens'] }),
        qc.refetchQueries({ queryKey: ['appointments'] }),
      ]);
    },
    onError: (err, appt) => {
      const msg = String((err as Error)?.message ?? '');
      if (/offline|not available/i.test(msg)) {
        setPendingIssue(appt);
        setOffDayOpen(true);
        return;
      }
      showAppToast({ type: 'error', message: msg || 'Could not issue token.' });
    },
    meta: { silent: true },
  });

  const busy =
    startVisitMutation.isPending || completeMutation.isPending || skipMutation.isPending;

  async function openPatientHistory(patientId: string, firstName: string, lastName: string, rowId: string): Promise<void> {
    setHistoryLoadingId(rowId);
    try {
      const res = await window.clinic.patients.list({
        page: 1,
        pageSize: 50,
        search: firstName || patientId,
      });
      setHistoryPatient(res.data.find((p) => p.id === patientId) ?? fallbackPatient(patientId, firstName, lastName));
    } catch {
      setHistoryPatient(fallbackPatient(patientId, firstName, lastName));
    } finally {
      setHistoryLoadingId(null);
    }
  }

  function etaFor(token: Token): string | null {
    const idx = waitingIndex.get(token.id);
    if (idx == null || idx === 0) return null;
    return `~${idx * avgMinutes} min`;
  }

  const waitingTime = currentToken
    ? formatElapsed(currentToken.createdAt, nowMs)
    : '—';

  const visitStarted = Boolean(
    currentToken && linkedAppointment(currentToken, appointments)?.status === 'CHECKED_IN',
  );
  const heroFilledSx = {
    borderRadius: 2,
    fontWeight: 700,
    bgcolor: 'common.white',
    color: 'primary.dark',
    boxShadow: 'none',
    '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.92), boxShadow: 'none' },
  } as const;
  const heroOutlineSx = {
    borderRadius: 2,
    fontWeight: 700,
    borderColor: alpha(theme.palette.common.white, 0.5),
    color: 'common.white',
    '&:hover': { borderColor: theme.palette.common.white, bgcolor: alpha(theme.palette.common.white, 0.08) },
  } as const;

  const todayDayName = DAY_NAMES[new Date().getDay()];

  function issueForAppointment(appt: Appointment): void {
    issueTokenMutation.mutate(appt);
  }

  function closeOffDayDialog(): void {
    setOffDayOpen(false);
    setPendingIssue(null);
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2.5, gap: 2 }} flexWrap="wrap">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
            Waiting Room
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          {!isDoctor && doctorsList.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <Select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: 13,
                  bgcolor: 'background.paper',
                }}
              >
                <MenuItem value="ALL" sx={{ fontWeight: 700, fontSize: 13 }}>
                  All Doctors ({tokens.filter((t) => t.status === 'WAITING').length})
                </MenuItem>
                {doctorsList.map((d) => (
                  <MenuItem key={d.id} value={d.id} sx={{ fontWeight: 600, fontSize: 13 }}>
                    {d.name} ({tokens.filter((t) => t.doctorId === d.id && t.status === 'WAITING').length})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip title={audioEnabled ? 'Audio Chime & Announcements ON' : 'Audio Announcements MUTED'}>
            <IconButton
              onClick={handleToggleAudio}
              sx={{
                bgcolor: audioEnabled ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.text.disabled, 0.1),
                color: audioEnabled ? 'primary.main' : 'text.disabled',
                borderRadius: 2,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
              }}
            >
              {audioEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>


          <Button
            variant="contained"
            color="primary"
            startIcon={<TvIcon />}
            onClick={() => setTvDisplayOpen(true)}
            sx={{
              borderRadius: 2,
              fontWeight: 800,
              fontSize: 13,
              textTransform: 'none',
              px: 2,
              py: 0.8,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            TV Display Mode
          </Button>

          <LiveClock />
        </Stack>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load waiting room.</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          {/* ─── Now Serving Cockpit Card (Option A Redesign) ───────────── */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: '24px',
              background: isDark
                ? `linear-gradient(135deg, ${alpha('#064e3b', 0.5)} 0%, ${alpha('#0f172a', 0.9)} 55%, ${alpha('#065f46', 0.35)} 100%)`
                : `linear-gradient(135deg, #ffffff 0%, #f0fdf4 55%, #ecfdf5 100%)`,
              border: '1px solid',
              borderColor: isDark ? alpha('#10b981', 0.35) : alpha('#10b981', 0.3),
              boxShadow: isDark
                ? `0 16px 40px ${alpha('#000', 0.45)}, 0 0 30px ${alpha('#10b981', 0.08)}`
                : `0 10px 30px ${alpha('#10b981', 0.08)}, 0 2px 8px ${alpha('#000', 0.04)}`,
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Ambient Background Glow Orbs */}
            <Box
              sx={{
                position: 'absolute',
                right: -20,
                top: -40,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha('#10b981', isDark ? 0.2 : 0.08)} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: 40,
                bottom: -60,
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha('#38bdf8', isDark ? 0.12 : 0.06)} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* Cockpit Top Status Bar */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.9,
                      px: 1.4,
                      py: 0.45,
                      borderRadius: '20px',
                      bgcolor: isDark ? alpha('#10b981', 0.18) : alpha('#10b981', 0.12),
                      border: `1px solid ${alpha('#10b981', isDark ? 0.35 : 0.3)}`,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#10b981',
                        animation: 'cockpitPulse 1.8s infinite ease-in-out',
                        '@keyframes cockpitPulse': {
                          '0%': { opacity: 0.4, transform: 'scale(0.8)' },
                          '50%': { opacity: 1, transform: 'scale(1.2)' },
                          '100%': { opacity: 0.4, transform: 'scale(0.8)' },
                        },
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        color: isDark ? '#6ee7b7' : '#047857',
                        textTransform: 'uppercase',
                      }}
                    >
                      NOW SERVING
                    </Typography>
                  </Box>

                  {currentToken && <PriorityBadge priority={currentToken.priority} />}

                  {!isDoctor && currentToken?.doctor && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.2,
                        py: 0.4,
                        borderRadius: '20px',
                        bgcolor: isDark ? alpha('#38bdf8', 0.12) : alpha('#0284c7', 0.08),
                        border: `1px solid ${alpha(isDark ? '#38bdf8' : '#0284c7', 0.25)}`,
                        color: isDark ? '#7dd3fc' : '#0284c7',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      <LocalHospitalOutlinedIcon sx={{ fontSize: 13 }} />
                      Dr. {currentToken.doctor.firstName} {currentToken.doctor.lastName}
                    </Box>
                  )}
                </Stack>

                {currentToken && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.4,
                      py: 0.5,
                      borderRadius: '12px',
                      bgcolor: isDark ? alpha('#ffffff', 0.06) : alpha('#0f172a', 0.04),
                      border: `1px solid ${isDark ? alpha('#ffffff', 0.12) : alpha('#0f172a', 0.08)}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: isDark ? '#94a3b8' : '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      WAITING
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: isDark ? '#38bdf8' : '#0284c7',
                      }}
                    >
                      {Math.max(0, Math.floor((nowMs - new Date(currentToken.createdAt).getTime()) / 60_000))} min
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Patient Core Info */}
              {isLoading ? (
                <Box sx={{ py: 2 }}>
                  <Skeleton variant="text" width={280} height={52} />
                  <Skeleton variant="text" width={180} height={24} />
                </Box>
              ) : currentToken ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
                        <Box
                          sx={{
                            px: 1.6,
                            py: 0.4,
                            borderRadius: '10px',
                            bgcolor: isDark ? alpha('#10b981', 0.22) : alpha('#10b981', 0.14),
                            border: `1px solid ${alpha('#10b981', isDark ? 0.45 : 0.35)}`,
                            color: isDark ? '#6ee7b7' : '#047857',
                            fontWeight: 900,
                            fontSize: { xs: 22, sm: 26 },
                            letterSpacing: '-0.02em',
                          }}
                        >
                          #{String(currentToken.tokenNumber).padStart(3, '0')}
                        </Box>
                        <Typography
                          variant="h4"
                          fontWeight={900}
                          sx={{
                            letterSpacing: '-0.02em',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            lineHeight: 1.2,
                          }}
                        >
                          {currentToken.patient.firstName} {currentToken.patient.lastName}
                        </Typography>
                      </Stack>

                      <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, maxWidth: 540, mt: 0.5 }}>
                        {[currentToken.reason, currentToken.notes].filter(Boolean).join(' · ') || 'General OPD visit'}
                      </Typography>

                      <Box sx={{ mt: 1.5 }}>
                        <VitalChips vitals={currentToken.vitals} />
                      </Box>
                    </Box>
                  </Box>

                  {/* ─── Cockpit Action Dock ───────────────────────────────── */}
                  <Box
                    sx={{
                      mt: 3,
                      pt: 2.25,
                      borderTop: '1px solid',
                      borderColor: isDark ? alpha('#ffffff', 0.1) : alpha('#0f172a', 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1.5,
                    }}
                  >
                    {/* Left: Primary Clinical / Announce Group */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      {isDoctor && (
                        <>
                          <Button
                            variant={visitStarted ? 'outlined' : 'contained'}
                            color="primary"
                            startIcon={<PlayArrowOutlinedIcon />}
                            loading={startVisitMutation.isPending}
                            disabled={busy || visitStarted}
                            onClick={() => startVisitMutation.mutate(currentToken)}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 800,
                              fontSize: 13,
                              px: 2,
                              py: 0.75,
                              boxShadow: visitStarted ? 'none' : `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
                            }}
                          >
                            Start visit
                          </Button>
                          <Button
                            variant={visitStarted ? 'contained' : 'outlined'}
                            color={visitStarted ? 'success' : 'inherit'}
                            loading={completeMutation.isPending}
                            disabled={busy}
                            onClick={() => completeMutation.mutate(currentToken)}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 800,
                              fontSize: 13,
                              px: 2,
                              py: 0.75,
                            }}
                          >
                            Complete
                          </Button>
                        </>
                      )}
                      {isDoctor && visitStarted && (() => {
                        const linked = linkedAppointment(currentToken, appointments);
                        return linked ? (
                          <Button
                            variant="contained"
                            onClick={() => navigate(`/consultation/${linked.id}`)}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 800,
                              fontSize: 13,
                              px: 2,
                              py: 0.75,
                              bgcolor: '#10b981',
                              color: '#fff',
                              boxShadow: `0 4px 16px ${alpha('#10b981', 0.45)}`,
                              '&:hover': { bgcolor: '#059669' },
                            }}
                          >
                            Open Consultation
                          </Button>
                        ) : null;
                      })()}

                      {/* Call Patient Button */}
                      <Button
                        variant="contained"
                        startIcon={<CampaignIcon />}
                        onClick={() => handleCallPatient(currentToken)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 800,
                          fontSize: 13,
                          px: 2,
                          py: 0.75,
                          bgcolor: isDark ? alpha('#38bdf8', 0.15) : alpha('#0284c7', 0.1),
                          color: isDark ? '#38bdf8' : '#0284c7',
                          border: `1px solid ${alpha(isDark ? '#38bdf8' : '#0284c7', 0.3)}`,
                          '&:hover': {
                            bgcolor: isDark ? alpha('#38bdf8', 0.25) : alpha('#0284c7', 0.18),
                          },
                        }}
                      >
                        Call
                      </Button>

                      {/* Vitals Button */}
                      <Button
                        variant="outlined"
                        startIcon={<FavoriteBorderOutlinedIcon />}
                        onClick={() => setVitalsToken(currentToken)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 700,
                          fontSize: 13,
                          px: 1.8,
                          py: 0.75,
                          borderColor: alpha(isDark ? '#ec4899' : '#db2777', 0.35),
                          color: isDark ? '#f472b6' : '#db2777',
                          bgcolor: isDark ? 'transparent' : alpha('#db2777', 0.04),
                          '&:hover': {
                            borderColor: isDark ? '#ec4899' : '#db2777',
                            bgcolor: alpha(isDark ? '#ec4899' : '#db2777', 0.1),
                          },
                        }}
                      >
                        Vitals
                      </Button>
                    </Stack>

                    {/* Right: Queue Controls Group (Ghost / Muted) */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Button
                        variant="outlined"
                        startIcon={<PauseCircleOutlineIcon />}
                        loading={holdMutation.isPending}
                        disabled={busy}
                        onClick={() => holdMutation.mutate(currentToken.id)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 700,
                          fontSize: 12.5,
                          px: 1.5,
                          py: 0.6,
                          borderColor: alpha(isDark ? '#f59e0b' : '#d97706', 0.35),
                          color: isDark ? '#fbbf24' : '#d97706',
                          bgcolor: isDark ? 'transparent' : alpha('#d97706', 0.04),
                          '&:hover': {
                            borderColor: isDark ? '#f59e0b' : '#d97706',
                            bgcolor: alpha(isDark ? '#f59e0b' : '#d97706', 0.1),
                          },
                        }}
                      >
                        Hold
                      </Button>

                      {isDoctor && canOrderLab && visitStarted && (
                        <Button
                          variant="outlined"
                          onClick={() => setLabOrderToken(currentToken)}
                          sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            fontSize: 12.5,
                            px: 1.5,
                            py: 0.6,
                          }}
                        >
                          Order lab
                        </Button>
                      )}

                      <Button
                        variant="outlined"
                        loading={skipMutation.isPending}
                        disabled={busy}
                        onClick={() => skipMutation.mutate(currentToken.id)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 700,
                          fontSize: 12.5,
                          px: 1.5,
                          py: 0.6,
                          borderColor: isDark ? alpha('#ffffff', 0.15) : alpha('#0f172a', 0.15),
                          color: isDark ? '#cbd5e1' : '#475569',
                          bgcolor: isDark ? alpha('#ffffff', 0.04) : alpha('#0f172a', 0.03),
                          '&:hover': {
                            borderColor: isDark ? alpha('#ffffff', 0.3) : alpha('#0f172a', 0.3),
                            bgcolor: isDark ? alpha('#ffffff', 0.08) : alpha('#0f172a', 0.06),
                          },
                        }}
                      >
                        Skip
                      </Button>

                      {canViewPatientHistory && (
                        <Button
                          variant="outlined"
                          loading={historyLoadingId === currentToken.id}
                          onClick={() => void openPatientHistory(currentToken.patientId, currentToken.patient.firstName, currentToken.patient.lastName, currentToken.id)}
                          sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            fontSize: 12.5,
                            px: 1.5,
                            py: 0.6,
                            borderColor: isDark ? alpha('#ffffff', 0.15) : alpha('#0f172a', 0.15),
                            color: isDark ? '#cbd5e1' : '#475569',
                            bgcolor: isDark ? alpha('#ffffff', 0.04) : alpha('#0f172a', 0.03),
                            '&:hover': {
                              borderColor: isDark ? alpha('#ffffff', 0.3) : alpha('#0f172a', 0.3),
                              bgcolor: isDark ? alpha('#ffffff', 0.08) : alpha('#0f172a', 0.06),
                            },
                          }}
                        >
                          History
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </>
              ) : (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={800} sx={{ color: isDark ? '#f8fafc' : '#0f172a', mb: 0.75 }}>
                    No Active Patient in Chair
                  </Typography>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b', maxWidth: 420, mx: 'auto', mb: 2 }}>
                    {waitingAll.length === 0
                      ? 'Queue is currently empty. Tokens issued at reception will appear here live.'
                      : 'Consultation desk is ready. Call the next patient in line to begin.'}
                  </Typography>
                  {waitingAll[0] && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CampaignIcon />}
                      onClick={() => handleCallPatient(waitingAll[0])}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 800,
                        fontSize: 13,
                        px: 2.5,
                        py: 0.85,
                        boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
                      }}
                    >
                      Call Next Patient (#{String(waitingAll[0].tokenNumber).padStart(3, '0')})
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: '16px', minHeight: 88 }}>
                  <Skeleton variant="text" width={56} height={28} />
                  <Skeleton variant="text" width={90} height={16} />
                </Paper>
              ))
            ) : (
              <>
                {[
                  { label: 'Waiting', value: waitingAll.length, bg: alpha(theme.palette.warning.main, 0.12), accent: theme.palette.warning.dark },
                  { label: 'Now serving', value: currentToken ? 1 : 0, bg: alpha(theme.palette.info.main, 0.12), accent: theme.palette.info.dark },
                  { label: 'No token', value: pendingAppointments.length, bg: alpha(theme.palette.success.main, 0.14), accent: theme.palette.success.dark },
                  { label: 'Waiting time', value: waitingTime, bg: alpha(theme.palette.secondary.main, 0.12), accent: theme.palette.secondary.dark },
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
                    <Typography fontWeight={800} fontSize={22} sx={{ color: m.accent ?? 'text.primary', lineHeight: 1.1 }}>
                      {m.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>
                      {m.label}
                    </Typography>
                  </Paper>
                ))}
              </>
            )}
          </Box>

          <Paper elevation={0} sx={{ p: 2.5, ...softCard, borderRadius: 1, position: 'relative' }}>
            <FetchingBar show={isFetching && !isLoading} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800} fontSize={16}>Waiting</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  {waitingRest.length > 0 ? ` · ${waitingRest.length} next in line` : ''}
                </Typography>
              </Box>
            </Stack>
            {isLoading && mine.length === 0 ? (
              <ListCardsSkeleton count={4} />
            ) : waitingRest.length === 0 ? (
              <Box sx={{ display: 'grid', minHeight: 100, placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {currentToken ? 'No one else in line.' : 'No patients waiting.'}
                </Typography>
              </Box>
            ) : (
              <Stack
                onScroll={handleWaitingScroll}
                spacing={1}
                sx={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {displayedWaitingRest.map((token) => {
                  const eta = etaFor(token);
                  const priorityColor =
                    token.priority === 'URGENT'
                      ? '#ef4444'
                      : token.priority === 'SENIOR'
                      ? '#f59e0b'
                      : token.priority === 'CHILD'
                      ? '#06b6d4'
                      : '#10b981';

                  return (
                    <Box
                      key={token.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        p: 1.5,
                        borderRadius: '14px',
                        bgcolor: alpha(priorityColor, 0.04),
                        border: `1px solid ${alpha(priorityColor, 0.22)}`,
                        borderLeft: `5px solid ${priorityColor}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(priorityColor, 0.08),
                          borderColor: alpha(priorityColor, 0.4),
                          boxShadow: `0 4px 16px ${alpha(priorityColor, 0.12)}`,
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '10px',
                            bgcolor: alpha(priorityColor, 0.14),
                            color: priorityColor,
                            fontSize: 12.5,
                            fontWeight: 900,
                            border: `1px solid ${alpha(priorityColor, 0.3)}`,
                            flexShrink: 0,
                          }}
                        >
                          #{String(token.tokenNumber).padStart(2, '0')}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                            <Typography variant="body2" fontWeight={800} noWrap sx={{ fontSize: 13.5 }}>
                              {token.patient.firstName} {token.patient.lastName}
                            </Typography>
                            <Box
                              sx={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                              onClick={(e) => setPriorityMenuAnchor({ el: e.currentTarget, token })}
                            >
                              <PriorityBadge priority={token.priority} />
                              {(!token.priority || token.priority === 'NORMAL') && (
                                <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', textDecoration: 'underline' }}>
                                  Priority
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                            {token.reason || 'OPD visit'}
                            {' · Waited '}
                            {formatElapsed(token.createdAt, nowMs)}
                            {eta ? ` · Est. ${eta}` : ''}
                          </Typography>
                          <VitalChips vitals={token.vitals} />
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={0.6} flexShrink={0} alignItems="center">
                        <Tooltip title="Call Patient (Chime & Voice)">
                          <IconButton
                            size="small"
                            onClick={() => handleCallPatient(token)}
                            sx={{
                              color: '#38bdf8',
                              bgcolor: alpha('#38bdf8', 0.08),
                              '&:hover': { bgcolor: alpha('#38bdf8', 0.2) },
                            }}
                          >
                            <CampaignIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Pre-Check Vitals">
                          <IconButton
                            size="small"
                            onClick={() => setVitalsToken(token)}
                            sx={{
                              color: '#f472b6',
                              bgcolor: alpha('#ec4899', 0.08),
                              '&:hover': { bgcolor: alpha('#ec4899', 0.2) },
                            }}
                          >
                            <FavoriteBorderOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Put on Hold">
                          <IconButton
                            size="small"
                            loading={holdMutation.isPending}
                            disabled={busy}
                            onClick={() => holdMutation.mutate(token.id)}
                            sx={{
                              color: '#f59e0b',
                              bgcolor: alpha('#f59e0b', 0.08),
                              '&:hover': { bgcolor: alpha('#f59e0b', 0.2) },
                            }}
                          >
                            <PauseCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isDoctor && (
                          <Button
                            size="small"
                            variant="outlined"
                            loading={startVisitMutation.isPending}
                            disabled={busy}
                            onClick={() => startVisitMutation.mutate(token)}
                            sx={outlineBtn}
                          >
                            Start
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => skipMutation.mutate(token.id)}
                          sx={{ ...outlineBtn, borderColor: 'divider', color: 'text.secondary' }}
                        >
                          Skip
                        </Button>
                        {canViewPatientHistory && (
                          <Button
                            size="small"
                            variant="outlined"
                            loading={historyLoadingId === token.id}
                            onClick={() => void openPatientHistory(token.patientId, token.patient.firstName, token.patient.lastName, token.id)}
                            sx={{ ...outlineBtn, borderColor: 'divider', color: 'text.secondary' }}
                          >
                            History
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
                {displayedWaitingRest.length < waitingRest.length && (
                  <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ display: 'block', py: 1.5, fontStyle: 'italic' }}>
                    Scroll down to load more ({displayedWaitingRest.length} of {waitingRest.length} next in line loaded)...
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>

          {/* On Hold Patients Panel */}
          {onHoldTokens.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, ...softCard, borderRadius: 1, borderColor: alpha('#f59e0b', 0.4), bgcolor: alpha('#f59e0b', 0.02) }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PauseCircleOutlineIcon sx={{ color: '#d97706', fontSize: 20 }} />
                  <Typography fontWeight={800} fontSize={15} sx={{ color: '#d97706' }}>
                    On Hold / Stepped Out ({onHoldTokens.length})
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Patient temporarily paused (e.g. at pharmacy / lab)
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {onHoldTokens.map((token) => (
                  <Box
                    key={token.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha('#f59e0b', 0.06),
                      border: `1px solid ${alpha('#f59e0b', 0.25)}`,
                      borderLeft: '4px solid #f59e0b',
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1,
                        bgcolor: alpha('#f59e0b', 0.18),
                        color: '#d97706',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {String(token.tokenNumber).padStart(3, '0')}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {token.patient.firstName} {token.patient.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {token.reason || 'OPD visit'} · on hold since {formatElapsed(token.updatedAt || token.createdAt, nowMs)}
                      </Typography>
                      <VitalChips vitals={token.vitals} />
                    </Box>
                    <Stack direction="row" spacing={1} flexShrink={0} alignItems="center">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlayCircleOutlineIcon />}
                        loading={resumeMutation.isPending}
                        onClick={() => resumeMutation.mutate(token.id)}
                        sx={{
                          bgcolor: '#f59e0b',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          borderRadius: 2,
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#d97706' },
                        }}
                      >
                        Resume
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => skipMutation.mutate(token.id)}
                        sx={outlineBtn}
                      >
                        Skip
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {currentToken && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '18px',
                border: 'none',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'primary.contrastText',
                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 700 }}>Up next in chair</Typography>
                <Typography fontWeight={800} fontSize={15} sx={{ mt: 0.15 }} noWrap>
                  {currentToken.patient.firstName} {currentToken.patient.lastName}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mt: 0.35 }}>
                  Token #{String(currentToken.tokenNumber).padStart(3, '0')}
                  {' · '}
                  {formatElapsed(currentToken.createdAt, nowMs)}
                </Typography>
              </Box>
            </Paper>
          )}

          <Paper elevation={0} sx={{ p: 2, ...softCard }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography fontWeight={800} fontSize={14}>Appointments</Typography>
              <Typography variant="caption" color="text.secondary">
                {pendingAppointments.length} without token
              </Typography>
            </Stack>
            {pendingAppointments.length === 0 ? (
              <Typography variant="caption" color="text.disabled">All today&apos;s appointments have a token.</Typography>
            ) : (
              <Stack
                spacing={1}
                sx={{
                  maxHeight: 420,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {pendingAppointments.map((appt) => (
                  <Box
                    key={appt.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      border: `1px solid ${theme.palette.divider}`,
                      borderLeft: '4px solid',
                      borderLeftColor: 'info.main',
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {appt.patient.firstName[0]}
                      {appt.patient.lastName?.[0] ?? ''}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {appt.patient.firstName} {appt.patient.lastName || ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatClock(appt.startsAt)}
                        {' · '}
                        {appt.reason || 'Appointment'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} flexShrink={0}>
                      <Button
                        size="small"
                        variant="outlined"
                        loading={issueTokenMutation.isPending && issueTokenMutation.variables?.id === appt.id}
                        disabled={issueTokenMutation.isPending}
                        onClick={() => issueForAppointment(appt)}
                        sx={outlineBtn}
                      >
                        Issue
                      </Button>
                      {canViewPatientHistory && (
                        <Button
                          size="small"
                          variant="outlined"
                          loading={historyLoadingId === appt.id}
                          onClick={() => void openPatientHistory(appt.patientId, appt.patient.firstName, appt.patient.lastName, appt.id)}
                          sx={outlineBtn}
                        >
                          History
                        </Button>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>

      {labOrderToken && user && (
        <OrderLabDialog
          open
          patientId={labOrderToken.patientId}
          patientName={[labOrderToken.patient.firstName, labOrderToken.patient.lastName].filter(Boolean).join(' ')}
          orderedById={user.id}
          tokenId={labOrderToken.id}
          onClose={() => setLabOrderToken(null)}
        />
      )}
      {historyPatient && (
        <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />
      )}
      <VitalsDialog
        open={Boolean(vitalsToken)}
        token={vitalsToken}
        onClose={() => setVitalsToken(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['tokens'] });
        }}
      />
      <Menu
        anchorEl={priorityMenuAnchor?.el}
        open={Boolean(priorityMenuAnchor)}
        onClose={() => setPriorityMenuAnchor(null)}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 800, color: 'text.secondary' }}>
          CHANGE TRIAGE PRIORITY
        </Typography>
        <MenuItem
          onClick={() => {
            if (priorityMenuAnchor) {
              priorityMutation.mutate({ id: priorityMenuAnchor.token.id, priority: 'NORMAL' });
              setPriorityMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon><CheckCircleOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Normal Priority</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (priorityMenuAnchor) {
              priorityMutation.mutate({ id: priorityMenuAnchor.token.id, priority: 'URGENT' });
              setPriorityMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon><WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main', fontWeight: 700 }}>Emergency / Urgent (Top of Line)</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (priorityMenuAnchor) {
              priorityMutation.mutate({ id: priorityMenuAnchor.token.id, priority: 'SENIOR' });
              setPriorityMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon><ElderlyOutlinedIcon fontSize="small" sx={{ color: '#d97706' }} /></ListItemIcon>
          <ListItemText sx={{ color: '#d97706', fontWeight: 700 }}>Senior Citizen Priority</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (priorityMenuAnchor) {
              priorityMutation.mutate({ id: priorityMenuAnchor.token.id, priority: 'CHILD' });
              setPriorityMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon><ChildCareOutlinedIcon fontSize="small" sx={{ color: '#0891b2' }} /></ListItemIcon>
          <ListItemText sx={{ color: '#0891b2', fontWeight: 700 }}>Pediatric / Child Priority</ListItemText>
        </MenuItem>
      </Menu>
      {tvDisplayOpen && (
        <WaitingDisplayPage onExit={() => setTvDisplayOpen(false)} />
      )}
      <Dialog open={offDayOpen} onClose={closeOffDayDialog} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
        <FormDialogTitle title="Not available today" subtitle={todayDayName} />
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2" color="text.secondary">
            Today is {todayDayName}. This day is marked as a holiday / off in Doctor Schedule.
            {pendingIssue
              ? ` ${[pendingIssue.patient.firstName, pendingIssue.patient.lastName].filter(Boolean).join(' ')} already has a booked appointment — issue a token to add them to the queue?`
              : ' A token cannot be issued for a walk-in today.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={closeOffDayDialog} sx={dialogCancelBtnSx}>
            Cancel
          </Button>
          {pendingIssue && (
            <Button
              variant="contained"
              loading={issueTokenMutation.isPending}
              onClick={() => issueTokenMutation.mutate(pendingIssue)}
              sx={dialogSubmitBtnSx}
            >
              Issue token
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
