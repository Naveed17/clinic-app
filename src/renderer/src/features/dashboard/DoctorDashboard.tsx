import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Tab,
  TabList,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { appointmentsService } from '@/services/appointments.service';
import { AppointmentDialog } from '@/features/appointments/AppointmentsPage';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import { TokenPrintPreview, IssueTokenDialog } from '@/features/tokens/TokensPage';
import { PrescriptionPadDialog } from '@/features/tokens/PrescriptionPadDialog';
import { PatientHistoryDialog } from '@/features/patients/PatientHistoryDialog';
import { OrderLabDialog } from '@/features/lab/OrderLabDialog';
import type { Token } from '@/types/token';
import type { Appointment } from '@/types/appointment';
import type { Patient } from '@/types/patient';
import {
  AccessTimeOutlinedIcon,
  ArrowForwardIcon,
  BiotechOutlinedIcon,
  CalendarMonthOutlinedIcon,
  CheckCircleOutlineIcon,
  EditOutlinedIcon,
  EventOutlinedIcon,
  FormatListBulletedOutlinedIcon,
  HistoryOutlinedIcon,
  MedicalServicesOutlinedIcon,
  MeetingRoomOutlinedIcon,
  TodayOutlinedIcon,
} from '@/icons/fluent';

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#0078d4',
  CHECKED_IN: '#f7630c',
  COMPLETED: '#107c10',
  CANCELLED: '#9e9e9e',
  NO_SHOW: '#d13438',
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  SCHEDULED: 'CHECKED_IN',
  CHECKED_IN: 'COMPLETED',
};

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: tokens.spacingVerticalM },
  greeting: { flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brandName: { color: tokens.colorBrandForeground1 },
  pills: { display: 'flex', flexDirection: 'row', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  pill: {
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'center',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  card: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tabBar: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  tabPanel: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  queue: { flex: 1, overflowY: 'auto' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: tokens.spacingVerticalS },
  row: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  actions: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: tokens.spacingHorizontalXS, flexShrink: 0 },
  surface: {
    maxWidth: '400px',
    width: '100%',
    borderRadius: tokens.borderRadiusMedium,
  },
  body: {
    padding: tokens.spacingVerticalL,
  },
  actionsBar: {
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
  },
});

