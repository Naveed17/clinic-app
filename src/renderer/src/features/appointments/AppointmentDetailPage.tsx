import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Spinner,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog } from '@/components/DialogUI';
import { StatusBadge } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { AppointmentDialog } from '@/features/appointments/AppointmentsPage';
import { appointmentsService } from '@/services/appointments.service';
import type { Appointment } from '@/types/appointment';
import {
  AccessTimeOutlinedIcon,
  ArrowBackOutlinedIcon,
  CalendarMonthOutlinedIcon,
  CancelOutlinedIcon,
  CheckCircleOutlinedIcon,
  ConfirmationNumberOutlinedIcon,
  DeleteOutlineIcon,
  EditOutlinedIcon,
  LocalPhoneOutlinedIcon,
  LoginOutlinedIcon,
  NotesOutlinedIcon,
  PersonOffOutlinedIcon,
  PersonOutlinedIcon,
  RepeatOutlinedIcon,
} from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<string, { label: string; color: StatusColor }> = {
  SCHEDULED: { label: 'Scheduled', color: 'brand' },
  CHECKED_IN: { label: 'Checked In', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'subtle' },
  NO_SHOW: { label: 'No Show', color: 'danger' },
};

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalS,
  },
  notFound: {
    padding: tokens.spacingVerticalXXL,
  },
  backBtn: {
    marginTop: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  backIconBtn: {
    marginTop: tokens.spacingVerticalXXS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  eyebrow: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  titleRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXXS,
  },
  title: {
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightMedium,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  statsGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    position: 'relative',
    overflow: 'hidden',
  },
  statBlob: {
    position: 'absolute',
    top: '-18px',
    right: '-18px',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
  },
  statInner: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  caption: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  statValue: {
    marginTop: tokens.spacingVerticalXXS,
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeHero700,
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  cardPad: {
    padding: tokens.spacingVerticalXL,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightBold,
    marginBottom: tokens.spacingVerticalL,
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },
  rowIconBox: {
    width: '34px',
    height: '34px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  doctorValue: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  dangerBtn: {
    color: tokens.colorPaletteRedForeground1,
  },
});

function personName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export function AppointmentDetailPage(): React.JSX.Element {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 88, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 220, borderRadius: 12 }} />
      </div>
    );
  }

  if (!appointment || forbidden) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Appointment not found.</MessageBarBody>
        </MessageBar>
        <Button
          className={styles.backBtn}
          appearance="secondary"
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back to Appointments
        </Button>
      </div>
    );
  }

  const status = statusConfig[appointment.status] ?? { label: appointment.status, color: 'subtle' as const };
  const closed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);
  const patientLabel = personName(appointment.patient.firstName, appointment.patient.lastName);
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

  const colors = {
    primary: tokens.colorBrandForeground1,
    info: tokens.colorPaletteBlueForeground2,
    warning: tokens.colorPaletteDarkOrangeForeground1,
    success: tokens.colorPaletteGreenForeground1,
  };

  const summaryCards = [
    {
      label: 'Date',
      value: new Date(appointment.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      note: new Date(appointment.startsAt).toLocaleDateString([], { weekday: 'long' }),
      icon: <CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.primary,
    },
    {
      label: 'Time',
      value: new Date(appointment.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: `Until ${new Date(appointment.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      icon: <AccessTimeOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.info,
    },
    {
      label: 'Token',
      value: tokenLabel,
      note: 'Same-day queue',
      icon: <ConfirmationNumberOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.warning,
    },
    {
      label: 'Status',
      value: status.label,
      note: 'Current',
      icon: <CheckCircleOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.success,
    },
  ];

  const detailRows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <PersonOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Doctor',
      value: (
        <div className={styles.doctorValue}>
          <DoctorAvatar src={appointment.provider.avatar} name={doctorLabel} size={28} />
          <Text weight="semibold">{doctorLabel}</Text>
        </div>
      ),
    },
    {
      icon: <LocalPhoneOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Patient phone',
      value: appointment.patient.phone || '—',
    },
    {
      icon: <NotesOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Reason',
      value: appointment.reason || '—',
    },
    {
      icon: <NotesOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Notes',
      value: appointment.notes || '—',
    },
    ...(appointment.recurrenceRule
      ? [
          {
            icon: <RepeatOutlinedIcon style={{ fontSize: 18 }} />,
            label: 'Recurrence',
            value: appointment.recurrenceRule,
          },
        ]
      : []),
  ];

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tooltip content="Back" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => goBack()}
                className={styles.backIconBtn}
              />
            </Tooltip>
            <div>
              <Text className={styles.eyebrow}>Appointment details</Text>
              <div className={styles.titleRow}>
                <Title3 className={styles.title}>{patientLabel}</Title3>
                <StatusBadge color={status.color}>{status.label}</StatusBadge>
              </div>
              <Text className={styles.subtitle}>
                {dateLabel} · {timeLabel}
              </Text>
            </div>
          </div>

          <div className={styles.actions}>
            {(user?.role === 'receptionist' || user?.role === 'doctor' || user?.role === 'lab_technician') && (
              <Button appearance="secondary" onClick={() => navigate(`/patients/${appointment.patientId}`)}>
                Open patient
              </Button>
            )}
            {!closed && (
              <Button
                appearance="primary"
                icon={<EditOutlinedIcon />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            )}
            {appointment.status === 'SCHEDULED' && (
              <Button
                appearance="secondary"
                icon={statusMutation.isPending ? <Spinner size="tiny" /> : <LoginOutlinedIcon />}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('CHECKED_IN')}
              >
                Check in
              </Button>
            )}
            {appointment.status === 'CHECKED_IN' && (
              <Button
                appearance="secondary"
                icon={statusMutation.isPending ? <Spinner size="tiny" /> : <CheckCircleOutlinedIcon />}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('COMPLETED')}
              >
                Complete
              </Button>
            )}
            {['SCHEDULED', 'CHECKED_IN'].includes(appointment.status) && (
              <>
                <Button
                  appearance="secondary"
                  icon={statusMutation.isPending ? <Spinner size="tiny" /> : <PersonOffOutlinedIcon />}
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate('NO_SHOW')}
                >
                  No show
                </Button>
                <Button
                  appearance="secondary"
                  icon={cancelMutation.isPending ? <Spinner size="tiny" /> : <CancelOutlinedIcon />}
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              appearance="secondary"
              className={styles.dangerBtn}
              icon={<DeleteOutlineIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          {summaryCards.map((c) => (
            <div key={c.label} className={`${styles.softCard} ${styles.statCard}`}>
              <div className={styles.statBlob} style={{ backgroundColor: `${c.color}1a` }} />
              <div className={styles.statInner}>
                <div>
                  <Text className={styles.caption}>{c.label}</Text>
                  <Text className={styles.statValue} block>
                    {c.value}
                  </Text>
                  <Text className={styles.caption}>{c.note}</Text>
                </div>
                <div
                  className={styles.iconBox}
                  style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                >
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`${styles.softCard} ${styles.cardPad}`}>
          <Text className={styles.sectionTitle} block>
            Visit details
          </Text>
          <div className={styles.rows}>
            {detailRows.map((row) => (
              <div key={row.label} className={styles.row}>
                <div className={styles.rowIconBox}>{row.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <Text className={styles.caption}>{row.label}</Text>
                  {typeof row.value === 'string' ? (
                    <Text weight="semibold" style={{ wordBreak: 'break-word' }}>
                      {row.value}
                    </Text>
                  ) : (
                    row.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
    </>
  );
}
