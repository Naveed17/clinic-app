import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Spinner,
  Text,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { showAppToast } from '@/components/AppToast';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { LiveClock } from '@/components/LiveClock';
import { FetchingBar, ListCardsSkeleton } from '@/components/LoadingUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientHistoryDialog } from '@/features/patients/PatientHistoryDialog';
import { PrescriptionPadDialog } from '@/features/tokens/PrescriptionPadDialog';
import { OrderLabDialog } from '@/features/lab/OrderLabDialog';
import { appointmentsService } from '@/services/appointments.service';
import type { Appointment } from '@/types/appointment';
import type { Patient } from '@/types/patient';
import type { Token } from '@/types/token';

const DEFAULT_CONSULT_MIN = 30;
const MIN_AVG_SAMPLES = 3;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const useStyles = makeStyles({
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: tokens.spacingVerticalXL,
    gap: tokens.spacingHorizontalL,
  },
  greeting: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  title: {
    letterSpacing: '-0.02em',
    marginTop: tokens.spacingVerticalXXS,
  },
  layout: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    alignItems: 'start',
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
    },
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    minWidth: 0,
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  hero: {
    padding: '36px',
    borderRadius: '28px',
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 55%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    position: 'relative',
    overflow: 'hidden',
    minHeight: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXL,
    boxShadow: tokens.shadow16,
    border: 'none',
  },
  heroOrb1: {
    position: 'absolute',
    right: '-10px',
    top: '-40px',
    width: '220px',
    height: '220px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.12)',
  },
  heroOrb2: {
    position: 'absolute',
    right: '80px',
    bottom: '-70px',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.08)',
  },
  heroBody: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    opacity: 0.88,
    fontWeight: tokens.fontWeightBold,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase200,
  },
  heroTitle: {
    letterSpacing: '-0.02em',
    marginTop: '6px',
    marginBottom: '4px',
    lineHeight: 1.2,
    fontWeight: 800,
    fontSize: '28px',
  },
  heroSub: {
    opacity: 0.9,
    fontWeight: 500,
    maxWidth: '440px',
  },
  heroActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalL,
    flexWrap: 'wrap',
  },
  heroWait: {
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  },
  heroWaitValue: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    marginTop: '4px',
  },
  metrics: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(4, 1fr)',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  metricCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: '16px',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '88px',
  },
  metricValue: {
    fontWeight: 800,
    fontSize: '22px',
    lineHeight: 1.1,
  },
  metricLabel: {
    marginTop: '4px',
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  section: {
    padding: tokens.spacingVerticalXL,
    position: 'relative',
    borderRadius: tokens.borderRadiusMedium,
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxHeight: '320px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  listTall: {
    maxHeight: '420px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
  },
  rowWaiting: {
    borderLeftColor: tokens.colorPaletteYellowBorderActive,
  },
  rowAppt: {
    borderLeftColor: tokens.colorPaletteBlueBorderActive,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: '6px',
    flexShrink: 0,
  },
  empty: {
    display: 'grid',
    minHeight: '100px',
    placeItems: 'center',
  },
  nextCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: '18px',
    border: 'none',
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackgroundSelected} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow8,
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  sideCard: {
    padding: tokens.spacingVerticalL,
  },
  surfaceXs: {
    maxWidth: '400px',
    width: '100%',
  },
  dialogBody: {
    padding: tokens.spacingVerticalL,
  },
  dialogActions: {
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
  },
  errorBar: {
    marginBottom: tokens.spacingVerticalL,
  },
});

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
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const canViewPatientHistory = can('managePatients');
  const canOrderLab = can('labDashboard');
  const qc = useQueryClient();
  const date = todayStr();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [prescriptionToken, setPrescriptionToken] = useState<Token | null>(null);
  const [labOrderToken, setLabOrderToken] = useState<Token | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [offDayOpen, setOffDayOpen] = useState(false);
  const [pendingIssue, setPendingIssue] = useState<Appointment | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: tokenList = [], isLoading, isFetching, isError } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
  });

  const { data: rawAppts = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });

  const mine = useMemo(
    () => tokenList.filter((t) => t.doctorId === user?.id),
    [tokenList, user?.id],
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

  const todayDayName = DAY_NAMES[new Date().getDay()];

  function issueForAppointment(appt: Appointment): void {
    issueTokenMutation.mutate(appt);
  }

  function closeOffDayDialog(): void {
    setOffDayOpen(false);
    setPendingIssue(null);
  }

  const heroFilled = {
    backgroundColor: '#fff',
    color: tokens.colorBrandForeground1,
    fontWeight: 700,
  } as const;
  const heroOutline = {
    borderColor: 'rgba(255,255,255,0.5)',
    color: '#fff',
    fontWeight: 700,
  } as const;

  const metrics = [
    { label: 'Waiting', value: waitingAll.length, bg: tokens.colorPaletteYellowBackground2, accent: tokens.colorPaletteYellowForeground2 },
    { label: 'Now serving', value: currentToken ? 1 : 0, bg: tokens.colorPaletteBlueBackground2, accent: tokens.colorPaletteBlueForeground2 },
    { label: 'No token', value: pendingAppointments.length, bg: tokens.colorPaletteGreenBackground2, accent: tokens.colorPaletteGreenForeground2 },
    { label: 'Waiting time', value: waitingTime, bg: tokens.colorPaletteBerryBackground2, accent: tokens.colorPaletteBerryForeground2 },
  ];

  return (
    <>
      <div className={styles.header}>
        <div style={{ minWidth: 0 }}>
          <Text className={styles.greeting} size={300}>
            Hi {user?.name || 'Doctor'},
          </Text>
          <Title2 className={styles.title}>Waiting Room</Title2>
        </div>
        <LiveClock />
      </div>

      {isError && (
        <MessageBar intent="error" className={styles.errorBar}>
          <MessageBarBody>Failed to load waiting room.</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.layout}>
        <div className={styles.col}>
          <div className={styles.hero}>
            <div className={styles.heroOrb1} />
            <div className={styles.heroOrb2} />
            <div className={styles.heroBody}>
              <Text className={styles.heroEyebrow}>Now Serving</Text>
              {isLoading ? (
                <Skeleton>
                  <SkeletonItem style={{ width: 260, height: 40, marginTop: 8 }} />
                  <SkeletonItem style={{ width: 180, height: 20, marginTop: 8 }} />
                </Skeleton>
              ) : currentToken ? (
                <>
                  <Text className={styles.heroTitle} as="h3">
                    #{String(currentToken.tokenNumber).padStart(3, '0')}{' '}
                    {currentToken.patient.firstName} {currentToken.patient.lastName}
                  </Text>
                  <Text className={styles.heroSub}>
                    {[currentToken.reason, currentToken.notes].filter(Boolean).join(' · ') || 'OPD visit'}
                  </Text>
                  <div className={styles.heroActions}>
                    <Button
                      appearance={visitStarted ? 'outline' : 'primary'}
                      disabled={busy || visitStarted || startVisitMutation.isPending}
                      icon={startVisitMutation.isPending ? <Spinner size="tiny" /> : undefined}
                      onClick={() => startVisitMutation.mutate(currentToken)}
                      style={visitStarted ? heroOutline : heroFilled}
                    >
                      Start visit
                    </Button>
                    <Button
                      appearance={visitStarted ? 'primary' : 'outline'}
                      disabled={busy || completeMutation.isPending}
                      icon={completeMutation.isPending ? <Spinner size="tiny" /> : undefined}
                      onClick={() => completeMutation.mutate(currentToken)}
                      style={visitStarted ? heroFilled : heroOutline}
                    >
                      Complete
                    </Button>
                    <Button
                      appearance="outline"
                      onClick={() => setPrescriptionToken(currentToken)}
                      style={heroOutline}
                    >
                      Write Rx
                    </Button>
                    {canOrderLab && visitStarted && (
                      <Button
                        appearance="outline"
                        onClick={() => setLabOrderToken(currentToken)}
                        style={heroOutline}
                      >
                        Order lab
                      </Button>
                    )}
                    <Button
                      appearance="outline"
                      disabled={busy || skipMutation.isPending}
                      icon={skipMutation.isPending ? <Spinner size="tiny" /> : undefined}
                      onClick={() => skipMutation.mutate(currentToken.id)}
                      style={heroOutline}
                    >
                      Skip
                    </Button>
                    {canViewPatientHistory && (
                      <Button
                        appearance="outline"
                        disabled={historyLoadingId === currentToken.id}
                        icon={historyLoadingId === currentToken.id ? <Spinner size="tiny" /> : undefined}
                        onClick={() => void openPatientHistory(currentToken.patientId, currentToken.patient.firstName, currentToken.patient.lastName, currentToken.id)}
                        style={heroOutline}
                      >
                        History
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Text className={styles.heroTitle} as="h3">No one in chair</Text>
                  <Text className={styles.heroSub}>
                    {waitingAll.length === 0
                      ? 'Reception will issue tokens — they appear here live.'
                      : 'Call the next patient from the waiting list.'}
                  </Text>
                </>
              )}
            </div>
            {currentToken && (
              <div className={styles.heroWait}>
                <Text className={styles.heroEyebrow}>Waiting</Text>
                <div className={styles.heroWaitValue}>
                  <Text style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {Math.max(0, Math.floor((nowMs - new Date(currentToken.createdAt).getTime()) / 60_000))}
                  </Text>
                  <Text style={{ opacity: 0.8, fontWeight: 600, fontSize: 16 }}>min</Text>
                </div>
              </div>
            )}
          </div>

          <div className={styles.metrics}>
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={styles.metricCard} style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                  <Skeleton>
                    <SkeletonItem style={{ width: 56, height: 28 }} />
                    <SkeletonItem style={{ width: 90, height: 16, marginTop: 8 }} />
                  </Skeleton>
                </div>
              ))
            ) : (
              metrics.map((m) => (
                <div key={m.label} className={styles.metricCard} style={{ backgroundColor: m.bg }}>
                  <Text className={styles.metricValue} style={{ color: m.accent }}>{m.value}</Text>
                  <Text className={styles.metricLabel}>{m.label}</Text>
                </div>
              ))
            )}
          </div>

          <div className={`${styles.softCard} ${styles.section}`}>
            <FetchingBar show={isFetching && !isLoading} />
            <div className={styles.sectionHead}>
              <div>
                <Text weight="bold" size={400}>Waiting</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground2, display: 'block' }}>
                  {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  {waitingRest.length > 0 ? ` · ${waitingRest.length} next in line` : ''}
                </Text>
              </div>
            </div>
            {isLoading && mine.length === 0 ? (
              <ListCardsSkeleton count={4} />
            ) : waitingRest.length === 0 ? (
              <div className={styles.empty}>
                <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                  {currentToken ? 'No one else in line.' : 'No patients waiting.'}
                </Text>
              </div>
            ) : (
              <div className={styles.list}>
                {waitingRest.map((token) => {
                  const eta = etaFor(token);
                  return (
                    <div key={token.id} className={`${styles.row} ${styles.rowWaiting}`}>
                      <Avatar
                        name={`${token.patient.firstName} ${token.patient.lastName}`}
                        initials={String(token.tokenNumber).padStart(3, '0')}
                        color="brand"
                        style={{ borderRadius: 8, width: 36, height: 36, fontSize: 12, fontWeight: 700 }}
                      />
                      <div className={styles.rowBody}>
                        <Text weight="bold" size={300} truncate>
                          {token.patient.firstName} {token.patient.lastName}
                        </Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground2, display: 'block' }}>
                          {token.reason || 'OPD visit'}
                          {' · waited '}
                          {formatElapsed(token.createdAt, nowMs)}
                          {eta ? ` · est. ${eta}` : ''}
                        </Text>
                      </div>
                      <div className={styles.rowActions}>
                        <Button
                          size="small"
                          appearance="outline"
                          disabled={busy || startVisitMutation.isPending}
                          icon={startVisitMutation.isPending ? <Spinner size="tiny" /> : undefined}
                          onClick={() => startVisitMutation.mutate(token)}
                        >
                          Start
                        </Button>
                        <Button
                          size="small"
                          appearance="outline"
                          disabled={busy}
                          onClick={() => skipMutation.mutate(token.id)}
                        >
                          Skip
                        </Button>
                        {canViewPatientHistory && (
                          <Button
                            size="small"
                            appearance="outline"
                            disabled={historyLoadingId === token.id}
                            icon={historyLoadingId === token.id ? <Spinner size="tiny" /> : undefined}
                            onClick={() => void openPatientHistory(token.patientId, token.patient.firstName, token.patient.lastName, token.id)}
                          >
                            History
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.col}>
          {currentToken && (
            <div className={styles.nextCard}>
              <div style={{ minWidth: 0 }}>
                <Text size={200} style={{ opacity: 0.85, fontWeight: 700 }}>Up next in chair</Text>
                <Text weight="bold" size={400} truncate style={{ display: 'block', marginTop: 2 }}>
                  {currentToken.patient.firstName} {currentToken.patient.lastName}
                </Text>
                <Text size={200} style={{ opacity: 0.9, display: 'block', marginTop: 4 }}>
                  Token #{String(currentToken.tokenNumber).padStart(3, '0')}
                  {' · '}
                  {formatElapsed(currentToken.createdAt, nowMs)}
                </Text>
              </div>
            </div>
          )}

          <div className={`${styles.softCard} ${styles.sideCard}`}>
            <div className={styles.sectionHead}>
              <Text weight="bold" size={300}>Appointments</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {pendingAppointments.length} without token
              </Text>
            </div>
            {pendingAppointments.length === 0 ? (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                All today&apos;s appointments have a token.
              </Text>
            ) : (
              <div className={`${styles.list} ${styles.listTall}`}>
                {pendingAppointments.map((appt) => (
                  <div key={appt.id} className={`${styles.row} ${styles.rowAppt}`}>
                    <Avatar
                      name={`${appt.patient.firstName} ${appt.patient.lastName}`}
                      color="brand"
                      style={{ borderRadius: 8, width: 36, height: 36, fontSize: 12, fontWeight: 700 }}
                    />
                    <div className={styles.rowBody}>
                      <Text weight="bold" size={300} truncate>
                        {appt.patient.firstName} {appt.patient.lastName}
                      </Text>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground2, display: 'block' }}>
                        {formatClock(appt.startsAt)}
                        {' · '}
                        {appt.reason || 'Appointment'}
                      </Text>
                    </div>
                    <div className={styles.rowActions}>
                      <Button
                        size="small"
                        appearance="outline"
                        disabled={issueTokenMutation.isPending}
                        icon={
                          issueTokenMutation.isPending && issueTokenMutation.variables?.id === appt.id
                            ? <Spinner size="tiny" />
                            : undefined
                        }
                        onClick={() => issueForAppointment(appt)}
                      >
                        Issue
                      </Button>
                      {canViewPatientHistory && (
                        <Button
                          size="small"
                          appearance="outline"
                          disabled={historyLoadingId === appt.id}
                          icon={historyLoadingId === appt.id ? <Spinner size="tiny" /> : undefined}
                          onClick={() => void openPatientHistory(appt.patientId, appt.patient.firstName, appt.patient.lastName, appt.id)}
                        >
                          History
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {prescriptionToken && (
        <PrescriptionPadDialog token={prescriptionToken} onClose={() => setPrescriptionToken(null)} />
      )}
      {labOrderToken && user && (
        <OrderLabDialog
          open
          patientId={labOrderToken.patientId}
          patientName={`${labOrderToken.patient.firstName} ${labOrderToken.patient.lastName}`}
          orderedById={user.id}
          tokenId={labOrderToken.id}
          onClose={() => setLabOrderToken(null)}
        />
      )}
      {historyPatient && (
        <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />
      )}
      <Dialog open={offDayOpen} onOpenChange={(_, d) => { if (!d.open) closeOffDayDialog(); }}>
        <DialogSurface className={styles.surfaceXs}>
          <FormDialogTitle title="Not available today" subtitle={todayDayName} />
          <DialogBody>
            <DialogContent className={styles.dialogBody}>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                Today is {todayDayName}. This day is marked as a holiday / off in Doctor Schedule.
                {pendingIssue
                  ? ` ${pendingIssue.patient.firstName} ${pendingIssue.patient.lastName} already has a booked appointment — issue a token to add them to the queue?`
                  : ' A token cannot be issued for a walk-in today.'}
              </Text>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.dialogActions}>
            <Button appearance="secondary" onClick={closeOffDayDialog}>
              Cancel
            </Button>
            {pendingIssue && (
              <SubmitButton
                loading={issueTokenMutation.isPending}
                onClick={() => issueTokenMutation.mutate(pendingIssue)}
              >
                Issue token
              </SubmitButton>
            )}
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </>
  );
}
