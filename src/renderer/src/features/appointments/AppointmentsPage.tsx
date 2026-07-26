import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
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
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Autocomplete
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import type { Appointment, AppointmentInput, AppointmentPerson } from '@/types/appointment';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error'; hex: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'primary', hex: '#1976d2' },
  CHECKED_IN: { label: 'Checked In', color: 'warning', hex: '#ed6c02' },
  COMPLETED: { label: 'Completed', color: 'success', hex: '#2e7d32' },
  CANCELLED: { label: 'Cancelled', color: 'default', hex: '#9e9e9e' },
  NO_SHOW: { label: 'No Show', color: 'error', hex: '#d32f2f' },
};

const schema = z.object({
  patientId: z.string().min(1, 'Select a patient.'),
  providerId: z.string().min(1, 'Select a doctor.'),
  date: z.string().min(1, 'Select a date.'),
  time: z.string().min(1, 'Select a time.'),
  duration: z.number().min(15).max(240),
  reason: z.string(),
  notes: z.string(),
  recurring: z.boolean(),
  recurrenceCount: z.number().min(2).max(52),
});
type FormValues = z.infer<typeof schema>;
const empty: FormValues = {
  patientId: '',
  providerId: '',
  date: new Date().toISOString().slice(0, 10),
  time: '09:00',
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

export function AppointmentDialog({ appointment, open, onClose, defaultDate, defaultProviderId }: {
  appointment?: Appointment;
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultProviderId?: string;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const patients = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1000 }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
    staleTime: Infinity,
  });

  const doctors = useQuery({ queryKey: ['doctors'], queryFn: appointmentsService.doctors, staleTime: Infinity });
  function personLabel(person: AppointmentPerson): string {
    return `${person.firstName} ${person.lastName}`;
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
  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const startsAt = new Date(`${values.date}T${values.time}:00`);
      const tzOffset = startsAt.getTimezoneOffset() * 60000;
      const input: AppointmentInput = {
        patientId: values.patientId,
        providerId: values.providerId,
        startsAt: new Date(startsAt.getTime() - tzOffset).toISOString(),
        endsAt: new Date(startsAt.getTime() - tzOffset + values.duration * 60000).toISOString(),
        reason: values.reason || null,
        notes: values.notes || null,
        recurrenceRule: values.recurring ? `WEEKLY:${values.recurrenceCount}` : null,
      };
      return appointment ? appointmentsService.update(appointment.id, input) : appointmentsService.create(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      form.reset(appointmentValues(appointment));
    } else {
      form.reset({ ...empty, date: defaultDate ?? empty.date, providerId: defaultProviderId ?? empty.providerId });
    }
  }, [appointment, defaultDate, defaultProviderId, form, open]);

  const { errors } = form.formState;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>{appointment ? 'Update appointment' : 'Create appointment'}</DialogTitle>
      <Box component="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <DialogContent>
          <Stack spacing={2.25}>
            {mutation.isError && <Alert severity="error">Unable to save the appointment.</Alert>}

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
              render={({ field }) => (
                <Autocomplete
                  options={doctorOptions}
                  loading={doctors.isLoading}
                  value={doctorOptions.find((p) => p.id === field.value) ?? null}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => personLabel(option)}
                  onChange={(_, value) => field.onChange(value?.id ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Doctor"
                      error={Boolean(errors.providerId)}
                      helperText={errors.providerId?.message}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            />

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <Controller
                  name="date"
                  control={form.control}
                  render={({ field }) => (
                    <DatePicker
                      label="Date"
                      value={field.value ? new Date(field.value) : null}
                      onChange={(value) => field.onChange(value ? value.toLocaleDateString('en-CA') : '')}
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
                      onChange={(value) => field.onChange(value ? value.toTimeString().slice(0, 5) : '')}
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
                  <MenuItem value="Lab Results">Lab Results</MenuItem>
                  <MenuItem value="Vaccination">Vaccination</MenuItem>
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

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {appointment ? 'Save changes' : 'Create appointment'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function AppointmentsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Appointment | undefined>();
  const [open, setOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const { user } = useAuth();

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const cancelMutation = useMutation({
    mutationFn: appointmentsService.cancel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsService.updateStatus(id, status as Appointment['status']),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const allData = user?.role === 'doctor'
    ? (appointments.data ?? []).filter((a) => a.providerId === user.id)
    : (appointments.data ?? []);

  const filtered = allData.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase().includes(q) ||
      `${a.provider.firstName} ${a.provider.lastName}`.toLowerCase().includes(q) ||
      (a.reason ?? '').toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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
    <>
      {view === 'calendar' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: { sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>Appointments</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Schedule and manage patient visits.</Typography>
            </Box>
            <Stack direction="row" gap={1}>
              {viewToggle}
              <Button startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }} onClick={() => { setActive(undefined); setDefaultDate(undefined); setOpen(true); }}>Create appointment</Button>
            </Stack>
          </Box>
          <AppointmentCalendar
            appointments={allData}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            onDateClick={(date) => { setActive(undefined); setDefaultDate(date); setOpen(true); }}
            onAppointmentClick={(appt) => { setActive(appt); setOpen(true); }}
          />
        </Box>
      ) : (
        <TablePageShell
          title="Appointments"
          subtitle="Schedule and manage patient visits."
          action={
            <Stack direction="row" gap={1}>
              {viewToggle}
              <Button startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }} onClick={() => { setActive(undefined); setDefaultDate(undefined); setOpen(true); }}>Create appointment</Button>
            </Stack>
          }
          toolbar={<SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search patient, doctor, reason..." sx={{ flex: 1, maxWidth: 360 }} />}
          pager={
            filtered.length > rowsPerPage ? (
              <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
            ) : undefined
          }
          error={appointments.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load appointments.</Alert>}
        >
          <TableHead sx={tableSx.head}>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Doctor</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.isLoading ? (
              <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Loading appointments...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No appointments scheduled.</TableCell></TableRow>
            ) : (
              paginated.map((a) => (
                <TableRow key={a.id} sx={tableSx.row}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                        {a.patient.firstName[0]}{a.patient.lastName[0]}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(a.patient)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          {new Date(a.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000)} min
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'secondary.main' }}>
                        {a.provider.firstName[0]}{a.provider.lastName[0]}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(a.provider)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">{a.provider.role ?? 'Doctor'}</Typography>
                      </Box>
                    </Box>
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
                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit"><span>
                        <IconButton sx={actionBtnSx} disabled={['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)} onClick={() => { setActive(a); setOpen(true); }}>
                          <EditOutlinedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span></Tooltip>
                      {a.status === 'SCHEDULED' && (
                        <Tooltip title="Check In"><IconButton sx={actionBtnSx} onClick={() => statusMutation.mutate({ id: a.id, status: 'CHECKED_IN' })}><LoginOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      )}
                      {a.status === 'CHECKED_IN' && (
                        <Tooltip title="Mark Completed"><IconButton sx={actionBtnSx} onClick={() => statusMutation.mutate({ id: a.id, status: 'COMPLETED' })}><CheckCircleOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      )}
                      {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                        <Tooltip title="No Show"><IconButton sx={actionBtnSx} onClick={() => statusMutation.mutate({ id: a.id, status: 'NO_SHOW' })}><PersonOffOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      )}
                      {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && (
                        <Tooltip title="Cancel"><IconButton sx={actionBtnSx} onClick={() => cancelMutation.mutate(a.id)}><CancelOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </TablePageShell>
      )}
      <AppointmentDialog appointment={active} open={open} defaultDate={defaultDate} onClose={() => setOpen(false)} />
    </>
  );
}

