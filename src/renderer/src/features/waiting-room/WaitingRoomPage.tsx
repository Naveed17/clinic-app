import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientHistoryDialog } from '@/features/patients/PatientHistoryDialog';
import { PrescriptionPadDialog } from '@/features/tokens/PrescriptionPadDialog';
import { appointmentsService } from '@/services/appointments.service';
import type { Appointment } from '@/types/appointment';
import type { Patient } from '@/types/patient';
import type { Token } from '@/types/token';

const DEFAULT_CONSULT_MIN = 30;
const MIN_AVG_SAMPLES = 3;

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

function visitDuration(token: Token): string | null {
  if (!token.updatedAt) return null;
  const mins = Math.round((new Date(token.updatedAt).getTime() - new Date(token.createdAt).getTime()) / 60_000);
  return mins > 0 ? `${mins} min` : null;
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

function fallbackPatient(token: Token): Patient {
  return {
    id: token.patientId,
    mrNumber: token.patient.mrNumber ?? '',
    firstName: token.patient.firstName,
    lastName: token.patient.lastName,
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
  const qc = useQueryClient();
  const theme = useTheme();
  const date = todayStr();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [prescriptionToken, setPrescriptionToken] = useState<Token | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: tokens = [], isLoading, isError } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
  });

  const { data: rawAppts = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });

  const mine = useMemo(
    () => tokens.filter((t) => t.doctorId === user?.id),
    [tokens, user?.id],
  );
  const appointments = useMemo(
    () => (rawAppts as Appointment[]).filter((a) => a.providerId === user?.id),
    [rawAppts, user?.id],
  );

  const waitingAll = useMemo(
    () => mine.filter((t) => t.status === 'WAITING').sort((a, b) => a.tokenNumber - b.tokenNumber),
    [mine],
  );
  const currentToken = waitingAll[0] ?? null;
  const waitingRest = waitingAll.slice(1);
  const finished = useMemo(
    () => mine.filter((t) => t.status === 'DONE' || t.status === 'SKIPPED')
      .sort((a, b) => b.tokenNumber - a.tokenNumber),
    [mine],
  );
  const doneCount = mine.filter((t) => t.status === 'DONE').length;
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

  const mutedBtn = {
    ...outlineBtn,
    color: 'text.secondary',
    borderColor: 'divider',
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
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
    onSuccess: async (token) => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      setPrescriptionToken(token);
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

  const busy =
    startVisitMutation.isPending || completeMutation.isPending || skipMutation.isPending;

  async function openPatientHistory(token: Token): Promise<void> {
    setHistoryLoadingId(token.id);
    try {
      const res = await window.clinic.patients.list({
        page: 1,
        pageSize: 50,
        search: token.patient.firstName || token.patientId,
      });
      setHistoryPatient(res.data.find((p) => p.id === token.patientId) ?? fallbackPatient(token));
    } catch {
      setHistoryPatient(fallbackPatient(token));
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

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          Hi {user?.name || 'Doctor'},
        </Typography>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
          Waiting Room
        </Typography>
      </Box>

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
              {currentToken ? (
                <>
                  <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 0.5, lineHeight: 1.2, textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}` }}>
                    #{String(currentToken.tokenNumber).padStart(3, '0')}
                    {' '}
                    {currentToken.patient.firstName} {currentToken.patient.lastName}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                    {[currentToken.reason, currentToken.notes].filter(Boolean).join(' · ') || 'OPD visit'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2.25 }} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="contained"
                      loading={startVisitMutation.isPending}
                      disabled={busy}
                      onClick={() => startVisitMutation.mutate(currentToken)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        bgcolor: '#fff',
                        color: theme.palette.primary.dark,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: alpha('#fff', 0.92), boxShadow: 'none' },
                      }}
                    >
                      Start visit
                    </Button>
                    <Button
                      variant="outlined"
                      loading={completeMutation.isPending}
                      disabled={busy}
                      onClick={() => completeMutation.mutate(currentToken)}
                      sx={{ borderRadius: 2, fontWeight: 700, borderColor: alpha('#fff', 0.5), color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
                    >
                      Complete
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setPrescriptionToken(currentToken)}
                      sx={{ borderRadius: 2, fontWeight: 700, borderColor: alpha('#fff', 0.5), color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
                    >
                      Write Rx
                    </Button>
                    <Button
                      variant="outlined"
                      loading={skipMutation.isPending}
                      disabled={busy}
                      onClick={() => skipMutation.mutate(currentToken.id)}
                      sx={{ borderRadius: 2, fontWeight: 700, borderColor: alpha('#fff', 0.5), color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
                    >
                      Skip
                    </Button>
                    {canViewPatientHistory && (
                      <Button
                        variant="outlined"
                        loading={historyLoadingId === currentToken.id}
                        onClick={() => void openPatientHistory(currentToken)}
                        sx={{ borderRadius: 2, fontWeight: 700, borderColor: alpha('#fff', 0.5), color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
                      >
                        History
                      </Button>
                    )}
                  </Stack>
                </>
              ) : (
                <>
                  <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 1, lineHeight: 1.3 }}>
                    No one in chair
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                    {waitingAll.length === 0
                      ? 'Reception will issue tokens — they appear here live.'
                      : 'Call the next patient from the waiting list.'}
                  </Typography>
                </>
              )}
            </Box>
            {currentToken && (
              <Box sx={{ position: 'relative', zIndex: 1, flexShrink: 0, pr: { xs: 0, md: 1 } }}>
                <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Waiting
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
                  <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {Math.max(0, Math.floor((nowMs - new Date(currentToken.createdAt).getTime()) / 60_000))}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.8, fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
                    min
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>

          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {[
              { label: 'Waiting', value: waitingAll.length, bg: alpha(theme.palette.warning.main, 0.12), accent: theme.palette.warning.dark },
              { label: 'Now serving', value: currentToken ? 1 : 0, bg: alpha(theme.palette.info.main, 0.12), accent: theme.palette.info.dark },
              { label: 'Done today', value: doneCount, bg: alpha(theme.palette.success.main, 0.14), accent: theme.palette.success.dark },
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
          </Box>

          <Paper elevation={0} sx={{ p: 2.5, ...softCard, borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800} fontSize={16}>Waiting</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  {waitingRest.length > 0 ? ` · ${waitingRest.length} next in line` : ''}
                </Typography>
              </Box>
              {isLoading && <CircularProgress size={18} />}
            </Stack>
            {isLoading && mine.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : waitingRest.length === 0 ? (
              <Box sx={{ display: 'grid', minHeight: 100, placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {currentToken ? 'No one else in line.' : 'No patients waiting.'}
                </Typography>
              </Box>
            ) : (
              <Stack
                spacing={1}
                sx={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {waitingRest.map((token) => {
                  const eta = etaFor(token);
                  return (
                    <Box
                      key={token.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        border: `1px solid ${theme.palette.divider}`,
                        borderLeft: '4px solid',
                        borderLeftColor: 'warning.main',
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
                        {String(token.tokenNumber).padStart(3, '0')}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {token.patient.firstName} {token.patient.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {token.reason || 'OPD visit'}
                          {' · waited '}
                          {formatElapsed(token.createdAt, nowMs)}
                          {eta ? ` · est. ${eta}` : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} flexShrink={0}>
                        <Button size="small" variant="outlined" loading={startVisitMutation.isPending} disabled={busy} onClick={() => startVisitMutation.mutate(token)} sx={outlineBtn}>
                          Start
                        </Button>
                        <Button size="small" variant="outlined" disabled={busy} onClick={() => skipMutation.mutate(token.id)} sx={outlineBtn}>
                          Skip
                        </Button>
                        {canViewPatientHistory && (
                          <Button size="small" variant="outlined" loading={historyLoadingId === token.id} onClick={() => void openPatientHistory(token)} sx={outlineBtn}>
                            History
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
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
              <Typography fontWeight={800} fontSize={14}>Done today</Typography>
              <Typography variant="caption" color="text.secondary">{finished.length} visit{finished.length === 1 ? '' : 's'}</Typography>
            </Stack>
            {finished.length === 0 ? (
              <Typography variant="caption" color="text.disabled">No completed visits yet.</Typography>
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
                {finished.map((token) => {
                  const skipped = token.status === 'SKIPPED';
                  const duration = visitDuration(token);
                  return (
                    <Box
                      key={token.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.25,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderLeft: '4px solid',
                        borderLeftColor: skipped ? 'divider' : 'success.main',
                        bgcolor: skipped ? alpha(theme.palette.text.primary, 0.04) : alpha(theme.palette.primary.main, 0.03),
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1,
                          bgcolor: skipped ? alpha(theme.palette.text.primary, 0.1) : alpha(theme.palette.primary.main, 0.14),
                          color: skipped ? 'text.secondary' : 'primary.main',
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {String(token.tokenNumber).padStart(3, '0')}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize={13} noWrap>
                          {token.patient.firstName} {token.patient.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                          {skipped
                            ? `Skipped · ${formatClock(token.updatedAt ?? token.createdAt)}`
                            : [token.reason || 'OPD', formatClock(token.updatedAt ?? token.createdAt), duration].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Stack spacing={0.5} flexShrink={0}>
                        {!skipped && (
                          <Button size="small" variant="outlined" startIcon={<MedicalServicesOutlinedIcon sx={{ fontSize: '14px !important' }} />} onClick={() => setPrescriptionToken(token)} sx={outlineBtn}>
                            Rx
                          </Button>
                        )}
                        {canViewPatientHistory && (
                          <Button size="small" variant="outlined" startIcon={<HistoryOutlinedIcon sx={{ fontSize: '14px !important' }} />} loading={historyLoadingId === token.id} onClick={() => void openPatientHistory(token)} sx={skipped ? mutedBtn : outlineBtn}>
                            History
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>

      {prescriptionToken && (
        <PrescriptionPadDialog token={prescriptionToken} onClose={() => setPrescriptionToken(null)} />
      )}
      {historyPatient && (
        <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />
      )}
    </>
  );
}
