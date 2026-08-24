import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Autocomplete,
  Select,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import type { Appointment, AppointmentInput, AppointmentPerson } from '@/types/appointment';
import type { Token, TokenPerson } from '@/types/token';
import { TokenFeeFields } from '@/features/tokens/TokenFeeFields';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { nextFreeSlot, doctorOfflineReason, slotSearchFrom, type SlotAdjustReason } from '@/utils/appointmentSlot';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps,
} from '@/components/DialogUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error'; hex: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'primary', hex: '#1976d2' },
  CHECKED_IN: { label: 'Checked In', color: 'warning', hex: '#ed6c02' },
  COMPLETED: { label: 'Completed', color: 'success', hex: '#2e7d32' },
  CANCELLED: { label: 'Cancelled', color: 'default', hex: '#9e9e9e' },
  NO_SHOW: { label: 'No Show', color: 'error', hex: '#d32f2f' },
};

const filterSelectSx = {
  borderRadius: 0.5,
  fontSize: 13.5,
  fontWeight: 500,
  bgcolor: 'background.paper',
  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 0.5 },
} as const;

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

function IssueTokenInline({ patientId, date, providerId, onIssued }: {
  patientId: string;
  date: string;
  providerId: string;
  onIssued: (token: Token) => void;
}) {
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
    if (!doctor) return;
    if (reason === 'Free') {
      setConsultationFee('0');
      setFeeDiscount('');
      return;
    }
    setConsultationFee(String(Number(doctor.consultationFee ?? 0)));
    setFeeDiscount('');
  }, [providerId, doctors, reason]);
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
  return (
    <Box sx={{ mt: 1.5, p: 1.5, border: '1px dashed', borderColor: 'warning.main', borderRadius: 2, bgcolor: 'warning.50' }}>
      <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
        No token found — issue one now
      </Typography>
      <TokenFeeFields
        consultationFee={consultationFee}
        feeDiscount={feeDiscount}
        onFeeChange={setConsultationFee}
        onDiscountChange={setFeeDiscount}
        priorVisitsThisWeek={weekVisits?.count ?? 0}
        compact
      />
      <Stack direction="row" spacing={1}>
        <TextField
          select size="small" label="Reason (optional)" value={reason}
          onChange={(e) => {
            const next = e.target.value;
            setReason(next);
            if (next === 'Free') {
              setConsultationFee('0');
              setFeeDiscount('');
            } else {
              const doctor = doctors.find((d) => d.id === providerId);
              if (doctor) setConsultationFee(String(Number(doctor.consultationFee ?? 0)));
            }
          }}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— None —</MenuItem>
          <MenuItem value="Checkup">Checkup</MenuItem>
          <MenuItem value="Follow-up">Follow-up</MenuItem>
          <MenuItem value="Urgent">Urgent</MenuItem>
          <MenuItem value="Consultation">Consultation</MenuItem>
          {showLabReason && <MenuItem value="Lab Results">Lab Results</MenuItem>}
          <MenuItem value="Vaccination">Vaccination</MenuItem>
          <MenuItem value="Free">Free</MenuItem>
        </TextField>
        <Button
          variant="contained" color="warning" size="small"
          disabled={!providerId}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Issue Token
        </Button>
      </Stack>
      {mutation.isError && (
        <Typography variant="caption" color="error">
          {(mutation.error as Error)?.message || 'Failed to issue token.'}
        </Typography>
      )}
    </Box>
  );
}

