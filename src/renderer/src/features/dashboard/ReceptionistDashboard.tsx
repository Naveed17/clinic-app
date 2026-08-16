import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select,
  Step, StepLabel, Stepper, Stack, TextField, Typography, Chip, Avatar,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { InvoiceDialog } from '@/features/billing/InvoicesPage';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { useNavigate } from 'react-router-dom';
import type { TokenPerson, Token, PrescriptionFeedItem } from '@/types/token';
import type { PatientInput } from '@/types/patient';
import type { Appointment, AppointmentPerson } from '@/types/appointment';
import imgMask from '@/assets/dashboard/clinic-mask.svg';
import imgCapsule from '@/assets/dashboard/clinic-capsule.svg';
import imgVirus from '@/assets/dashboard/clinic-virus.svg';
import imgHeart from '@/assets/dashboard/clinic-heart.svg';

/** Cluster layout matching the medical illustration reference */
const CLINIC_CLUSTER = [
  { src: imgVirus, alt: 'Virus small', w: 58, top: '6%', left: '4%', rot: -18, z: 2, opacity: 0.92 },
  { src: imgVirus, alt: 'Virus large', w: 86, top: '48%', left: '0%', rot: 12, z: 3, opacity: 1 },
  { src: imgMask, alt: 'Surgical mask', w: 168, top: '18%', left: '18%', rot: 8, z: 4, opacity: 1 },
  { src: imgCapsule, alt: 'Medicine capsule', w: 72, top: '2%', left: '62%', rot: 38, z: 5, opacity: 1 },
  { src: imgHeart, alt: 'Heart', w: 70, top: '58%', left: '66%', rot: -8, z: 5, opacity: 1 },
] as const;

const statusColor: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'error', NO_SHOW: 'default',
};

/* ── Patient schema (minimal required fields) ── */
const patientSchema = z.object({
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  phone: z.string().trim(),
  dateOfBirth: z.string(),
  address: z.string().trim(),
});
type PatientForm = z.infer<typeof patientSchema>;
const patientDefaults: PatientForm = { firstName: '', lastName: '', phone: '', dateOfBirth: '', address: '' };

/* ── Merged Walk-in Modal ── */
const STEPS = ['Register Patient', 'Issue Token', 'Print Token'];

function WalkInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [createdToken, setCreatedToken] = useState<Token | null>(null);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [previewToken, setPreviewToken] = useState<Token | null>(null);
  const [previewAutoPrint, setPreviewAutoPrint] = useState(false);

  const form = useForm<PatientForm>({ resolver: zodResolver(patientSchema), defaultValues: patientDefaults });

  const { data: patients = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
    enabled: open,
  });
  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
    enabled: open,
  });

  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId) ?? null, [patients, patientId]);

  const createPatientMutation = useMutation({
    mutationFn: (values: PatientForm) => patientsService.create({
      firstName: values.firstName, lastName: values.lastName,
      phone: values.phone || null, dateOfBirth: values.dateOfBirth || null,
      email: null, address: values.address || null, emergencyContactName: null,
      emergencyContactPhone: null, bloodGroup: null, allergies: null, chronicConditions: null,
    } as PatientInput),
    onSuccess: async (patient) => {
      await qc.invalidateQueries({ queryKey: ['patients'] });
      await qc.invalidateQueries({ queryKey: ['token-patients'] });
      setPatientId(patient.id);
      setStep(1);
    },
    meta: { toast: 'Patient created', errorToast: 'Could not register patient.' },
  });

  const tokenMutation = useMutation({
    mutationFn: () => window.clinic.tokens.create({
      patientId, doctorId,
      date: new Date().toLocaleDateString('en-CA'),
      reason: reason || null,
    }),
    onSuccess: async (token: Token) => {
      await window.clinic.tokens.updateStatus(token.id, 'WAITING');
      const startsAt = new Date(token.createdAt).toISOString();
      const endsAt = new Date(new Date(token.createdAt).getTime() + 30 * 60000).toISOString();
      await appointmentsService.ensureSameDay({ patientId, providerId: doctorId, startsAt, endsAt, reason: reason || null, notes: null, recurrenceRule: null });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setCreatedToken(token);
      setStep(2);
      // Auto-open slip preview + print dialog
      setPreviewAutoPrint(true);
      setPreviewToken(token);
    },
    meta: { silent: true },
  });

  function handleClose() {
    setStep(0); setPatientId(''); setDoctorId(''); setReason('');
    setCreatedToken(null); setUseExisting(false);
    setPreviewToken(null);
    setPreviewAutoPrint(false);
    form.reset(patientDefaults);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Walk-in Registration" subtitle="Register a patient and issue a token." />
      <DialogContent sx={dialogContentSx}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0 — Register Patient */}
        {step === 0 && (
          <Stack spacing={2}>
            {createPatientMutation.isError && <Alert severity="error">Could not register patient.</Alert>}
            <Stack direction="row" gap={1}>
              <Button size="small" variant={!useExisting ? 'contained' : 'outlined'} onClick={() => setUseExisting(false)}>New Patient</Button>
              <Button size="small" variant={useExisting ? 'contained' : 'outlined'} onClick={() => setUseExisting(true)}>Existing Patient</Button>
            </Stack>
            {useExisting ? (
              <Autocomplete
                options={patients}
                getOptionLabel={(p) => `${p.firstName} ${p.lastName}`}
                value={selectedPatient}
                onChange={(_, v) => setPatientId(v?.id ?? '')}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={(params) => <TextField {...params} label="Search patient" fullWidth />}
              />
            ) : (
              <Box component="form" id="patient-form" onSubmit={form.handleSubmit((v) => createPatientMutation.mutate(v))}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                    <TextField label="First name" autoFocus error={!!form.formState.errors.firstName} helperText={form.formState.errors.firstName?.message} {...form.register('firstName')} />
                    <TextField label="Last name" error={!!form.formState.errors.lastName} helperText={form.formState.errors.lastName?.message} {...form.register('lastName')} />
                  </Box>
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field }) => (
                      <PhoneInputField label="Phone (optional)" value={field.value} onChange={field.onChange} />
                    )}
                  />
                  <TextField label="Address (optional)" {...form.register('address')} />
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Controller name="dateOfBirth" control={form.control} render={({ field }) => (
                      <DatePicker label="Date of birth (optional)"
                        value={field.value ? new Date(field.value) : null}
                        onChange={(v) => field.onChange(v ? v.toISOString().slice(0, 10) : '')}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    )} />
                  </LocalizationProvider>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {/* Step 1 — Issue Token */}
        {step === 1 && (
          <Stack spacing={2}>
            {tokenMutation.isError && (
              <Alert severity="error">
                {(tokenMutation.error as Error)?.message || 'Could not issue token.'}
              </Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Doctor</InputLabel>
              <Select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                {doctors.map((d) => <MenuItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Reason (optional)</InputLabel>
              <Select label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}>
                <MenuItem value="">— None —</MenuItem>
                {['Checkup', 'Follow-up', 'Urgent', 'Consultation', 'Lab Results', 'Vaccination'].map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}

        {/* Step 2 — Print */}
        {step === 2 && createdToken && (
          <Stack alignItems="center" spacing={2} sx={{ py: 2 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'success.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ConfirmationNumberOutlinedIcon sx={{ fontSize: 36, color: 'success.contrastText' }} />
            </Box>
            <Typography fontWeight={800} fontSize={20}>Token Issued!</Typography>
            <Paper variant="outlined" sx={{ px: 4, py: 2, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary" letterSpacing={2}>TOKEN NO.</Typography>
              <Typography fontSize={56} fontWeight={900} color="primary.main" lineHeight={1}>
                {String(createdToken.tokenNumber).padStart(3, '0')}
              </Typography>
              <Typography fontWeight={600}>{createdToken.patient.firstName} {createdToken.patient.lastName}</Typography>
              <Typography variant="body2" color="text.secondary">Dr. {createdToken.doctor.firstName} {createdToken.doctor.lastName}</Typography>
            </Paper>
            <Typography variant="caption" color="text.secondary">
              Print dialog opens automatically — reprint anytime below.
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={dialogActionsSx}>
        <Button onClick={handleClose} sx={dialogCancelBtnSx}>Close</Button>
        {step === 0 && !useExisting && (
          <SubmitButton form="patient-form" type="submit" loading={createPatientMutation.isPending}>
            Next
          </SubmitButton>
        )}
        {step === 0 && useExisting && (
          <SubmitButton disabled={!patientId} onClick={() => setStep(1)}>
            Next
          </SubmitButton>
        )}
        {step === 1 && (
          <SubmitButton disabled={!doctorId} loading={tokenMutation.isPending} onClick={() => tokenMutation.mutate()}>
            Issue Token & Print
          </SubmitButton>
        )}
        {step === 2 && (
          <Button
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            disabled={!createdToken}
            onClick={() => {
              if (!createdToken) return;
              setPreviewAutoPrint(true);
              setPreviewToken(createdToken);
            }}
            sx={dialogCancelBtnSx}
          >
            Reprint
          </Button>
        )}
      </DialogActions>
      {previewToken && (
        <TokenPrintPreview
          token={previewToken}
          autoPrint={previewAutoPrint}
          onClose={() => {
            setPreviewToken(null);
            setPreviewAutoPrint(false);
          }}
        />
      )}
    </Dialog>
  );
}

/* ── Book Appointment Modal (patient → appointment, no token) ── */
const APPT_STEPS = ['Add Patient', 'Create Appointment'];

function BookAppointmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  const form = useForm<PatientForm>({ resolver: zodResolver(patientSchema), defaultValues: patientDefaults });

  const { data: patients = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
    enabled: open,
  });
  const { data: doctors = [] } = useQuery<AppointmentPerson[]>({
    queryKey: ['doctors'],
    queryFn: appointmentsService.doctors,
    enabled: open,
  });
  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId) ?? null, [patients, patientId]);

  const createPatientMutation = useMutation({
    mutationFn: (values: PatientForm) => patientsService.create({
      firstName: values.firstName, lastName: values.lastName,
      phone: values.phone || null, dateOfBirth: values.dateOfBirth || null,
      email: null, address: values.address || null, emergencyContactName: null,
      emergencyContactPhone: null, bloodGroup: null, allergies: null, chronicConditions: null,
    } as PatientInput),
    onSuccess: async (patient) => {
      await qc.invalidateQueries({ queryKey: ['patients'] });
      await qc.invalidateQueries({ queryKey: ['token-patients'] });
      setPatientId(patient.id);
      setPatientName(`${patient.firstName} ${patient.lastName}`);
      setStep(1);
    },
    meta: { toast: 'Patient created', errorToast: 'Could not register patient.' },
  });

  const appointmentMutation = useMutation({
    mutationFn: () => {
      const startsAt = new Date(`${date}T${time}:00`);
      return appointmentsService.create({
        patientId,
        providerId,
        tokenId: null,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + duration * 60000).toISOString(),
        reason: reason || null,
        notes: notes || null,
        recurrenceRule: null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setDone(true);
    },
    meta: { silent: true },
  });

  function handleClose() {
    setStep(0); setPatientId(''); setPatientName(''); setUseExisting(false);
    setProviderId(''); setDate(new Date().toLocaleDateString('en-CA'));
    setTime(new Date().toTimeString().slice(0, 5)); setDuration(30);
    setReason(''); setNotes(''); setDone(false);
    form.reset(patientDefaults);
    onClose();
  }

  const canSubmitAppt = !!patientId && !!providerId && !!date && !!time;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Book Appointment" subtitle="Add a patient and schedule an appointment." />
      <DialogContent sx={dialogContentSx}>
        <Stepper activeStep={done ? 2 : step} sx={{ mb: 3 }}>
          {APPT_STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0 — Add Patient */}
        {step === 0 && !done && (
          <Stack spacing={2}>
            {createPatientMutation.isError && <Alert severity="error">Could not register patient.</Alert>}
            <Stack direction="row" gap={1}>
              <Button size="small" variant={!useExisting ? 'contained' : 'outlined'} onClick={() => setUseExisting(false)}>New Patient</Button>
              <Button size="small" variant={useExisting ? 'contained' : 'outlined'} onClick={() => setUseExisting(true)}>Existing Patient</Button>
            </Stack>
            {useExisting ? (
              <Autocomplete
                options={patients}
                getOptionLabel={(p) => `${p.firstName} ${p.lastName}`}
                value={selectedPatient}
                onChange={(_, v) => {
                  setPatientId(v?.id ?? '');
                  setPatientName(v ? `${v.firstName} ${v.lastName}` : '');
                }}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={(params) => <TextField {...params} label="Search patient" fullWidth />}
              />
            ) : (
              <Box component="form" id="book-patient-form" onSubmit={form.handleSubmit((v) => createPatientMutation.mutate(v))}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                    <TextField label="First name" autoFocus error={!!form.formState.errors.firstName} helperText={form.formState.errors.firstName?.message} {...form.register('firstName')} />
                    <TextField label="Last name" error={!!form.formState.errors.lastName} helperText={form.formState.errors.lastName?.message} {...form.register('lastName')} />
                  </Box>
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field }) => (
                      <PhoneInputField label="Phone (optional)" value={field.value} onChange={field.onChange} />
                    )}
                  />
                  <TextField label="Address (optional)" {...form.register('address')} />
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Controller name="dateOfBirth" control={form.control} render={({ field }) => (
                      <DatePicker label="Date of birth (optional)"
                        value={field.value ? new Date(field.value) : null}
                        onChange={(v) => field.onChange(v ? v.toISOString().slice(0, 10) : '')}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    )} />
                  </LocalizationProvider>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {/* Step 1 — Create Appointment */}
        {step === 1 && !done && (
          <Stack spacing={2}>
            {appointmentMutation.isError && <Alert severity="error">Could not create appointment.</Alert>}
            {patientName && (
              <Typography variant="body2" color="text.secondary">
                Patient: <strong>{patientName}</strong>
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Doctor</InputLabel>
              <Select label="Doctor" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {doctors.map((d) => <MenuItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</MenuItem>)}
              </Select>
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                <DatePicker
                  label="Date"
                  value={date ? new Date(date) : null}
                  onChange={(v) => setDate(v ? v.toLocaleDateString('en-CA') : '')}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <TimePicker
                  label="Time"
                  value={time ? new Date(`1970-01-01T${time}:00`) : null}
                  onChange={(v) => setTime(v ? v.toTimeString().slice(0, 5) : '')}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Box>
            </LocalizationProvider>
            <TextField
              select fullWidth label="Duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <MenuItem key={m} value={m}>{m} min</MenuItem>
              ))}
            </TextField>
            <FormControl fullWidth>
              <InputLabel>Reason (optional)</InputLabel>
              <Select label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}>
                <MenuItem value="">— None —</MenuItem>
                {['Checkup', 'Follow-up', 'Urgent', 'Consultation', 'Lab Results', 'Vaccination'].map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
          </Stack>
        )}

        {done && (
          <Stack alignItems="center" spacing={2} sx={{ py: 2 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'success.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarMonthOutlinedIcon sx={{ fontSize: 36, color: 'success.contrastText' }} />
            </Box>
            <Typography fontWeight={800} fontSize={20}>Appointment Booked!</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {patientName || 'Patient'} · {date} at {time}
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={dialogActionsSx}>
        <Button onClick={handleClose} sx={dialogCancelBtnSx}>{done ? 'Done' : 'Close'}</Button>
        {step === 0 && !done && !useExisting && (
          <SubmitButton form="book-patient-form" type="submit" loading={createPatientMutation.isPending}>
            Next
          </SubmitButton>
        )}
        {step === 0 && !done && useExisting && (
          <SubmitButton disabled={!patientId} onClick={() => setStep(1)}>
            Next
          </SubmitButton>
        )}
        {step === 1 && !done && (
          <SubmitButton disabled={!canSubmitAppt} loading={appointmentMutation.isPending} onClick={() => appointmentMutation.mutate()}>
            Book Appointment
          </SubmitButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PrescriptionFeed(): React.JSX.Element {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const date = new Date().toLocaleDateString('en-CA');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const { data: feed = [] } = useQuery<PrescriptionFeedItem[]>({
    queryKey: ['prescription-feed', date],
    queryFn: () => window.clinic.tokens.listPrescriptions(date),
    refetchInterval: 30_000,
  });
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date) as Promise<Token[]>,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const unsub = realtimeService.onNotification((n: RealtimeNotification) => {
      if (n.payload?.entity === 'prescription') {
        void queryClient.invalidateQueries({ queryKey: ['prescription-feed', date] });
      }
    });
    return unsub;
  }, [date, queryClient]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <MedicalServicesOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography fontWeight={700} fontSize={14}>Prescriptions</Typography>
        {feed.length > 0 && <Chip label={feed.length} size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
      {feed.length === 0 ? (
        <Typography variant="caption" color="text.disabled">No prescriptions yet today.</Typography>
      ) : (
        <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto' }}>
          {feed.map((item) => (
            <Box
              key={item.id}
              sx={{
                p: 1.25,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.12),
                borderLeft: '4px solid',
                borderLeftColor: 'primary.main',
              }}
            >
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block' }}>
                {item.patientName} — Dr. {item.doctorName} (Token #{String(item.tokenNumber).padStart(3, '0')})
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                <Typography variant="caption" color="text.disabled">
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Button
                  size="small"
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setSelectedToken(tokens.find((token) => token.id === item.tokenId) ?? null)}
                  disabled={!tokens.some((token) => token.id === item.tokenId)}
                  sx={{ px: 0, minWidth: 0, fontSize: 11 }}
                >
                  View PDF
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
      {selectedToken && <PrescriptionPrintPreview token={selectedToken} onClose={() => setSelectedToken(null)} />}
    </Paper>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function StatusRing({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}): React.JSX.Element {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <Stack alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={64} thickness={3.5} sx={{ color: alpha(color, 0.15) }} />
        <CircularProgress
          variant="determinate"
          value={pct}
          size={64}
          thickness={3.5}
          sx={{ color, position: 'absolute', left: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
        />
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'common.white' }}>{value}</Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: alpha('#fff', 0.85), fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

function DayStrip({
  selected,
  onSelect,
  appointments,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  appointments: Appointment[];
}): React.JSX.Element {
  const theme = useTheme();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date(selected);
    d.setDate(d.getDate() - 3);
    return d;
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [anchor]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === 'CANCELLED') continue;
      const key = toDayKey(new Date(a.startsAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const monthLabel = days[3]
    ? days[3].toLocaleDateString([], { month: 'long' })
    : selected.toLocaleDateString([], { month: 'long' });

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography fontWeight={800} fontSize={15}>{monthLabel}</Typography>
        <Stack direction="row" spacing={0.25}>
          <IconButton size="small" onClick={() => setAnchor((prev) => { const n = new Date(prev); n.setDate(n.getDate() - 7); return n; })}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setAnchor((prev) => { const n = new Date(prev); n.setDate(n.getDate() + 7); return n; })}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 0.5,
          overflow: 'hidden',
        }}
      >
        {days.map((d) => {
          const active = sameDay(d, selected);
          const count = counts.get(toDayKey(d)) ?? 0;
          return (
            <Box
              key={toDayKey(d)}
              onClick={() => onSelect(d)}
              sx={{
                minWidth: 0,
                px: 0.25,
                py: 1.1,
                borderRadius: 3,
                cursor: 'pointer',
                textAlign: 'center',
                bgcolor: active ? 'primary.main' : 'transparent',
                color: active ? 'primary.contrastText' : 'text.primary',
                boxShadow: active ? `0 8px 18px ${alpha(theme.palette.primary.main, 0.35)}` : 'none',
                transition: '0.2s',
                '&:hover': { bgcolor: active ? 'primary.main' : alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, opacity: active ? 0.9 : 0.55, fontSize: 10 }}>
                {d.toLocaleDateString([], { weekday: 'short' })}
              </Typography>
              <Typography fontWeight={800} fontSize={15} sx={{ lineHeight: 1.3 }}>{d.getDate()}</Typography>
              {count > 0 && (
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    mx: 'auto',
                    mt: 0.5,
                    bgcolor: active ? alpha('#fff', 0.85) : theme.palette.primary.main,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export function ReceptionistDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = useLicense();
  const showBilling = can('billing');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
    refetchInterval: 15_000,
  });
  const { data: patientsData } = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, search: '' }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }),
    refetchInterval: 30_000,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.list,
    refetchInterval: 30_000,
  });
  const { data: doctors = [] } = useQuery<AppointmentPerson[]>({
    queryKey: ['appointment-doctors'],
    queryFn: () => appointmentsService.doctors(),
    refetchInterval: 60_000,
  });

  const today = new Date();
  const todaysAppts = useMemo(
    () =>
      appointments
        .filter((a) => sameDay(new Date(a.startsAt), today) && a.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [appointments, today.getFullYear(), today.getMonth(), today.getDate()],
  );

  const selectedDayAppts = useMemo(
    () =>
      appointments
        .filter((a) => sameDay(new Date(a.startsAt), selectedDate) && a.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [appointments, selectedDate],
  );

  const checkedIn = todaysAppts.filter((a) => a.status === 'CHECKED_IN').length;
  const completedToday = todaysAppts.filter((a) => a.status === 'COMPLETED').length;
  const scheduledToday = todaysAppts.filter((a) => a.status === 'SCHEDULED').length;
  const pendingBilling = invoices.filter((i) => i.status === 'DRAFT').length;
  const paidToday = invoices.filter((i) => {
    if (i.status !== 'PAID') return false;
    return sameDay(new Date(i.createdAt), today);
  }).length;
  const recoveryRate =
    todaysAppts.length > 0 ? `${Math.round((completedToday / todaysAppts.length) * 100)}%` : '—';

  const nextAppt = selectedDayAppts.find((a) => a.status === 'SCHEDULED' || a.status === 'CHECKED_IN') ?? selectedDayAppts[0];

  const doctorStats = useMemo(() => {
    return doctors.slice(0, 6).map((doc) => {
      const count = appointments.filter(
        (a) => a.providerId === doc.id && sameDay(new Date(a.startsAt), selectedDate) && a.status !== 'CANCELLED',
      ).length;
      return { ...doc, todayCount: count };
    });
  }, [doctors, appointments, selectedDate]);

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const isSelectedToday = sameDay(selectedDate, today);

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          Hi {user?.name || 'Receptionist'},
        </Typography>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
          Welcome Back!
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          {/* Primary hero banner */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 4.5 },
              borderRadius: '28px',
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 100%)`,
              color: theme.palette.primary.contrastText,
              position: 'relative',
              overflow: 'hidden',
              minHeight: { xs: 220, sm: 260 },
              display: 'flex',
              alignItems: 'center',
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.28)}`,
              border: 'none',
            }}
          >
            <Box sx={{ position: 'absolute', right: -10, top: -40, width: 220, height: 220, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.12)}` }} />
            <Box sx={{ position: 'absolute', right: 80, bottom: -70, width: 180, height: 180, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.08)}` }} />
            <Box sx={{ position: 'relative', zIndex: 1, maxWidth: { xs: '100%', sm: '48%' }, pr: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.88, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Reception Desk
              </Typography>
              <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 1, lineHeight: 1.3, textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}` }}>
                Clinic Update
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                {todaysAppts.length} patient{todaysAppts.length === 1 ? '' : 's'} on today&apos;s queue
                {checkedIn > 0 ? `, ${checkedIn} checked in` : ''}. Keep the front desk flowing smoothly.
              </Typography>
            </Box>

            {/* Illustration cluster — sits ~20px above banner bottom */}
            <Box
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                right: { sm: 8, md: 20 },
                bottom: 0,
                width: { sm: 280, md: 320 },
                height: { sm: 210, md: 230 },
                zIndex: 1,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >

              {CLINIC_CLUSTER.map((img) => (
                <Box
                  key={img.alt}
                  component="img"
                  src={img.src}
                  alt={img.alt}
                  sx={{
                    position: 'absolute',
                    top: img.top,
                    left: img.left,
                    width: img.w,
                    height: 'auto',
                    objectFit: 'contain',
                    transform: `rotate(${img.rot}deg)`,
                    zIndex: img.z,
                    opacity: img.opacity,
                    filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.28))',
                    userSelect: 'none',
                  }}
                />
              ))}
            </Box>
          </Paper>

          {/* Status rings + metric grid */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: 'none',
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(160deg, ${theme.palette.grey[900]} 0%, #1a2e22 100%)`
                  : `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${darken(theme.palette.primary.main, 0.42)} 100%)`,
                boxShadow: `0 8px 24px ${alpha(
                  theme.palette.mode === 'dark' ? theme.palette.common.black : theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.35 : 0.22,
                )}`,
                color: theme.palette.common.white,
              }}
            >
              <Typography fontWeight={800} fontSize={16} sx={{ color: alpha(theme.palette.common.white, 0.7), mb: 2 }}>
                Today&apos;s status
              </Typography>
              <Stack direction="row" spacing={1}>
                <StatusRing label="Scheduled" value={scheduledToday} total={todaysAppts.length || 1} color={theme.palette.info.light} />
                <StatusRing label="Checked in" value={checkedIn} total={todaysAppts.length || 1} color={theme.palette.warning.light} />
                <StatusRing label="Completed" value={completedToday} total={todaysAppts.length || 1} color={theme.palette.primary.light} />
              </Stack>
            </Paper>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              {[
                { label: 'Total Patients', value: patientsData?.total ?? 0, bg: alpha(theme.palette.grey[500], 0.12) },
                { label: 'Patients Today', value: todaysAppts.length, bg: alpha(theme.palette.success.main, 0.14), accent: theme.palette.success.dark },
                { label: 'Pending Billing', value: pendingBilling, bg: alpha(theme.palette.info.main, 0.12), accent: theme.palette.info.dark },
                { label: 'Completion Rate', value: recoveryRate, bg: alpha(theme.palette.secondary.main, 0.12), accent: theme.palette.secondary.dark },
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
          </Box>

          {/* Day queue */}
          <Paper elevation={0} sx={{ p: 2.5, ...softCard, borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800} fontSize={16}>
                  {isSelectedToday ? "Today's Queue" : 'Day Queue'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  {paidToday > 0 && isSelectedToday ? ` · ${paidToday} paid invoice${paidToday === 1 ? '' : 's'} today` : ''}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate('/appointments')} sx={{ fontWeight: 700 }}>
                View all
              </Button>
            </Stack>
            {isLoading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : selectedDayAppts.length === 0 ? (
              <Box sx={{ display: 'grid', minHeight: 100, placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">No appointments for this day.</Typography>
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
                {selectedDayAppts.map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      border: `1px solid ${theme.palette.divider}`,
                      borderLeft: '4px solid',
                      borderLeftColor:
                        statusColor[a.status] && statusColor[a.status] !== 'default'
                          ? `${statusColor[a.status]}.main`
                          : 'divider',
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
                      {a.patient.firstName[0]}
                      {a.patient.lastName[0]}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {a.patient.firstName} {a.patient.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · Dr. '}
                        {a.provider.firstName} {a.provider.lastName}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={a.status.replace('_', ' ')}
                      color={statusColor[a.status]}
                      sx={{ borderRadius: 1, fontSize: 10 }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>

        {/* ── RIGHT SIDEBAR ── */}
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <DayStrip selected={selectedDate} onSelect={setSelectedDate} appointments={appointments} />

          {/* Quick actions */}
          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Typography fontWeight={800} fontSize={14} sx={{ mb: 1.5 }}>Quick Actions</Typography>
            <Stack spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<ConfirmationNumberOutlinedIcon />}
                onClick={() => setWalkInOpen(true)}
                fullWidth
                sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.15, fontWeight: 700 }}
              >
                Walk-in Registration
              </Button>
              <Button
                variant="outlined"
                startIcon={<CalendarMonthOutlinedIcon />}
                onClick={() => setApptDialogOpen(true)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  py: 1.15,
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                  color: theme.palette.primary.main,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: theme.palette.primary.main },
                }}
              >
                Book Appointment
              </Button>
              {showBilling && (
              <Button
                variant="outlined"
                startIcon={<PaymentsOutlinedIcon />}
                onClick={() => setInvoiceDialogOpen(true)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  py: 1.15,
                  borderColor: alpha(theme.palette.success.main, 0.4),
                  color: theme.palette.success.main,
                  '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.06), borderColor: theme.palette.success.main },
                }}
              >
                Create Invoice
              </Button>
              )}
            </Stack>
          </Paper>

          {/* Featured next appointment */}
          {nextAppt && (
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
              <Box
                component="img"
                src={imgVirus}
                alt=""
                sx={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 700 }}>
                  {isSelectedToday ? 'Up next' : 'Featured'}
                </Typography>
                <Typography fontWeight={800} fontSize={15} sx={{ mt: 0.15 }} noWrap>
                  {nextAppt.patient.firstName} {nextAppt.patient.lastName}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mt: 0.35 }}>
                  {new Date(nextAppt.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(nextAppt.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · Dr. '}
                  {nextAppt.provider.firstName} {nextAppt.provider.lastName}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Doctor list */}
          <Paper elevation={0} sx={{ p: 2, ...softCard }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography fontWeight={800} fontSize={14}>Doctors</Typography>
              <Typography variant="caption" color="text.secondary">{doctors.length} on staff</Typography>
            </Stack>
            {doctorStats.length === 0 ? (
              <Typography variant="caption" color="text.disabled">No doctors found.</Typography>
            ) : (
              <Stack spacing={1}>
                {doctorStats.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderLeft: '4px solid',
                      borderLeftColor: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: 'primary.main',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {doc.firstName[0]}
                      {doc.lastName[0]}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} fontSize={13} noWrap>
                        Dr. {doc.firstName} {doc.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        {doc.todayCount} appointment{doc.todayCount === 1 ? '' : 's'} today
                      </Typography>
                    </Box>
                    {doc.todayCount > 0 && (
                      <Chip
                        size="small"
                        label={doc.todayCount}
                        color="primary"
                        sx={{ height: 22, minWidth: 28, fontSize: 11, fontWeight: 700, borderRadius: 1 }}
                      />
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <PrescriptionFeed />
        </Stack>
      </Box>

      <WalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <BookAppointmentModal open={apptDialogOpen} onClose={() => setApptDialogOpen(false)} />
      <InvoiceDialog
        open={invoiceDialogOpen}
        onClose={() => setInvoiceDialogOpen(false)}
        onCreated={() => {
          void navigate('/billing');
        }}
      />
    </>
  );
}
