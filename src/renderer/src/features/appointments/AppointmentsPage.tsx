import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Switch,
  TableCellLayout,
  Text,
  Textarea,
  Tooltip,
  createTableColumn,
  makeStyles,
  tokens,
  type BadgeProps,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import {
  Add24Regular,
  ArrowRepeatAll24Regular,
  CalendarLtr24Regular,
  CheckmarkCircle24Regular,
  Delete24Regular,
  DismissCircle24Regular,
  Edit24Regular,
  Eye24Regular,
  PersonArrowRight24Regular,
  PersonDelete24Regular,
  Table24Regular,
} from '@fluentui/react-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import { FluentDateField, FluentTimeField, formatDateIso, parseDateIso } from '@/components/FluentDateField';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import type { Appointment, AppointmentInput, AppointmentPerson } from '@/types/appointment';
import type { Token, TokenPerson } from '@/types/token';
import { TokenFeeFields } from '@/features/tokens/TokenFeeFields';
import { nextFreeSlot, doctorOfflineReason, slotSearchFrom, type SlotAdjustReason } from '@/utils/appointmentSlot';
import {
  actionBtnStyle,
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog, FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<string, { label: string; color: StatusColor }> = {
  SCHEDULED: { label: 'Scheduled', color: 'brand' },
  CHECKED_IN: { label: 'Checked In', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'subtle' },
  NO_SHOW: { label: 'No Show', color: 'danger' },
};

type FormValues = {
  patientId: string;
  providerId: string;
  tokenId: string;
  date: string;
  time: string;
  duration: number;
  reason: string;
  notes: string;
  recurring: boolean;
  recurrenceCount: number;
};

const empty: FormValues = {
  patientId: '',
  providerId: '',
  tokenId: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  duration: 30,
  reason: '',
  notes: '',
  recurring: false,
  recurrenceCount: 4,
};

function appointmentValues(appointment?: Appointment): FormValues {
  if (!appointment) return empty;
  const startsAt = new Date(appointment.startsAt);
  return {
    patientId: appointment.patientId,
    providerId: appointment.providerId,
    tokenId: '',
    date: startsAt.toLocaleDateString('en-CA'),
    time: startsAt.toTimeString().slice(0, 5),
    duration: Math.max(15, Math.round((new Date(appointment.endsAt).getTime() - startsAt.getTime()) / 60000)),
    reason: appointment.reason ?? '',
    notes: appointment.notes ?? '',
    recurring: false,
    recurrenceCount: 4,
  };
}

function personLabel(person: AppointmentPerson): string {
  return `${person.firstName} ${person.lastName}`;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionsBar: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr 1fr',
  },
  personMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  name: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  muted: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalXXS,
    justifyContent: 'flex-end',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  filter: {
    minWidth: '150px',
    flexShrink: 0,
  },
  errorBar: {
    marginLeft: tokens.spacingHorizontalL,
    marginRight: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalS,
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  calendarPage: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    flex: 1,
    minHeight: 0,
  },
  calendarHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  titles: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  viewToggle: {
    display: 'flex',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  calendarCard: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tokenWarn: {
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    border: `1px dashed ${tokens.colorPaletteYellowBorder2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  tokenWarnTitle: {
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteYellowForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  tokenRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end',
    marginTop: tokens.spacingVerticalS,
  },
  doctorOption: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    width: '100%',
  },
  doctorFee: {
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  recurringRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  mono: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontWeight: tokens.fontWeightBold,
  },
});

function IssueTokenInline({
  patientId,
  date,
  providerId,
  onIssued,
}: {
  patientId: string;
  date: string;
  providerId: string;
  onIssued: (token: Token) => void;
}): React.JSX.Element {
  const styles = useStyles();
  const qc = useQueryClient();
  const { can } = useLicense();
  const showLabReason = can('labDashboard');
  const [reason, setReason] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [feeDiscount, setFeeDiscount] = useState('');
  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });
  useEffect(() => {
    const doctor = doctors.find((d) => d.id === providerId);
    if (doctor) {
      setConsultationFee(String(Number(doctor.consultationFee ?? 0)));
      setFeeDiscount('');
    }
  }, [providerId, doctors]);
  const { data: weekVisits } = useQuery({
    queryKey: ['token-week-visits', patientId, providerId, date],
    queryFn: () =>
      window.clinic.tokens.weekVisits(patientId, providerId, date).catch(() => ({ count: 0 })),
    enabled: Boolean(patientId && providerId && date),
  });
  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.tokens.create({
        patientId,
        doctorId: providerId,
        date,
        reason: reason || null,
        consultationFee: parseFloat(consultationFee) || 0,
        feeDiscount: parseFloat(feeDiscount) || 0,
      }) as Promise<Token>,
    onSuccess: (token) => {
      void qc.invalidateQueries({ queryKey: ['token-for-patient', patientId, date] });
      void qc.invalidateQueries({ queryKey: ['tokens'] });
      onIssued(token);
    },
    meta: { silent: true },
  });
  const reasonLabel = reason || '— None —';
  return (
    <div className={styles.tokenWarn}>
      <Text className={styles.tokenWarnTitle}>No token found — issue one now</Text>
      <TokenFeeFields
        consultationFee={consultationFee}
        feeDiscount={feeDiscount}
        onFeeChange={setConsultationFee}
        onDiscountChange={setFeeDiscount}
        priorVisitsThisWeek={weekVisits?.count ?? 0}
        compact
      />
      <div className={styles.tokenRow}>
        <Field label="Reason (optional)" style={{ flex: 1 }}>
          <Dropdown
            value={reasonLabel}
            selectedOptions={[reason]}
            onOptionSelect={(_, data) => {
              if (data.optionValue !== undefined) setReason(data.optionValue);
            }}
          >
            <Option value="" text="— None —">— None —</Option>
            <Option value="Checkup" text="Checkup">Checkup</Option>
            <Option value="Follow-up" text="Follow-up">Follow-up</Option>
            <Option value="Urgent" text="Urgent">Urgent</Option>
            <Option value="Consultation" text="Consultation">Consultation</Option>
            {showLabReason && <Option value="Lab Results" text="Lab Results">Lab Results</Option>}
            <Option value="Vaccination" text="Vaccination">Vaccination</Option>
          </Dropdown>
        </Field>
        <Button
          appearance="primary"
          disabled={!providerId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Issue Token
        </Button>
      </div>
      {mutation.isError && (
        <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalS }}>
          <MessageBarBody>
            {(mutation.error as Error)?.message || 'Failed to issue token.'}
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

export function AppointmentDialog({
  appointment,
  open,
  onClose,
  defaultDate,
  defaultProviderId,
  onSuccess,
}: {
  appointment?: Appointment;
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultProviderId?: string;
  onSuccess?: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { can } = useLicense();
  const showLabReason = can('labDashboard');
  const [slotNotice, setSlotNotice] = useState<SlotAdjustReason | null>(null);
  const isEdit = !!appointment;
  const schema = z.object({
    patientId: z.string().min(1, 'Select a patient.'),
    providerId: z.string().min(1, 'Select a doctor.'),
    tokenId: isEdit ? z.string() : z.string().min(1, 'Token is required. Please issue a token first.'),
    date: z.string().min(1, 'Select a date.'),
    time: z.string().min(1, 'Select a time.'),
    duration: z.number().min(15).max(240),
    reason: z.string(),
    notes: z.string(),
    recurring: z.boolean(),
    recurrenceCount: z.number().min(2).max(52),
  });
  type DialogFormValues = z.infer<typeof schema>;
  const form = useForm<DialogFormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const patients = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1000 }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: appointmentsService.doctors,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  function feeLabel(fee?: number): string {
    return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(fee) || 0)}`;
  }

  function asArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object' && 'data' in value && Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: T[] }).data;
    }
    return [];
  }
  const patientOptions = asArray<AppointmentPerson>(patients.data);
  const doctorOptions = asArray<AppointmentPerson>(doctors.data);
  const patientId = form.watch('patientId');
  const date = form.watch('date');
  const providerId = form.watch('providerId');
  const duration = form.watch('duration');
  const reason = form.watch('reason');
  const recurring = form.watch('recurring');

  const { data: tokenForPatient } = useQuery<Token | null>({
    queryKey: ['token-for-patient', patientId, date],
    queryFn: () => window.clinic.tokens.getForPatient(patientId, date) as Promise<Token | null>,
    enabled: !appointment && !!patientId && !!date,
  });

  const { data: schedule = [], isFetched: scheduleFetched } = useQuery({
    queryKey: ['schedule', providerId],
    queryFn: () => window.clinic.schedule.get(providerId),
    enabled: open && Boolean(providerId),
  });
  const { data: allAppts = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
    enabled: open,
  });
  const doctorAppts = allAppts as Appointment[];
  const hoursLabel = useMemo(() => {
    if (!date || schedule.length === 0) return null;
    const day = new Date(`${date}T12:00:00`).getDay();
    const slot = schedule.find((s) => s.dayOfWeek === day);
    return slot?.isActive ? `${slot.startTime}–${slot.endTime}` : null;
  }, [schedule, date]);
  const offlineReason =
    open && providerId && date && scheduleFetched ? doctorOfflineReason(schedule, date) : null;

  useEffect(() => {
    if (!appointment) form.setValue('tokenId', tokenForPatient?.id ?? '');
  }, [tokenForPatient, appointment, form]);

  const mutation = useMutation({
    mutationFn: (values: DialogFormValues) => {
      const startsAt = new Date(`${values.date}T${values.time}:00`);
      const input: AppointmentInput = {
        patientId: values.patientId,
        providerId: values.providerId,
        tokenId: values.tokenId || null,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + values.duration * 60000).toISOString(),
        reason: values.reason || null,
        notes: values.notes || null,
        recurrenceRule: values.recurring ? `WEEKLY:${values.recurrenceCount}` : null,
      };
      return appointment ? appointmentsService.update(appointment.id, input) : appointmentsService.create(input);
    },
    onSuccess: (saved, values) => {
      if (saved && typeof saved === 'object' && 'id' in saved) {
        const patient = patientOptions.find((p) => p.id === values.patientId);
        const provider = doctorOptions.find((d) => d.id === values.providerId);
        queryClient.setQueryData(['appointments'], (old: Appointment[] | undefined) => {
          const list = old ?? [];
          const raw = saved as Appointment;
          const next: Appointment = {
            ...raw,
            patient:
              raw.patient ?? patient ?? { id: values.patientId, firstName: '', lastName: '', role: 'patient' },
            provider:
              raw.provider ?? provider ?? { id: values.providerId, firstName: '', lastName: '', role: 'doctor' },
            status: raw.status ?? 'SCHEDULED',
          };
          const idx = list.findIndex((a) => a.id === next.id);
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = { ...list[idx], ...next };
            return copy;
          }
          return [next, ...list];
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
      onSuccess?.();
    },
    meta: { silent: true },
  });

  useEffect(() => {
    if (!open) return;
    setSlotNotice(null);
    if (appointment) {
      form.reset(appointmentValues(appointment));
    } else {
      form.reset({
        ...empty,
        date: defaultDate ?? empty.date,
        providerId: defaultProviderId ?? empty.providerId,
      });
    }
  }, [appointment, defaultDate, defaultProviderId, form, open]);

  useEffect(() => {
    if (!open || appointment || !providerId) return;
    const next = nextFreeSlot({
      schedule,
      appointments: doctorAppts,
      providerId,
      durationMin: duration || 30,
      from: slotSearchFrom(defaultDate),
    });
    if (!next) return;
    form.setValue('date', next.date);
    form.setValue('time', next.time);
    setSlotNotice(null);
  }, [open, appointment, providerId, duration, schedule, doctorAppts, defaultDate, form]);

  const { errors } = form.formState;
  const selectedPatient = patientOptions.find((p) => p.id === patientId) ?? null;
  const selectedDoctor = doctorOptions.find((p) => p.id === providerId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={appointment ? 'Update appointment' : 'Create appointment'}
          subtitle={appointment ? 'Edit schedule, doctor, and visit details.' : 'Book a new patient visit.'}
        />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((v) => {
            if (offlineReason) return;
            mutation.mutate(v);
          })}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      {(mutation.error as Error)?.message || 'Unable to save the appointment.'}
                    </MessageBarBody>
                  </MessageBar>
                )}
                {offlineReason && (
                  <MessageBar intent="warning">
                    <MessageBarBody>{offlineReason}</MessageBarBody>
                  </MessageBar>
                )}
                {slotNotice === 'busy' && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      This time is already booked. Moved 30 minutes forward, or to the end of the current visit.
                    </MessageBarBody>
                  </MessageBar>
                )}
                {slotNotice === 'schedule' && (
                  <MessageBar intent="info">
                    <MessageBarBody>
                      {hoursLabel
                        ? `Outside doctor hours (${hoursLabel}). Moved to the next available time.`
                        : 'This day is off in Doctor Schedule. Moved to the next working day.'}
                    </MessageBarBody>
                  </MessageBar>
                )}

                <Field
                  label="Patient"
                  validationState={errors.patientId ? 'error' : undefined}
                  validationMessage={errors.patientId?.message}
                >
                  <Combobox
                    placeholder="Select patient"
                    value={selectedPatient ? personLabel(selectedPatient) : ''}
                    selectedOptions={patientId ? [patientId] : []}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) form.setValue('patientId', data.optionValue, { shouldValidate: true });
                    }}
                  >
                    {patientOptions.map((p) => (
                      <Option key={p.id} value={p.id} text={personLabel(p)}>
                        {personLabel(p)}
                      </Option>
                    ))}
                  </Combobox>
                </Field>

                <Field
                  label="Doctor"
                  validationState={errors.providerId ? 'error' : undefined}
                  validationMessage={errors.providerId?.message}
                >
                  <Combobox
                    placeholder="Select doctor"
                    value={selectedDoctor ? personLabel(selectedDoctor) : ''}
                    selectedOptions={providerId ? [providerId] : []}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) form.setValue('providerId', data.optionValue, { shouldValidate: true });
                    }}
                  >
                    {doctorOptions.map((d) => (
                      <Option key={d.id} value={d.id} text={personLabel(d)}>
                        <div className={styles.doctorOption}>
                          <DoctorAvatar src={d.avatar} name={`Dr. ${personLabel(d)}`} size={28} />
                          <Text weight="semibold" size={300}>
                            {personLabel(d)}
                          </Text>
                          <Text size={200} className={styles.doctorFee}>
                            {feeLabel(d.consultationFee)}
                          </Text>
                        </div>
                      </Option>
                    ))}
                  </Combobox>
                </Field>

                {!appointment && (
                  <div>
                    <Field
                      label="Token"
                      validationState={errors.tokenId ? 'error' : undefined}
                      validationMessage={
                        errors.tokenId?.message ?? (tokenForPatient ? 'Token auto-linked' : undefined)
                      }
                    >
                      <Input
                        readOnly
                        value={
                          tokenForPatient
                            ? `#${String(tokenForPatient.tokenNumber).padStart(3, '0')} — ${tokenForPatient.patient.firstName} ${tokenForPatient.patient.lastName}`
                            : ''
                        }
                        placeholder={
                          patientId && date
                            ? 'No token found for this patient on selected date'
                            : 'Select patient and date first'
                        }
                      />
                    </Field>
                    {patientId && date && !tokenForPatient && !offlineReason && (
                      <IssueTokenInline
                        patientId={patientId}
                        date={date}
                        providerId={form.watch('providerId')}
                        onIssued={(t) => form.setValue('tokenId', t.id)}
                      />
                    )}
                  </div>
                )}

                <div className={styles.grid2}>
                  <Controller
                    name="date"
                    control={form.control}
                    render={({ field }) => (
                      <FluentDateField
                        label="Date"
                        value={parseDateIso(field.value)}
                        validationState={errors.date ? 'error' : undefined}
                        validationMessage={errors.date?.message}
                        onSelectDate={(value) => {
                          if (!value) {
                            field.onChange('');
                            return;
                          }
                          if (!providerId) {
                            field.onChange(formatDateIso(value));
                            return;
                          }
                          const dateStr = formatDateIso(value);
                          const next = nextFreeSlot({
                            schedule,
                            appointments: doctorAppts,
                            providerId,
                            durationMin: duration || 30,
                            from: slotSearchFrom(dateStr),
                            excludeId: appointment?.id,
                          });
                          if (next) {
                            field.onChange(next.date);
                            form.setValue('time', next.time);
                            setSlotNotice(next.reason);
                          } else {
                            field.onChange(formatDateIso(value));
                          }
                        }}
                      />
                    )}
                  />
                  <Controller
                    name="time"
                    control={form.control}
                    render={({ field }) => (
                      <FluentTimeField
                        label="Time"
                        selectedTime={field.value ? new Date(`1970-01-01T${field.value}:00`) : null}
                        value={field.value}
                        validationState={errors.time ? 'error' : undefined}
                        validationMessage={errors.time?.message}
                        onTimeChange={(_, data) => {
                          const picked = data.selectedTime
                            ? data.selectedTime.toTimeString().slice(0, 5)
                            : '';
                          if (!picked || !providerId || !date) {
                            field.onChange(picked);
                            return;
                          }
                          const next = nextFreeSlot({
                            schedule,
                            appointments: doctorAppts,
                            providerId,
                            durationMin: duration || 30,
                            from: new Date(`${date}T${picked}:00`),
                            excludeId: appointment?.id,
                          });
                          if (next) {
                            form.setValue('date', next.date);
                            field.onChange(next.time);
                            setSlotNotice(next.reason);
                          } else {
                            field.onChange(picked);
                          }
                        }}
                      />
                    )}
                  />
                </div>

                <Field label="Duration (minutes)">
                  <Input type="number" {...form.register('duration', { valueAsNumber: true })} />
                </Field>
                <Field label="Reason">
                  <Dropdown
                    value={reason || '— None —'}
                    selectedOptions={[reason]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue !== undefined) form.setValue('reason', data.optionValue);
                    }}
                  >
                    <Option value="" text="— None —">— None —</Option>
                    <Option value="Checkup" text="Checkup">Checkup</Option>
                    <Option value="Follow-up" text="Follow-up">Follow-up</Option>
                    <Option value="Urgent" text="Urgent">Urgent</Option>
                    <Option value="Consultation" text="Consultation">Consultation</Option>
                    {showLabReason && <Option value="Lab Results" text="Lab Results">Lab Results</Option>}
                    <Option value="Vaccination" text="Vaccination">Vaccination</Option>
                  </Dropdown>
                </Field>
                <Field label="Notes">
                  <Textarea rows={2} {...form.register('notes')} />
                </Field>

                {!appointment && (
                  <div>
                    <div className={styles.recurringRow}>
                      <Switch
                        checked={recurring}
                        onChange={(_, data) => form.setValue('recurring', data.checked)}
                      />
                      <ArrowRepeatAll24Regular style={{ fontSize: 16 }} />
                      <Text size={300}>Repeat weekly</Text>
                    </div>
                    {recurring && (
                      <Field
                        label="Number of weeks"
                        hint={`Will create ${form.watch('recurrenceCount')} appointments, one per week`}
                        style={{ marginTop: tokens.spacingVerticalS }}
                      >
                        <Input
                          type="number"
                          min={2}
                          max={52}
                          {...form.register('recurrenceCount', { valueAsNumber: true })}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending} type="button">
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending} disabled={Boolean(offlineReason)}>
              {appointment ? 'Save changes' : 'Create appointment'}
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

export function AppointmentsPage(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Appointment | undefined>();
  const [open, setOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const view: 'table' | 'calendar' = searchParams.get('view') === 'calendar' ? 'calendar' : 'table';
  const setView = (next: 'table' | 'calendar') => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'calendar') p.set('view', 'calendar');
        else p.delete('view');
        return p;
      },
      { replace: true },
    );
  };
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const detailNavState = { from: `${location.pathname}${location.search}` };

  const [deleteTarget, setDeleteTarget] = useState<Appointment | undefined>();
  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const cancelMutation = useMutation({
    mutationFn: appointmentsService.cancel,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData<Appointment[]>(['appointments']);
      queryClient.setQueryData(['appointments'], (old: Appointment[] | undefined) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status: 'CANCELLED' as const } : a)),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['appointments'], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    meta: { silent: true },
  });
  const deleteMutation = useMutation({
    mutationFn: appointmentsService.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData<Appointment[]>(['appointments']);
      queryClient.setQueryData(['appointments'], (old: Appointment[] | undefined) =>
        (old ?? []).filter((a) => a.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['appointments'], ctx.prev);
    },
    onSuccess: () => setDeleteTarget(undefined),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    meta: { silent: true },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsService.updateStatus(id, status as Appointment['status']),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData<Appointment[]>(['appointments']);
      queryClient.setQueryData(['appointments'], (old: Appointment[] | undefined) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status: status as Appointment['status'] } : a)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['appointments'], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    meta: { silent: true },
  });

  const allData =
    user?.role === 'doctor'
      ? (appointments.data ?? []).filter((a) => a.providerId === user.id)
      : (appointments.data ?? []);
  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allData) {
      if (!map.has(a.providerId)) {
        map.set(a.providerId, `${a.provider.firstName} ${a.provider.lastName}`);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allData]);
  const filtered = allData.filter((a) => {
    if (doctorFilter !== 'ALL' && a.providerId !== doctorFilter) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase().includes(q) ||
      `${a.provider.firstName} ${a.provider.lastName}`.toLowerCase().includes(q) ||
      (a.reason ?? '').toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const showDoctorFilter = user?.role !== 'doctor';
  const doctorFilterLabel =
    doctorFilter === 'ALL'
      ? 'All doctors'
      : (doctorOptions.find(([id]) => id === doctorFilter)?.[1] ?? 'All doctors');
  const statusFilterLabel =
    statusFilter === 'ALL'
      ? 'All statuses'
      : (statusConfig[statusFilter]?.label ?? statusFilter);

  const appointmentFilters = (
    <div className={styles.toolbar}>
      <SearchField
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        placeholder="Search patient, doctor, reason..."
      />
      {showDoctorFilter && (
        <Dropdown
          className={styles.filter}
          value={doctorFilterLabel}
          selectedOptions={[doctorFilter]}
          onOptionSelect={(_, data) => {
            if (data.optionValue) {
              setDoctorFilter(data.optionValue);
              setPage(0);
            }
          }}
        >
          <Option value="ALL" text="All doctors">All doctors</Option>
          {doctorOptions.map(([id, name]) => (
            <Option key={id} value={id} text={name}>
              {name}
            </Option>
          ))}
        </Dropdown>
      )}
      <Dropdown
        className={styles.filter}
        value={statusFilterLabel}
        selectedOptions={[statusFilter]}
        onOptionSelect={(_, data) => {
          if (data.optionValue) {
            setStatusFilter(data.optionValue);
            setPage(0);
          }
        }}
      >
        <Option value="ALL" text="All statuses">All statuses</Option>
        {Object.entries(statusConfig).map(([value, cfg]) => (
          <Option key={value} value={value} text={cfg.label}>
            {cfg.label}
          </Option>
        ))}
      </Dropdown>
    </div>
  );

  const viewToggle = (
    <div className={styles.viewToggle}>
      <Tooltip content="Table view" relationship="label">
        <Button
          appearance={view === 'table' ? 'primary' : 'subtle'}
          icon={<Table24Regular />}
          onClick={() => setView('table')}
          style={{ borderRadius: 0 }}
        />
      </Tooltip>
      <Tooltip content="Calendar view" relationship="label">
        <Button
          appearance={view === 'calendar' ? 'primary' : 'subtle'}
          icon={<CalendarLtr24Regular />}
          onClick={() => setView('calendar')}
          style={{ borderRadius: 0 }}
        />
      </Tooltip>
    </div>
  );

  const columns = useMemo<TableColumnDefinition<Appointment>[]>(() => {
    const cols: TableColumnDefinition<Appointment>[] = [
      createTableColumn<Appointment>({
        columnId: 'patient',
        compare: (a, b) => personLabel(a.patient).localeCompare(personLabel(b.patient)),
        renderHeaderCell: () => 'Patient',
        renderCell: (a) => (
          <TableCellLayout
            media={<Avatar name={personLabel(a.patient)} color="brand" size={32} />}
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>{personLabel(a.patient)}</Text>
              <Text className={styles.muted}>{a.patient.phone ?? '—'}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Appointment>({
        columnId: 'doctor',
        compare: (a, b) => personLabel(a.provider).localeCompare(personLabel(b.provider)),
        renderHeaderCell: () => 'Doctor',
        renderCell: (a) => (
          <TableCellLayout
            media={
              <DoctorAvatar
                src={a.provider.avatar}
                name={`Dr. ${a.provider.firstName} ${a.provider.lastName}`}
                size={34}
              />
            }
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>{personLabel(a.provider)}</Text>
              <Text className={styles.muted}>{a.provider.role ?? 'Doctor'}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Appointment>({
        columnId: 'token',
        compare: (a, b) => (a.tokenNumber ?? 0) - (b.tokenNumber ?? 0),
        renderHeaderCell: () => 'Token',
        renderCell: (a) =>
          a.tokenNumber ? (
            <Badge appearance="outline" color="brand" size="small" className={styles.mono}>
              #{String(a.tokenNumber).padStart(3, '0')}
            </Badge>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<Appointment>({
        columnId: 'date',
        compare: (a, b) => a.startsAt.localeCompare(b.startsAt),
        renderHeaderCell: () => 'Time',
        renderCell: (a) => (
          <Text size={300} className={styles.nowrap}>
            {new Date(a.startsAt).toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        ),
      }),
      createTableColumn<Appointment>({
        columnId: 'duration',
        compare: (a, b) => a.startsAt.localeCompare(b.startsAt),
        renderHeaderCell: () => 'Duration',
        renderCell: (a) => (
          <Text size={300} className={styles.nowrap}>
            {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
            {new Date(a.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ),
      }),
      createTableColumn<Appointment>({
        columnId: 'status',
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => 'Status',
        renderCell: (a) => (
          <Badge
            appearance="tint"
            color={statusConfig[a.status]?.color ?? 'subtle'}
            size="small"
          >
            {statusConfig[a.status]?.label ?? a.status}
          </Badge>
        ),
      }),
      createTableColumn<Appointment>({
        columnId: 'reason',
        compare: (a, b) => (a.reason ?? '').localeCompare(b.reason ?? ''),
        renderHeaderCell: () => 'Reason',
        renderCell: (a) => <Text size={300}>{a.reason || '—'}</Text>,
      }),
    ];

    if (!isAdmin) {
      cols.push(
        createTableColumn<Appointment>({
          columnId: 'actions',
          renderHeaderCell: () => 'Actions',
          renderCell: (a) => (
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <Tooltip content="View details" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Eye24Regular />}
                  style={actionBtnStyle}
                  onClick={() => navigate(`/appointments/${a.id}`, { state: detailNavState })}
                />
              </Tooltip>
              <Tooltip content="Edit" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Edit24Regular />}
                  style={actionBtnStyle}
                  disabled={['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)}
                  onClick={() => {
                    setActive(a);
                    setOpen(true);
                  }}
                />
              </Tooltip>
              {a.status === 'SCHEDULED' && (
                <Tooltip content="Check In" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<PersonArrowRight24Regular />}
                    style={actionBtnStyle}
                    disabled={statusMutation.isPending && statusMutation.variables?.id === a.id}
                    onClick={() => statusMutation.mutate({ id: a.id, status: 'CHECKED_IN' })}
                  />
                </Tooltip>
              )}
              {a.status === 'CHECKED_IN' && (
                <Tooltip content="Mark Completed" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<CheckmarkCircle24Regular />}
                    style={actionBtnStyle}
                    disabled={statusMutation.isPending && statusMutation.variables?.id === a.id}
                    onClick={() => statusMutation.mutate({ id: a.id, status: 'COMPLETED' })}
                  />
                </Tooltip>
              )}
              {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                <Tooltip content="No Show" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<PersonDelete24Regular />}
                    style={actionBtnStyle}
                    disabled={statusMutation.isPending && statusMutation.variables?.id === a.id}
                    onClick={() => statusMutation.mutate({ id: a.id, status: 'NO_SHOW' })}
                  />
                </Tooltip>
              )}
              {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                <Tooltip content="Cancel" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<DismissCircle24Regular />}
                    style={actionBtnStyle}
                    disabled={cancelMutation.isPending && cancelMutation.variables === a.id}
                    onClick={() => cancelMutation.mutate(a.id)}
                  />
                </Tooltip>
              )}
              <Tooltip content="Delete" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  style={actionBtnStyle}
                  onClick={() => setDeleteTarget(a)}
                />
              </Tooltip>
            </div>
          ),
        }),
      );
    }
    return cols;
  }, [
    cancelMutation,
    detailNavState,
    isAdmin,
    navigate,
    statusMutation,
    styles,
  ]);

  return (
    <div className={styles.page}>
      {view === 'calendar' ? (
        <div className={styles.calendarPage}>
          <div className={styles.calendarHeader}>
            <div className={styles.titles}>
              <Text as="h2" size={600} weight="bold">
                Appointments
              </Text>
              <Text className={styles.subtitle}>Schedule and manage patient visits.</Text>
            </div>
            <div className={styles.headerActions}>
              {viewToggle}
              {!isAdmin && (
                <Button
                  appearance="primary"
                  icon={<Add24Regular />}
                  onClick={() => {
                    setActive(undefined);
                    setDefaultDate(undefined);
                    setOpen(true);
                  }}
                >
                  Create appointment
                </Button>
              )}
            </div>
          </div>
          {appointmentFilters}
          <div className={styles.calendarCard}>
            <AppointmentCalendar
              appointments={filtered}
              loading={appointments.isLoading}
              fetching={appointments.isFetching && !appointments.isLoading}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              statusPendingId={statusMutation.isPending ? statusMutation.variables?.id : null}
              onDateClick={
                isAdmin
                  ? undefined
                  : (d) => {
                      setActive(undefined);
                      setDefaultDate(d);
                      setOpen(true);
                    }
              }
              onAppointmentClick={
                isAdmin
                  ? undefined
                  : (appt) => navigate(`/appointments/${appt.id}`, { state: detailNavState })
              }
              readOnly={isAdmin}
              hideCheckIn={user?.role !== 'doctor'}
            />
          </div>
        </div>
      ) : (
        <TablePageShell
          title="Appointments"
          subtitle="Schedule and manage patient visits."
          action={
            <div className={styles.headerActions}>
              {viewToggle}
              {!isAdmin && (
                <Button
                  appearance="primary"
                  icon={<Add24Regular />}
                  onClick={() => {
                    setActive(undefined);
                    setDefaultDate(undefined);
                    setOpen(true);
                  }}
                >
                  Create appointment
                </Button>
              )}
            </div>
          }
          toolbar={appointmentFilters}
          pager={
            filtered.length > rowsPerPage ? (
              <TablePager
                page={page}
                rowsPerPage={rowsPerPage}
                total={filtered.length}
                onPageChange={setPage}
              />
            ) : undefined
          }
          error={
            appointments.isError && (
              <MessageBar intent="error" className={styles.errorBar}>
                <MessageBarBody>Unable to load appointments.</MessageBarBody>
              </MessageBar>
            )
          }
          fetching={appointments.isFetching && !appointments.isLoading}
        >
          {appointments.isLoading ? (
            <TableRowsSkeleton cols={isAdmin ? 7 : 8} />
          ) : (
            <DataGridTable
              items={paginated}
              columns={columns}
              getRowId={(a) => a.id}
              emptyMessage="No appointments scheduled."
              onRowClick={(a) => navigate(`/appointments/${a.id}`, { state: detailNavState })}
            />
          )}
        </TablePageShell>
      )}
      <AppointmentDialog
        appointment={active}
        open={open}
        defaultDate={defaultDate}
        defaultProviderId={user?.role === 'doctor' ? user.id : undefined}
        onClose={() => setOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete appointment?"
        message={
          deleteTarget
            ? `Delete appointment for ${deleteTarget.patient.firstName} ${deleteTarget.patient.lastName} on ${new Date(deleteTarget.startsAt).toLocaleString()}?`
            : ''
        }
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