export function DoctorDashboard(): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const canViewPatientHistory = can('managePatients');
  const canOrderLab = can('labDashboard');
  const showWaitingRoom = true;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';

  const [prescriptionToken, setPrescriptionToken] = useState<Token | null>(null);
  const [printToken, setPrintToken] = useState<Token | null>(null);
  const [noTokenPatient, setNoTokenPatient] = useState<{ patientId: string; patientName: string } | null>(null);
  const [issueTokenOpen, setIssueTokenOpen] = useState(false);
  const [issueTokenPatientId, setIssueTokenPatientId] = useState<string | undefined>();
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [contextDate, setContextDate] = useState<string | undefined>();
  const [ctxMenu, setCtxMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [apptCtxMenu, setApptCtxMenu] = useState<{ mouseX: number; mouseY: number; appointment: Appointment } | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [labOrder, setLabOrder] = useState<{ patientId: string; patientName: string; tokenId?: string } | null>(null);

  const { data: raw = [], isLoading: apptsLoading, isFetching: apptsFetching } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const appointments = (raw as Appointment[]).filter((a) => a.providerId === user?.id);

  const todayKey = new Date().toLocaleDateString('en-CA');
  const { data: todayTokens = [] } = useQuery<Token[]>({
    queryKey: ['tokens', todayKey],
    queryFn: () => window.clinic.tokens.list(todayKey),
    enabled: showWaitingRoom,
  });
  const waitingRoomCount = todayTokens.filter((t) => t.doctorId === user?.id && t.status === 'WAITING').length;

  async function openPrescription(appt: Appointment) {
    const apptDate = new Date(appt.startsAt).toLocaleDateString('en-CA');
    const token = await window.clinic.tokens.getForPatient(appt.patientId, apptDate);
    if (!token) {
      setNoTokenPatient({ patientId: appt.patientId, patientName: `${appt.patient.firstName} ${appt.patient.lastName}` });
      return;
    }
    setPrescriptionToken(token);
  }

  async function openLabOrder(appt: Appointment): Promise<void> {
    const apptDate = new Date(appt.startsAt).toLocaleDateString('en-CA');
    let tokenId: string | undefined;
    try {
      const token = await window.clinic.tokens.getForPatient(appt.patientId, apptDate);
      tokenId = token?.id;
    } catch { /* optional */ }
    setLabOrder({
      patientId: appt.patientId,
      patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
      tokenId,
    });
  }

  async function openPatientHistory(appt: Appointment): Promise<void> {
    setHistoryLoadingId(appt.id);
    try {
      const search = appt.patient?.firstName || appt.patientId;
      const res = await window.clinic.patients.list({ page: 1, pageSize: 50, search });
      const match = res.data.find((p) => p.id === appt.patientId);
      if (match) {
        setHistoryPatient(match);
        return;
      }
      setHistoryPatient({
        id: appt.patientId,
        mrNumber: '',
        firstName: appt.patient?.firstName ?? 'Patient',
        lastName: appt.patient?.lastName ?? '',
        dateOfBirth: null,
        phone: appt.patient?.phone ?? null,
        email: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        bloodGroup: null,
        allergies: null,
        chronicConditions: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch { /* ignore */ } finally {
      setHistoryLoadingId(null);
    }
  }

  const now = new Date();
  const byTokenDesc = (a: Appointment, b: Appointment) => {
    const ta = a.tokenNumber ?? -1;
    const tb = b.tokenNumber ?? -1;
    if (tb !== ta) return tb - ta;
    return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
  };

  const todaysQueue = appointments
    .filter((a) => {
      if (['CANCELLED', 'NO_SHOW'].includes(a.status)) return false;
      return new Date(a.startsAt).toLocaleDateString('en-CA') === todayKey;
    })
    .sort(byTokenDesc);

  const upcomingQueue = appointments
    .filter((a) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(a.status))
    .sort(byTokenDesc);

  const todayActiveCount = todaysQueue.filter((a) => a.status !== 'COMPLETED').length;

  const appointmentStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment['status']; appt?: Appointment }) =>
      appointmentsService.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['appointments'] });
      const prev = qc.getQueryData<Appointment[]>(['appointments']);
      qc.setQueryData(['appointments'], (old: Appointment[] | undefined) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status } : a)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['appointments'], ctx.prev);
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      if (variables.status !== 'COMPLETED') return;
      const appt =
        variables.appt ??
        (qc.getQueryData<Appointment[]>(['appointments']) ?? []).find((a) => a.id === variables.id) ??
        appointments.find((a) => a.id === variables.id);
      if (appt) await openPrescription(appt);
    },
    meta: { silent: true },
  });

  function renderQueueList(list: Appointment[], emptyLabel: string): React.JSX.Element {
    if (list.length === 0) {
      return (
        <div className={styles.empty}>
          <EventOutlinedIcon style={{ fontSize: 40 }} />
          <Text style={{ color: tokens.colorNeutralForeground2 }}>{emptyLabel}</Text>
        </div>
      );
    }

    return (
      <div className={styles.queue}>
        {list.map((appt, idx) => {
          const start = new Date(appt.startsAt);
          const end = new Date(appt.endsAt);
          const color = STATUS_COLOR[appt.status];
          const next = NEXT_STATUS[appt.status];
          const isPast = start < now;
          const isToday = start.toLocaleDateString('en-CA') === todayKey;
          const isCheckedIn = appt.status === 'CHECKED_IN';
          const isCompleted = appt.status === 'COMPLETED';

          return (
            <div key={appt.id}>
              {idx > 0 && <Divider />}
              <div
                className={styles.row}
                style={{
                  borderLeftColor: color,
                  backgroundColor: isCheckedIn ? 'rgba(247,99,12,0.05)' : 'transparent',
                  opacity: (isPast && appt.status === 'SCHEDULED') || isCompleted ? 0.7 : 1,
                }}
                onClick={() => navigate(`/appointments/${appt.id}`, { state: { from: '/dashboard' } })}
              >
                <Avatar
                  name={`${appt.patient.firstName} ${appt.patient.lastName}`}
                  style={{ width: 40, height: 40, fontSize: 13, fontWeight: 700, flexShrink: 0, backgroundColor: `${color}26`, color }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="bold" truncate style={{ display: 'block', fontSize: 14 }}>
                    {appt.patient.firstName} {appt.patient.lastName}
                    {appt.tokenNumber != null && Number(appt.tokenNumber) > 0 && (
                      <span style={{ color: tokens.colorBrandForeground1, fontFamily: 'monospace', fontWeight: 800, marginLeft: 6 }}>
                        #{String(appt.tokenNumber).padStart(3, '0')}
                      </span>
                    )}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AccessTimeOutlinedIcon style={{ fontSize: 12 }} />
                    <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                      {isToday ? '' : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} · `}
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {appt.reason && (
                      <Text size={200} truncate style={{ color: tokens.colorNeutralForeground3, maxWidth: 160 }}>· {appt.reason}</Text>
                    )}
                  </div>
                </div>
                <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                  <Badge appearance="tint" style={{ color, backgroundColor: `${color}1f` }}>
                    {appt.status.replace('_', ' ')}
                  </Badge>
                  <Tooltip content="Edit" relationship="label">
                    <Button appearance="subtle" size="small" icon={<EditOutlinedIcon style={{ fontSize: 15 }} />} onClick={() => { setEditAppt(appt); setApptDialogOpen(true); }} />
                  </Tooltip>
                  {canViewPatientHistory && (
                    <Tooltip content="Patient History" relationship="label">
                      <Button
                        appearance="subtle"
                        size="small"
                        disabled={historyLoadingId === appt.id}
                        icon={historyLoadingId === appt.id ? <Spinner size="tiny" /> : <HistoryOutlinedIcon style={{ fontSize: 15 }} />}
                        onClick={() => void openPatientHistory(appt)}
                      />
                    </Tooltip>
                  )}
                  {canOrderLab && appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW' && (
                    <Tooltip content="Order lab" relationship="label">
                      <Button appearance="subtle" size="small" icon={<BiotechOutlinedIcon style={{ fontSize: 15 }} />} onClick={() => void openLabOrder(appt)} />
                    </Tooltip>
                  )}
                  {isCompleted && (
                    <Tooltip content="Write Prescription" relationship="label">
                      <Button appearance="subtle" size="small" icon={<MedicalServicesOutlinedIcon style={{ fontSize: 15 }} />} onClick={() => void openPrescription(appt)} />
                    </Tooltip>
                  )}
                  {next && (
                    <Button
                      appearance="outline"
                      size="small"
                      icon={next === 'COMPLETED' ? <CheckCircleOutlineIcon style={{ fontSize: 13 }} /> : <ArrowForwardIcon style={{ fontSize: 13 }} />}
                      iconPosition="after"
                      disabled={appointmentStatusMutation.isPending && appointmentStatusMutation.variables?.id === appt.id}
                      onClick={() =>
                        appointmentStatusMutation.mutate({
                          id: appt.id,
                          status: next as Appointment['status'],
                          appt,
                        })
                      }
                      style={{ borderColor: STATUS_COLOR[next], color: STATUS_COLOR[next], fontSize: '0.7rem' }}
                    >
                      {next === 'CHECKED_IN' ? 'Check In' : 'Complete'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const pillStats = [
    { label: 'Scheduled', value: appointments.filter((a) => a.status === 'SCHEDULED').length, color: tokens.colorBrandForeground1 },
    { label: 'Checked In', value: appointments.filter((a) => a.status === 'CHECKED_IN').length, color: '#f7630c' },
    { label: 'Completed', value: appointments.filter((a) => a.status === 'COMPLETED').length, color: '#107c10' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div>
          <Title3>
            Good {greeting},{' '}
            <span className={styles.brandName}>{user?.name}</span>
          </Title3>
          <Text style={{ color: tokens.colorNeutralForeground2, marginTop: 2, display: 'block' }}>
            Here&apos;s your agenda for today.
          </Text>
        </div>
        <div className={styles.pills}>
          {pillStats.map((c) => (
            <div key={c.label} className={styles.pill} style={{ backgroundColor: `${c.color}1a`, borderColor: `${c.color}40` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <Text size={100} style={{ color: c.color, opacity: 0.8 }}>{c.label}</Text>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tabBar}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, d) => {
              const v = String(d.value);
              if (showWaitingRoom && v === 'waiting') {
                navigate('/waiting-room');
                return;
              }
              setActiveTab(v);
            }}
          >
            <Tab icon={<CalendarMonthOutlinedIcon style={{ fontSize: 15 }} />} value="calendar">Calendar & Agenda</Tab>
            <Tab icon={<TodayOutlinedIcon style={{ fontSize: 15 }} />} value="today">
              Today&apos;s Queue{todayActiveCount > 0 ? ` (${todayActiveCount})` : ''}
            </Tab>
            <Tab icon={<FormatListBulletedOutlinedIcon style={{ fontSize: 15 }} />} value="live">
              Live Queue{upcomingQueue.length > 0 ? ` (${upcomingQueue.length})` : ''}
            </Tab>
            {showWaitingRoom && (
              <Tab icon={<MeetingRoomOutlinedIcon style={{ fontSize: 15 }} />} value="waiting">
                Waiting Room{waitingRoomCount > 0 ? ` (${waitingRoomCount})` : ''}
              </Tab>
            )}
          </TabList>
        </div>

        <div className={styles.tabPanel} style={{ display: activeTab === 'calendar' ? 'flex' : 'none' }}>
          <AppointmentCalendar
            appointments={appointments}
            loading={apptsLoading}
            fetching={apptsFetching && !apptsLoading}
            statusPendingId={appointmentStatusMutation.isPending ? appointmentStatusMutation.variables?.id : null}
            onStatusChange={(id, status) => {
              const appt = appointments.find((a) => a.id === id);
              appointmentStatusMutation.mutate({ id, status: status as Appointment['status'], appt });
            }}
            onDayContextMenu={(date, anchor) => { setContextDate(date); setCtxMenu(anchor); }}
            onAppointmentContextMenu={(appt, anchor) => setApptCtxMenu({ ...anchor, appointment: appt })}
            onAppointmentClick={(appt) => navigate(`/appointments/${appt.id}`, { state: { from: '/dashboard' } })}
            onPrescriptionClick={(appt) => openPrescription(appt)}
            onPatientHistoryClick={canViewPatientHistory ? (appt) => openPatientHistory(appt) : undefined}
            onLabOrderClick={canOrderLab ? (appt) => openLabOrder(appt) : undefined}
          />
        </div>
        <div className={styles.tabPanel} style={{ display: activeTab === 'today' ? 'flex' : 'none' }}>
          {renderQueueList(todaysQueue, "No patients in today's queue.")}
        </div>
        <div className={styles.tabPanel} style={{ display: activeTab === 'live' ? 'flex' : 'none' }}>
          {renderQueueList(upcomingQueue, 'No upcoming appointments.')}
        </div>
      </div>

      {prescriptionToken && <PrescriptionPadDialog token={prescriptionToken} onClose={() => setPrescriptionToken(null)} />}
      {printToken && <TokenPrintPreview token={printToken} onClose={() => setPrintToken(null)} />}

      <Dialog open={Boolean(noTokenPatient)} onOpenChange={(_, d) => { if (!d.open) setNoTokenPatient(null); }}>
        <DialogSurface className={styles.surface}>
          <FormDialogTitle title="Token Not Found" subtitle="No token has been generated for this patient today." />
          <DialogBody>
            <DialogContent className={styles.body}>
              <Text>
                No token has been generated for <strong>{noTokenPatient?.patientName}</strong> today. You can issue one now or ask the receptionist.
              </Text>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={() => setNoTokenPatient(null)}>Cancel</Button>
            <SubmitButton onClick={() => { setIssueTokenPatientId(noTokenPatient?.patientId); setIssueTokenOpen(true); setNoTokenPatient(null); }}>
              Issue Token
            </SubmitButton>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      <IssueTokenDialog
        open={issueTokenOpen}
        onClose={() => setIssueTokenOpen(false)}
        date={new Date().toLocaleDateString('en-CA')}
        defaultPatientId={issueTokenPatientId}
        defaultDoctorId={user?.id}
        onSuccess={(token) => setPrescriptionToken(token)}
      />

      {apptCtxMenu && (
        <div
          style={{ position: 'fixed', left: apptCtxMenu.mouseX, top: apptCtxMenu.mouseY, zIndex: 1000 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Menu open onOpenChange={(_, d) => { if (!d.open) setApptCtxMenu(null); }}>
            <MenuTrigger disableButtonEnhancement>
              <span />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem disabled>
                  {apptCtxMenu.appointment.patient.firstName} {apptCtxMenu.appointment.patient.lastName}
                </MenuItem>
                {canViewPatientHistory && (
                  <MenuItem icon={<HistoryOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => { const a = apptCtxMenu.appointment; setApptCtxMenu(null); void openPatientHistory(a); }}>
                    Patient History
                  </MenuItem>
                )}
                <MenuItem icon={<EditOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => { setEditAppt(apptCtxMenu.appointment); setApptCtxMenu(null); setApptDialogOpen(true); }}>
                  Edit Appointment
                </MenuItem>
                {canOrderLab && apptCtxMenu.appointment.status !== 'CANCELLED' && apptCtxMenu.appointment.status !== 'NO_SHOW' && (
                  <MenuItem icon={<BiotechOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => { const a = apptCtxMenu.appointment; setApptCtxMenu(null); void openLabOrder(a); }}>
                    Order lab
                  </MenuItem>
                )}
                {apptCtxMenu.appointment.status === 'COMPLETED' && (
                  <MenuItem icon={<MedicalServicesOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => { const a = apptCtxMenu.appointment; setApptCtxMenu(null); void openPrescription(a); }}>
                    Write Prescription
                  </MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      )}

      {canViewPatientHistory && historyPatient && (
        <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />
      )}

      {user && (
        <OrderLabDialog
          open={Boolean(labOrder)}
          patientId={labOrder?.patientId ?? ''}
          patientName={labOrder?.patientName ?? ''}
          orderedById={user.id}
          tokenId={labOrder?.tokenId}
          onClose={() => setLabOrder(null)}
        />
      )}

      {ctxMenu && (
        <div style={{ position: 'fixed', left: ctxMenu.mouseX, top: ctxMenu.mouseY, zIndex: 1000 }}>
          <Menu open onOpenChange={(_, d) => { if (!d.open) setCtxMenu(null); }}>
            <MenuTrigger disableButtonEnhancement>
              <span />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<EventOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => { setCtxMenu(null); setEditAppt(undefined); setApptDialogOpen(true); }}>
                  New Appointment
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      )}

      <AppointmentDialog
        open={apptDialogOpen}
        appointment={editAppt}
        defaultDate={contextDate}
        defaultProviderId={user?.id}
        onClose={() => { setApptDialogOpen(false); setEditAppt(undefined); }}
      />
    </div>
  );
}
