import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton,
  Step, StepLabel, Stepper, Stack, TextField, Typography, Chip, Avatar,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps, telInputDialogProps,
} from '@/components/DialogUI';
import { ListCardsSkeleton } from '@/components/LoadingUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { GenderRadioGroup } from '@/components/GenderRadioGroup';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { useDebounce } from '@/hooks/useDebounce';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { printTokenSlip } from '@/utils/printTokenSlip';
import { usePrintAppointmentToken, loadTokenForAppointment } from '@/features/appointments/printAppointmentToken';
import { InvoiceDialog } from '@/features/billing/InvoicesPage';
import { AppointmentWhatsAppDialog } from '@/features/appointments/AppointmentWhatsAppDialog';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { useNavigate } from 'react-router-dom';
import type { TokenPerson, Token, PrescriptionFeedItem } from '@/types/token';
import type { PatientInput } from '@/types/patient';
import type { Appointment, AppointmentPerson } from '@/types/appointment';
import { TokenFeeFields } from '@/features/tokens/TokenFeeFields';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { LiveClock } from '@/components/LiveClock';
import { nextFreeSlot, doctorOfflineReason, slotSearchFrom, type SlotAdjustReason } from '@/utils/appointmentSlot';
import { ageToDateOfBirth, dateOfBirthToAge } from '@shared/patientAge';
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

const VISIT_REASONS = ['Checkup', 'Follow-up', 'Urgent', 'Consultation', 'Vaccination'] as const;

/* ── Merged Walk-in Modal ── */
const STEPS = ['Select Patient', 'Issue Token', 'Print Token'];

function WalkInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useLicense();
  const showLabReason = can('labDashboard');
  const [step, setStep] = useState(0);
  const [createdToken, setCreatedToken] = useState<Token | null>(null);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [feeDiscount, setFeeDiscount] = useState('');
  const [previewToken, setPreviewToken] = useState<Token | null>(null);
  const [previewAutoPrint, setPreviewAutoPrint] = useState(false);

  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
    enabled: open,
    staleTime: 60_000,
  });

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId) ?? null, [doctors, doctorId]);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const {
    data: walkSchedule = [],
    isFetched: walkScheduleFetched,
    isFetching: walkScheduleFetching,
  } = useQuery({
    queryKey: ['schedule', doctorId],
    queryFn: () => window.clinic.schedule.get(doctorId),
    enabled: open && Boolean(doctorId) && step === 1,
  });
  const walkOfflineReason = doctorId && walkScheduleFetched && !walkScheduleFetching
    ? doctorOfflineReason(walkSchedule, todayStr)
    : null;
  const walkScheduleReady = Boolean(doctorId) && walkScheduleFetched && !walkScheduleFetching;

  useEffect(() => {
    if (!open || !selectedDoctor) return;
    if (reason === 'Free') {
      setConsultationFee('0');
      setFeeDiscount('');
      return;
    }
    setConsultationFee(String(Number(selectedDoctor.consultationFee ?? 0)));
    setFeeDiscount('');
  }, [open, selectedDoctor, reason]);

  const { data: weekVisits } = useQuery({
    queryKey: ['token-week-visits', patientId, doctorId, todayStr],
    queryFn: () =>
      window.clinic.tokens.weekVisits(patientId, doctorId, todayStr).catch(() => ({ count: 0 })),
    enabled: open && step === 1 && Boolean(patientId && doctorId),
  });

  const tokenMutation = useMutation({
    mutationFn: async () => {
      if (!patientId || !doctorId) throw new Error('Select a patient and doctor first.');
      const startsAt = slotSearchFrom(todayStr);
      const endsAt = new Date(startsAt.getTime() + 15 * 60000);
      const fee = parseFloat(consultationFee) || 0;
      const discount = parseFloat(feeDiscount) || 0;
      const isHalf = fee > 0 && discount > 0 && Math.abs(discount - fee / 2) <= 1;
      const feeType = fee === 0 || discount >= fee ? 'FREE' : isHalf ? 'HALF' : discount > 0 ? 'DISCOUNTED' : 'PAID';
      await appointmentsService.ensureSameDay({
        patientId,
        providerId: doctorId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: reason || null,
        notes: null,
        recurrenceRule: null,
        feeType,
      });
      const token = await window.clinic.tokens.create({
        patientId, doctorId,
        date: todayStr,
        reason: reason || null,
        consultationFee: parseFloat(consultationFee) || 0,
        feeDiscount: parseFloat(feeDiscount) || 0,
      }) as Token;
      if (token.status === 'WAITING') return token;
      return window.clinic.tokens.updateStatus(token.id, 'WAITING') as Promise<Token>;
    },
    onSuccess: async (token: Token) => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setCreatedToken(token);
      setStep(2);
      void printTokenSlip(token, { silent: true }).catch(() => {
        /* keep Token Issued step even if printer fails */
      });
    },
    meta: { silent: true },
  });

  function handleClose() {
    setStep(0); setPatientId(''); setDoctorId(''); setReason('');
    setConsultationFee(''); setFeeDiscount('');
    setCreatedToken(null);
    setPreviewToken(null);
    setPreviewAutoPrint(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps} {...telInputDialogProps}>
      <FormDialogTitle title="Walk-in Registration" subtitle="Register or select a patient and issue a token." />
      <DialogContent sx={dialogContentSx}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0 — Select / Add Patient */}
        {step === 0 && (
          <Stack spacing={2} sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Search a patient by name, phone or MR#, or click "+ Add new patient" to register.
            </Typography>
            <PatientAutocomplete
              value={patientId}
              onChange={(id) => setPatientId(id)}
              label="Patient"
              autoFocus
            />
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
            {walkOfflineReason && (
              <Alert severity="error">{walkOfflineReason}</Alert>
            )}
            <Autocomplete
              options={doctors}
              getOptionLabel={(d) => `Dr. ${d.firstName} ${d.lastName}`}
              value={doctors.find((d) => d.id === doctorId) ?? null}
              onChange={(_, v) => setDoctorId(v?.id ?? '')}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <DoctorAvatar src={option.avatar} name={`Dr. ${option.firstName} ${option.lastName}`} size={32} />
                  <Typography fontSize={13.5} fontWeight={600} sx={{ flex: 1 }} noWrap>
                    Dr. {option.firstName} {option.lastName}
                  </Typography>
                  <Typography fontSize={13} fontWeight={700} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Rs. {new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(option.consultationFee) || 0)}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => {
                const selected = doctors.find((d) => d.id === doctorId);
                return (
                  <TextField
                    {...params}
                    label="Doctor"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: selected ? (
                        <>
                          <DoctorAvatar
                            src={selected.avatar}
                            name={`Dr. ${selected.firstName} ${selected.lastName}`}
                            size={24}
                            sx={{ ml: 0.5, mr: 0.5 }}
                          />
                          {params.InputProps.startAdornment}
                        </>
                      ) : params.InputProps.startAdornment,
                    }}
                  />
                );
              }}
            />
            <TokenFeeFields
              consultationFee={consultationFee}
              feeDiscount={feeDiscount}
              onFeeChange={setConsultationFee}
              onDiscountChange={setFeeDiscount}
              defaultDoctorFee={selectedDoctor?.consultationFee}
              priorVisitsThisWeek={weekVisits?.count ?? 0}
              disabled={!doctorId}
            />
            <FormControl fullWidth>
              <InputLabel>Reason (optional)</InputLabel>
              <Select
                label="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <MenuItem value="">— None —</MenuItem>
                {VISIT_REASONS.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
                {showLabReason && <MenuItem value="Lab Results">Lab Results</MenuItem>}
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
            <Paper
              variant="outlined"
              sx={{
                px: 4,
                py: 2,
                textAlign: 'center',
                borderRadius: 1,
                minWidth: 220,
              }}
            >
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
        {step === 0 && (
          <SubmitButton disabled={!patientId} onClick={() => setStep(1)}>
            Next
          </SubmitButton>
        )}
        {step === 1 && (
          <SubmitButton
            disabled={!doctorId || !walkScheduleReady || Boolean(walkOfflineReason)}
            loading={tokenMutation.isPending || Boolean(doctorId && !walkScheduleReady)}
            onClick={() => tokenMutation.mutate()}
          >
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
              setPreviewAutoPrint(false);
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
const APPT_STEPS = ['Select Patient', 'Create Appointment'];

function BookAppointmentModal({
  open,
  onClose,
  onCreatedAppointment,
}: {
  open: boolean;
  onClose: () => void;
  onCreatedAppointment?: (appt: Appointment) => void;
}) {
  const qc = useQueryClient();
  const { can } = useLicense();
  const showLabReason = can('labDashboard');
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(15);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [slotNotice, setSlotNotice] = useState<SlotAdjustReason | null>(null);

  const { data: patients = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: doctors = [] } = useQuery<AppointmentPerson[]>({
    queryKey: ['doctors'],
    queryFn: appointmentsService.doctors,
    enabled: open,
    staleTime: 60_000,
  });
  const { data: schedule = [], isFetched: scheduleFetched } = useQuery({
    queryKey: ['schedule', providerId],
    queryFn: () => window.clinic.schedule.get(providerId),
    enabled: open && Boolean(providerId),
    staleTime: 60_000,
  });
  const { data: rawAppts = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
    enabled: open,
    staleTime: 30_000,
  });
  const doctorAppts = rawAppts as Appointment[];
  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId) ?? null, [patients, patientId]);

  const daySlot = useMemo(() => {
    if (!date || schedule.length === 0) return undefined;
    const day = new Date(`${date}T12:00:00`).getDay();
    return schedule.find((s) => s.dayOfWeek === day);
  }, [schedule, date]);
  const hoursLabel = daySlot?.isActive
    ? `${daySlot.startTime}–${daySlot.endTime}`
    : null;
  const offlineReason = providerId && date && scheduleFetched
    ? doctorOfflineReason(schedule, date)
    : null;

  const { data: tokenForPatient } = useQuery<Token | null>({
    queryKey: ['token-for-patient', patientId, date],
    queryFn: () => window.clinic.tokens.getForPatient(patientId, date) as Promise<Token | null>,
    enabled: open && !!patientId && !!date,
  });

  useEffect(() => {
    if (!open || !providerId) return;
    const next = nextFreeSlot({
      schedule,
      appointments: doctorAppts,
      providerId,
      durationMin: duration,
      from: slotSearchFrom(date),
    });
    if (!next) return;
    setDate((prev) => (prev !== next.date ? next.date : prev));
    setTime((prev) => (prev !== next.time ? next.time : prev));
    setSlotNotice((prev) => (prev !== next.reason ? next.reason : prev));
  }, [open, providerId, duration, schedule, doctorAppts]);

  const appointmentMutation = useMutation({
    mutationFn: () => {
      const startsAt = new Date(`${date}T${time}:00`);
      return appointmentsService.create({
        patientId,
        providerId,
        tokenId: tokenForPatient?.id ?? null,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + duration * 60000).toISOString(),
        reason: reason || null,
        notes: notes || null,
        recurrenceRule: null,
      });
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setDone(true);
      if (saved && typeof saved === 'object') {
        const doc = doctors.find((d) => d.id === providerId);
        const pat = selectedPatient ?? { id: patientId, firstName: patientName, lastName: '', role: 'patient' };
        const raw = saved as Appointment;
        const fullAppt: Appointment = {
          ...raw,
          patient: raw.patient?.firstName ? raw.patient : (pat as unknown as AppointmentPerson),
          provider: raw.provider?.firstName ? raw.provider : (doc ?? { id: providerId, firstName: '', lastName: '', role: 'doctor' }),
        };
        onCreatedAppointment?.(fullAppt);
      }
    },
    onError: (err) => {
      const msg = (err as Error)?.message || '';
      if (msg.includes('busy') || msg.includes('slot')) {
        const next = nextFreeSlot({
          schedule,
          appointments: doctorAppts,
          providerId,
          durationMin: duration,
          from: slotSearchFrom(date),
        });
        if (next) {
          setDate(next.date);
          setTime(next.time);
          setSlotNotice('busy');
        }
      }
    },
    meta: { silent: true },
  });

  function handleClose() {
    setStep(0); setPatientId(''); setPatientName('');
    setProviderId(''); setDate(new Date().toLocaleDateString('en-CA'));
    setTime(new Date().toTimeString().slice(0, 5)); setDuration(15);
    setReason(''); setNotes(''); setDone(false);
    setSlotNotice(null);
    onClose();
  }

  const canSubmitAppt = !!patientId && !!providerId && !!date && !!time && !offlineReason;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps} {...telInputDialogProps}>
      <FormDialogTitle title="Book Appointment" subtitle="Add a patient and schedule an appointment." />
      <DialogContent sx={dialogContentSx}>
        <Stepper activeStep={done ? 2 : step} sx={{ mb: 3 }}>
          {APPT_STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0 — Select / Add Patient */}
        {step === 0 && !done && (
          <Stack spacing={2} sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Search a patient by name, phone or MR#, or click "+ Add new patient" to register.
            </Typography>
            <PatientAutocomplete
              value={patientId}
              onChange={(id, p) => {
                setPatientId(id);
                setPatientName(p ? `${p.firstName} ${p.lastName ?? ''}`.trim() : '');
              }}
              label="Patient"
              autoFocus
            />
          </Stack>
        )}

        {/* Step 1 — Create Appointment */}
        {step === 1 && !done && (
          <Stack spacing={2}>
            {appointmentMutation.isError && (
              <Alert severity="error">
                {(appointmentMutation.error as Error)?.message || 'Could not create appointment.'}
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
            {patientName && (
              <Typography variant="body2" color="text.secondary">
                Patient: <strong>{patientName}</strong>
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Doctor</InputLabel>
              <Select
                label="Doctor"
                value={providerId}
                onChange={(e) => {
                  const newProvId = e.target.value;
                  setProviderId(newProvId);
                  if (newProvId) {
                    const next = nextFreeSlot({
                      schedule,
                      appointments: doctorAppts,
                      providerId: newProvId,
                      durationMin: duration,
                      from: slotSearchFrom(date),
                    });
                    if (next) {
                      setDate(next.date);
                      setTime(next.time);
                      setSlotNotice(next.reason);
                    }
                  }
                }}
                renderValue={(value) => {
                  const d = doctors.find((doc) => doc.id === value);
                  if (!d) return '';
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DoctorAvatar src={d.avatar} name={`Dr. ${d.firstName} ${d.lastName}`} size={22} />
                      <Typography component="span" fontSize={13.5} fontWeight={600}>
                        Dr. {d.firstName} {d.lastName}
                      </Typography>
                    </Box>
                  );
                }}
              >
                {doctors.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%' }}>
                      <DoctorAvatar src={d.avatar} name={`Dr. ${d.firstName} ${d.lastName}`} size={28} />
                      <Typography fontSize={13.5} fontWeight={600} sx={{ flex: 1 }}>
                        Dr. {d.firstName} {d.lastName}
                      </Typography>
                      <Typography fontSize={13} fontWeight={700} color="text.secondary">
                        Rs. {new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(d.consultationFee) || 0)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                <DatePicker
                  label="Date"
                  value={date ? new Date(`${date}T12:00:00`) : null}
                  onChange={(v) => {
                    if (!v || !providerId) {
                      setDate(v ? v.toLocaleDateString('en-CA') : '');
                      return;
                    }
                    const dateStr = v.toLocaleDateString('en-CA');
                    const next = nextFreeSlot({
                      schedule,
                      appointments: doctorAppts,
                      providerId,
                      durationMin: duration,
                      from: slotSearchFrom(dateStr),
                    });
                    if (next) {
                      setDate(next.date);
                      setTime(next.time);
                      setSlotNotice(next.reason);
                    } else {
                      setDate(v.toLocaleDateString('en-CA'));
                    }
                  }}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <TimePicker
                  label="Time"
                  value={time ? new Date(`1970-01-01T${time}:00`) : null}
                  onChange={(v) => {
                    const picked = v ? v.toTimeString().slice(0, 5) : '';
                    if (!picked || !providerId || !date) {
                      setTime(picked);
                      return;
                    }
                    const next = nextFreeSlot({
                      schedule,
                      appointments: doctorAppts,
                      providerId,
                      durationMin: duration,
                      from: new Date(`${date}T${picked}:00`),
                    });
                    if (next) {
                      setDate(next.date);
                      setTime(next.time);
                      setSlotNotice(next.reason);
                    } else {
                      setTime(picked);
                    }
                  }}
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
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
                {VISIT_REASONS.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
                {showLabReason && <MenuItem value="Lab Results">Lab Results</MenuItem>}
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
        {step === 0 && !done && (
          <SubmitButton disabled={!patientId} onClick={() => setStep(1)}>
            Next
          </SubmitButton>
        )}
        {step === 1 && !done && (
          <SubmitButton
            disabled={!canSubmitAppt}
            loading={appointmentMutation.isPending}
            onClick={() => appointmentMutation.mutate()}
          >
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
    staleTime: 30_000,
  });
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date) as Promise<Token[]>,
    staleTime: 30_000,
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

function AttentionStat({
  label,
  hint,
  value,
  tone,
  icon,
  onClick,
}: {
  label: string;
  hint?: string;
  value: number;
  tone: 'warning' | 'error' | 'info';
  icon: ReactNode;
  onClick?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const active = value > 0;
  const alertColor = theme.palette[tone].main;

  return (
    <Box
      onClick={onClick}
      sx={{
        minWidth: 0,
        px: 1.75,
        py: 1.5,
        borderRadius: 1,
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.04)
          : alpha(theme.palette.common.black, 0.03),
        border: '1px solid',
        borderColor: active ? alpha(alertColor, 0.45) : 'divider',
        borderLeft: '3px solid',
        borderLeftColor: active ? alertColor : 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          bgcolor: alpha(alertColor, theme.palette.mode === 'dark' ? 0.1 : 0.06),
          borderColor: alpha(alertColor, 0.5),
          borderLeftColor: alertColor,
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(alertColor, active ? 0.18 : 0.08),
          color: active ? alertColor : 'text.disabled',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap>
          {label}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Typography
        fontWeight={800}
        fontSize={22}
        sx={{ lineHeight: 1, color: active ? alertColor : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
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
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = useLicense();
  const showBilling = can('billing');
  const tokenPrint = usePrintAppointmentToken();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [whatsAppCreatedAppt, setWhatsAppCreatedAppt] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const issueTokenMutation = useMutation({
    mutationFn: async (appointment: Appointment) => {
      const updated = await appointmentsService.updateStatus(appointment.id, 'CHECKED_IN');
      return { appointment, updated };
    },
    onSuccess: async ({ appointment, updated }) => {
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      try {
        const apptToPrint = updated ?? appointment;
        tokenPrint.printFor(apptToPrint);
        const token = await loadTokenForAppointment(apptToPrint);
        if (token) {
          void printTokenSlip(token, { silent: true }).catch(() => {});
        }
      } catch {
        // ignore printer errors
      }
    },
    meta: {
      toast: 'Token issued & patient checked in!',
      errorToast: 'Failed to issue token.',
    },
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
    staleTime: 30_000,
  });
  const { data: patientsData } = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, search: '' }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }),
    staleTime: 30_000,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.list,
    staleTime: 30_000,
    enabled: showBilling,
  });
  const { data: doctors = [] } = useQuery<AppointmentPerson[]>({
    queryKey: ['appointment-doctors'],
    queryFn: () => appointmentsService.doctors(),
    staleTime: 60_000,
  });
  const todayKey = toDayKey(new Date());
  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ['tokens', todayKey],
    queryFn: () => window.clinic.tokens.list(todayKey) as Promise<Token[]>,
    staleTime: 30_000,
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
  const nowMs = Date.now();
  const waitingNow = tokens.filter((token) => token.status === 'WAITING').length;
  const lateArrivals = todaysAppts.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.startsAt).getTime() <= nowMs,
  ).length;
  const unpaidBills = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID').length;
  const upcomingToday = todaysAppts.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.startsAt).getTime() > nowMs,
  ).length;
  const todayBilled = invoices
    .filter((i) => i.status !== 'VOID' && sameDay(new Date(i.createdAt), today))
    .reduce((sum, i) => sum + Number(i.total || 0), 0);
  const paidToday = invoices.filter((i) => {
    if (i.status !== 'PAID') return false;
    return sameDay(new Date(i.createdAt), today);
  }).length;
  const todayBillLabel = `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(todayBilled)}`;

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
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2.5, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Hi {user?.name || 'Receptionist'},
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
            Welcome Back!
          </Typography>
        </Box>
        <LiveClock />
      </Stack>

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

          {/* Attention strip — no outer box */}
          <Box>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, letterSpacing: '0.02em' }}>
              Needs attention
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
              <AttentionStat
                label="In queue"
                hint="waiting for doctor"
                value={waitingNow}
                tone="warning"
                icon={<GroupsOutlinedIcon fontSize="small" />}
                onClick={() => navigate('/tokens')}
              />
              <AttentionStat
                label="Late check-in"
                hint="appointment time passed"
                value={lateArrivals}
                tone="error"
                icon={<AccessTimeOutlinedIcon fontSize="small" />}
                onClick={() => navigate('/appointments')}
              />
              {showBilling ? (
                <AttentionStat
                  label="Unpaid bills"
                  hint="to collect"
                  value={unpaidBills}
                  tone="info"
                  icon={<ReceiptLongOutlinedIcon fontSize="small" />}
                  onClick={() => navigate('/billing')}
                />
              ) : (
                <AttentionStat
                  label="Upcoming"
                  hint="appointments left"
                  value={upcomingToday}
                  tone="info"
                  icon={<EventOutlinedIcon fontSize="small" />}
                  onClick={() => navigate('/appointments')}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: 1, minHeight: 88 }}>
                  <Skeleton variant="text" width={56} height={28} />
                  <Skeleton variant="text" width={90} height={16} />
                </Paper>
              ))
            ) : (
            [
              { label: 'Total Patients', value: patientsData?.total ?? 0, bg: alpha(theme.palette.grey[500], 0.12) },
              { label: 'Patients Today', value: todaysAppts.length, bg: alpha(theme.palette.success.main, 0.14), accent: theme.palette.success.dark },
              ...(showBilling
                ? [{ label: 'Total today bill', value: todayBillLabel, bg: alpha(theme.palette.info.main, 0.12), accent: theme.palette.info.dark }]
                : []),
              { label: 'Completed today', value: completedToday, bg: alpha(theme.palette.secondary.main, 0.12), accent: theme.palette.secondary.dark },
            ].map((m) => (
              <Paper
                key={m.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 1,
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
            ))
            )}
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
                  {showBilling && paidToday > 0 && isSelectedToday ? ` · ${paidToday} paid invoice${paidToday === 1 ? '' : 's'} today` : ''}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate('/appointments')} sx={{ fontWeight: 700 }}>
                View all
              </Button>
            </Stack>
            {isLoading ? (
              <ListCardsSkeleton count={5} />
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
                {selectedDayAppts.slice(0, 20).map((a) => {
                  const hasToken = Boolean(a.tokenNumber);
                  const canIssueToken = !hasToken && !['CANCELLED', 'COMPLETED'].includes(a.status);
                  const isPending = issueTokenMutation.isPending && issueTokenMutation.variables?.id === a.id;

                  return (
                    <Box
                      key={a.id}
                      onClick={() => navigate(`/appointments/${a.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        border: `1px solid ${theme.palette.divider}`,
                        borderLeft: '4px solid',
                        borderLeftColor:
                          statusColor[a.status] && statusColor[a.status] !== 'default'
                            ? `${statusColor[a.status]}.main`
                            : 'divider',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.07) },
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
                          flexShrink: 0,
                        }}
                      >
                        {a.patient.firstName[0]}
                        {a.patient.lastName?.[0] ?? ''}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {a.patient.firstName} {a.patient.lastName || ''}
                          </Typography>
                          {hasToken ? (
                            <Chip
                              size="small"
                              label={`Token #${String(a.tokenNumber).padStart(2, '0')}`}
                              color="primary"
                              variant="filled"
                              sx={{
                                height: 20,
                                fontSize: 10.5,
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                borderRadius: '4px',
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · Dr. '}
                          {a.provider.firstName} {a.provider.lastName}
                        </Typography>
                      </Box>

                      {/* Right Action buttons */}
                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}
                      >
                        {canIssueToken ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 15 }} />}
                            disabled={isPending}
                            onClick={() => issueTokenMutation.mutate(a)}
                            sx={{
                              borderRadius: 1.5,
                              fontWeight: 700,
                              fontSize: 11.5,
                              py: 0.4,
                              px: 1.25,
                              boxShadow: 'none',
                              whiteSpace: 'nowrap',
                              '&:hover': {
                                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                              },
                            }}
                          >
                            {isPending ? 'Issuing...' : 'Issue Token'}
                          </Button>
                        ) : null}

                        {hasToken ? (
                          <IconButton
                            size="small"
                            title="Print token slip"
                            onClick={() => tokenPrint.printFor(a)}
                            sx={{
                              color: 'text.secondary',
                              p: 0.5,
                              '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) },
                            }}
                          >
                            <PrintOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        ) : null}

                        <Chip
                          size="small"
                          label={a.status.replace('_', ' ')}
                          color={statusColor[a.status]}
                          sx={{ borderRadius: 1, fontSize: 10, fontWeight: 600 }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
            {selectedDayAppts.length > 20 && (
              <Box sx={{ pt: 1.5, mt: 1.5, textAlign: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/appointments')}
                  sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
                >
                  View all ({selectedDayAppts.length} appointments)
                </Button>
              </Box>
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
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 700 }}>
                    {isSelectedToday ? 'Up next' : 'Featured'}
                  </Typography>
                  {nextAppt.tokenNumber ? (
                    <Chip
                      size="small"
                      label={`Token #${String(nextAppt.tokenNumber).padStart(2, '0')}`}
                      sx={{
                        height: 20,
                        bgcolor: 'rgba(255, 255, 255, 0.22)',
                        color: '#ffffff',
                        fontSize: 10.5,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        borderRadius: '4px',
                      }}
                    />
                  ) : null}
                </Box>
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
                {nextAppt.status === 'SCHEDULED' && !nextAppt.tokenNumber && isSelectedToday && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={issueTokenMutation.isPending && issueTokenMutation.variables?.id === nextAppt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      issueTokenMutation.mutate(nextAppt);
                    }}
                    startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      mt: 1,
                      bgcolor: '#ffffff',
                      color: 'primary.dark',
                      fontWeight: 800,
                      fontSize: 11,
                      py: 0.3,
                      px: 1.2,
                      borderRadius: 1.5,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: alpha('#ffffff', 0.92) },
                    }}
                  >
                    {issueTokenMutation.isPending && issueTokenMutation.variables?.id === nextAppt.id ? 'Issuing...' : 'Issue Token'}
                  </Button>
                )}
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
                    <DoctorAvatar
                      src={doc.avatar}
                      name={`Dr. ${doc.firstName} ${doc.lastName}`}
                      size={36}
                      sx={{ borderRadius: 1 }}
                    />
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
      <BookAppointmentModal
        open={apptDialogOpen}
        onClose={() => setApptDialogOpen(false)}
        onCreatedAppointment={(appt) => setWhatsAppCreatedAppt(appt)}
      />
      <AppointmentWhatsAppDialog
        open={Boolean(whatsAppCreatedAppt)}
        appointment={whatsAppCreatedAppt}
        onClose={() => setWhatsAppCreatedAppt(null)}
      />
      <InvoiceDialog
        open={invoiceDialogOpen}
        onClose={() => setInvoiceDialogOpen(false)}
        onCreated={() => {
          void navigate('/billing');
        }}
      />
      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </>
  );
}