export function AppointmentDialog({ appointment, open, onClose, defaultDate, defaultProviderId, onSuccess }: {
  appointment?: Appointment;
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultProviderId?: string;
  onSuccess?: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const patients = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1000 }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  const doctors = useQuery({ queryKey: ['doctors'], queryFn: appointmentsService.doctors, staleTime: 5 * 60 * 1000, retry: 3 });
  function personLabel(person: AppointmentPerson): string {
    return `${person.firstName} ${person.lastName}`;
  }
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
  const offlineReason = open && providerId && date && scheduleFetched
    ? doctorOfflineReason(schedule, date)
    : null;

  useEffect(() => {
    if (!appointment) form.setValue('tokenId', tokenForPatient?.id ?? '');
  }, [tokenForPatient, appointment, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
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
            patient: raw.patient ?? patient ?? { id: values.patientId, firstName: '', lastName: '', role: 'patient' },
            provider: raw.provider ?? provider ?? { id: values.providerId, firstName: '', lastName: '', role: 'doctor' },
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
      form.reset({ ...empty, date: defaultDate ?? empty.date, providerId: defaultProviderId ?? empty.providerId });
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

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title={appointment ? 'Update appointment' : 'Create appointment'}
        subtitle={appointment ? 'Edit schedule, doctor, and visit details.' : 'Book a new patient visit.'}
      />
      <Box component="form" onSubmit={form.handleSubmit((v) => { if (offlineReason) return; mutation.mutate(v); })} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.25}>
            {mutation.isError && (
              <Alert severity="error">
                {(mutation.error as Error)?.message || 'Unable to save the appointment.'}
              </Alert>
            )}
            {offlineReason && (
              <Alert severity="warning">{offlineReason}</Alert>
            )}
            {slotNotice === 'busy' && (
              <Alert severity="warning">
                This time is already booked. Moved 30 minutes forward, or to the end of the current visit.
              </Alert>
            )}
            {slotNotice === 'schedule' && (
              <Alert severity="info">
                {hoursLabel
                  ? `Outside doctor hours (${hoursLabel}). Moved to the next available time.`
                  : 'This day is off in Doctor Schedule. Moved to the next working day.'}
              </Alert>
            )}

            <Controller
              name="patientId"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={patientOptions}
                  loading={patients.isLoading}
                  value={patientOptions.find((p) => p.id === field.value) ?? null}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => personLabel(option)}
                  onChange={(_, value) => field.onChange(value?.id ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Patient"
                      error={Boolean(errors.patientId)}
                      helperText={errors.patientId?.message}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            />

            <Controller
              name="providerId"
              control={form.control}
              render={({ field }) => {
                const selected = doctorOptions.find((p) => p.id === field.value) ?? null;
                return (
                <Autocomplete
                  options={doctorOptions}
                  loading={doctors.isLoading}
                  value={selected}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => personLabel(option)}
                  onChange={(_, value) => field.onChange(value?.id ?? '')}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <DoctorAvatar src={option.avatar} name={`Dr. ${personLabel(option)}`} size={32} />
                      <Typography fontSize={13.5} fontWeight={600} sx={{ flex: 1 }} noWrap>
                        {personLabel(option)}
                      </Typography>
                      <Typography fontSize={13} fontWeight={700} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {feeLabel(option.consultationFee)}
                      </Typography>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Doctor"
                      error={Boolean(errors.providerId)}
                      helperText={errors.providerId?.message}
                      onBlur={field.onBlur}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: selected ? (
                          <>
                            <DoctorAvatar
                              src={selected.avatar}
                              name={`Dr. ${personLabel(selected)}`}
                              size={24}
                              sx={{ ml: 0.5, mr: 0.5 }}
                            />
                            {params.InputProps.startAdornment}
                          </>
                        ) : params.InputProps.startAdornment,
                      }}
                    />
                  )}
                />
                );
              }}
            />

            {!appointment && (
              <Box>
                <TextField
                  label="Token"
                  fullWidth
                  value={tokenForPatient ? `#${String(tokenForPatient.tokenNumber).padStart(3, '0')} — ${tokenForPatient.patient.firstName} ${tokenForPatient.patient.lastName}` : ''}
                  placeholder={patientId && date ? 'No token found for this patient on selected date' : 'Select patient and date first'}
                  InputProps={{ readOnly: true }}
                  error={!!form.formState.errors.tokenId}
                  helperText={form.formState.errors.tokenId?.message ?? (tokenForPatient ? 'Token auto-linked' : '')}
                  color={tokenForPatient ? 'success' : undefined}
                />
                {patientId && date && !tokenForPatient && !offlineReason && (
                  <IssueTokenInline patientId={patientId} date={date} providerId={form.watch('providerId')} onIssued={(t) => form.setValue('tokenId', t.id)} />
                )}
              </Box>
            )}

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <Controller
                  name="date"
                  control={form.control}
                  render={({ field }) => (
                    <DatePicker
                      label="Date"
                      value={field.value ? new Date(`${field.value}T12:00:00`) : null}
                      onChange={(value) => {
                        if (!value) {
                          field.onChange('');
                          return;
                        }
                        if (!providerId) {
                          field.onChange(value.toLocaleDateString('en-CA'));
                          return;
                        }
                        const dateStr = value.toLocaleDateString('en-CA');
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
                          field.onChange(value.toLocaleDateString('en-CA'));
                        }
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: Boolean(errors.date),
                          helperText: errors.date?.message,
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  name="time"
                  control={form.control}
                  render={({ field }) => (
                    <TimePicker
                      label="Time"
                      value={field.value ? new Date(`1970-01-01T${field.value}:00`) : null}
                      onChange={(value) => {
                        const picked = value ? value.toTimeString().slice(0, 5) : '';
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
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: Boolean(errors.time),
                          helperText: errors.time?.message,
                        },
                      }}
                    />
                  )}
                />
              </Box>
            </LocalizationProvider>

            <TextField fullWidth label="Duration (minutes)" type="number" {...form.register('duration', { valueAsNumber: true })} />
            <Controller
              name="reason"
              control={form.control}
              render={({ field }) => (
                <TextField select fullWidth label="Reason" {...field}>
                  <MenuItem value="">— None —</MenuItem>
                  <MenuItem value="Checkup">Checkup</MenuItem>
                  <MenuItem value="Follow-up">Follow-up</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                  <MenuItem value="Consultation">Consultation</MenuItem>
                  {showLabReason && <MenuItem value="Lab Results">Lab Results</MenuItem>}
                  <MenuItem value="Vaccination">Vaccination</MenuItem>
                  <MenuItem value="Free">Free</MenuItem>
                </TextField>
              )}
            />
            <TextField fullWidth label="Notes" minRows={2} multiline {...form.register('notes')} />

            {!appointment && (
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      {...form.register('recurring')}
                      checked={form.watch('recurring')}
                      onChange={(e) => form.setValue('recurring', e.target.checked)}
                    />
                  }
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><RepeatOutlinedIcon sx={{ fontSize: 16 }} /><Typography fontSize={14}>Repeat weekly</Typography></Box>}
                />
                {form.watch('recurring') && (
                  <TextField
                    fullWidth
                    label="Number of weeks"
                    type="number"
                    size="small"
                    sx={{ mt: 1.5 }}
                    {...form.register('recurrenceCount', { valueAsNumber: true })}
                    slotProps={{ htmlInput: { min: 2, max: 52 } }}
                    helperText={`Will create ${form.watch('recurrenceCount')} appointments, one per week`}
                  />
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending} disabled={Boolean(offlineReason)}>
            {appointment ? 'Save changes' : 'Create appointment'}
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function AppointmentsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Appointment | undefined>();
  const [open, setOpen] = useState(false);
  const tokenPrint = usePrintAppointmentToken();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const view: 'table' | 'calendar' = searchParams.get('view') === 'calendar' ? 'calendar' : 'table';
  const setView = (next: 'table' | 'calendar') => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'calendar') p.set('view', 'calendar');
      else p.delete('view');
      return p;
    }, { replace: true });
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

  const allData = user?.role === 'doctor'
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
  const appointmentFilters = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
      <SearchField
        value={search}
        onChange={(v) => { setSearch(v); setPage(0); }}
        placeholder="Search patient, doctor, reason..."
        sx={{ flex: 1, maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}
      />
      {showDoctorFilter && (
        <FormControl size="small" sx={{ minWidth: 170, flexShrink: 0 }}>
          <InputLabel>Doctor</InputLabel>
          <Select
            label="Doctor"
            value={doctorFilter}
            onChange={(e) => { setDoctorFilter(e.target.value); setPage(0); }}
            sx={filterSelectSx}
          >
            <MenuItem value="ALL">All doctors</MenuItem>
            {doctorOptions.map(([id, name]) => (
              <MenuItem key={id} value={id}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={filterSelectSx}
        >
          <MenuItem value="ALL">All statuses</MenuItem>
          {Object.entries(statusConfig).map(([value, cfg]) => (
            <MenuItem key={value} value={value}>{cfg.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );


  const viewToggle = (
    <ToggleButtonGroup
      size="small"
      value={view}
      exclusive
      onChange={(_, v) => v && setView(v)}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        '& .MuiToggleButton-root': {
          border: 'none',
          borderRadius: 0,
          px: 1.5,
          py: 0.75,
          color: 'text.secondary',
          '&.Mui-selected': { bgcolor: 'action.selected', color: 'text.primary' },
        },
        '& .MuiToggleButtonGroup-grouped:not(:last-of-type)': {
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <ToggleButton value="table"><Tooltip title="Table view"><TableRowsOutlinedIcon fontSize="small" /></Tooltip></ToggleButton>
      <ToggleButton value="calendar"><Tooltip title="Calendar view"><CalendarMonthOutlinedIcon fontSize="small" /></Tooltip></ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {view === 'calendar' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: { sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>Appointments</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Schedule and manage patient visits.</Typography>
            </Box>
            <Stack direction="row" gap={1}>
              {viewToggle}
              {!isAdmin && <Button startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }} onClick={() => { setActive(undefined); setDefaultDate(undefined); setOpen(true); }}>Create appointment</Button>}
            </Stack>
          </Box>
          {appointmentFilters}
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <AppointmentCalendar
              appointments={filtered}
              loading={appointments.isLoading}
              fetching={appointments.isFetching && !appointments.isLoading}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              statusPendingId={statusMutation.isPending ? statusMutation.variables?.id : null}
              onDateClick={isAdmin ? undefined : (date) => { setActive(undefined); setDefaultDate(date); setOpen(true); }}
              onAppointmentClick={isAdmin ? undefined : (appt) => navigate(`/appointments/${appt.id}`, { state: detailNavState })}
              readOnly={isAdmin}
              hideCheckIn={user?.role !== 'doctor'}
            />
          </Paper>
        </Box>
      ) : (
        <TablePageShell
          title="Appointments"
          subtitle="Schedule and manage patient visits."
          action={
            <Stack direction="row" gap={1}>
              {viewToggle}
              {!isAdmin && <Button startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }} onClick={() => { setActive(undefined); setDefaultDate(undefined); setOpen(true); }}>Create appointment</Button>}
            </Stack>
          }
          toolbar={appointmentFilters}
          pager={
            filtered.length > rowsPerPage ? (
              <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
            ) : undefined
          }
          error={appointments.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load appointments.</Alert>}
          fetching={appointments.isFetching && !appointments.isLoading}
        >
          <TableHead sx={tableSx.head}>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Doctor</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reason</TableCell>
              {!isAdmin && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.isLoading ? (
              <TableRowsSkeleton cols={isAdmin ? 7 : 8} />
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 8} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No appointments scheduled.</TableCell></TableRow>
            ) : (
              paginated.map((a) => (
                <TableRow
                  key={a.id}
                  sx={{ ...tableSx.row, cursor: 'pointer' }}
                  onClick={() => navigate(`/appointments/${a.id}`, { state: detailNavState })}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                        {a.patient.firstName[0]}{a.patient.lastName[0]}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(a.patient)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          {a.patient.phone ?? '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <DoctorAvatar
                        src={a.provider.avatar}
                        name={`Dr. ${a.provider.firstName} ${a.provider.lastName}`}
                        size={34}
                      />
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(a.provider)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">{a.provider.role ?? 'Doctor'}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {a.tokenNumber ? (
                      <Chip label={`#${String(a.tokenNumber).padStart(3, '0')}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(a.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(a.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Chip color={statusConfig[a.status]?.color ?? 'default'} label={statusConfig[a.status]?.label ?? a.status} size="small" sx={chipSx} />
                  </TableCell>
                  <TableCell>{a.reason || '—'}</TableCell>
                  {!isAdmin && (
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" gap={0.5} justifyContent="flex-end">
                        <Tooltip title="View details">
                          <IconButton sx={actionBtnSx} onClick={() => navigate(`/appointments/${a.id}`, { state: detailNavState })}>
                            <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print token"><span>
                          <IconButton
                            sx={actionBtnSx}
                            loading={tokenPrint.printingId === a.id}
                            onClick={() => tokenPrint.printFor(a)}
                          >
                            <PrintOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title="Edit"><span>
                          <IconButton sx={actionBtnSx} disabled={['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)} onClick={() => { setActive(a); setOpen(true); }}>
                            <EditOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </span></Tooltip>
                        {a.status === 'SCHEDULED' && (
                          <Tooltip title="Check In"><IconButton sx={actionBtnSx} loading={statusMutation.isPending && statusMutation.variables?.id === a.id} onClick={() => statusMutation.mutate({ id: a.id, status: 'CHECKED_IN' })}><LoginOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                        )}
                        {a.status === 'CHECKED_IN' && (
                          <Tooltip title="Mark Completed"><IconButton sx={actionBtnSx} loading={statusMutation.isPending && statusMutation.variables?.id === a.id} onClick={() => statusMutation.mutate({ id: a.id, status: 'COMPLETED' })}><CheckCircleOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                        )}
                        {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                          <Tooltip title="No Show"><IconButton sx={actionBtnSx} loading={statusMutation.isPending && statusMutation.variables?.id === a.id} onClick={() => statusMutation.mutate({ id: a.id, status: 'NO_SHOW' })}><PersonOffOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                        )}
                        {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                          <Tooltip title="Cancel"><IconButton sx={actionBtnSx} loading={cancelMutation.isPending && cancelMutation.variables === a.id} onClick={() => cancelMutation.mutate(a.id)}><CancelOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                        )}
                        <Tooltip title="Delete"><IconButton sx={actionBtnSx} onClick={() => setDeleteTarget(a)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </TablePageShell>
      )}
      <AppointmentDialog appointment={active} open={open} defaultDate={defaultDate} defaultProviderId={user?.role === 'doctor' ? user.id : undefined} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete appointment?"
        message={deleteTarget ? `Delete appointment for ${deleteTarget.patient.firstName} ${deleteTarget.patient.lastName} on ${new Date(deleteTarget.startsAt).toLocaleString()}?` : ''}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </Box>
  );
}

