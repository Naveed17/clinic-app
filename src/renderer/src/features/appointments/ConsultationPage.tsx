import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import BloodtypeOutlinedIcon from '@mui/icons-material/BloodtypeOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LiveClock } from '@/components/LiveClock';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import {
  FormDialogTitle,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
  dialogSubmitBtnSx,
} from '@/components/DialogUI';
import { showAppToast } from '@/components/AppToast';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { AppointmentVisitList } from '@/features/appointments/AppointmentVisitList';
import { AppointmentWhatsAppDialog } from '@/features/appointments/AppointmentWhatsAppDialog';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { PrescriptionPadDialog } from '@/features/tokens/PrescriptionPadDialog';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { PatientDocumentsPanel } from '@/features/patients/PatientDocumentsPanel';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import { OrderLabDialog } from '@/features/lab/OrderLabDialog';
import { VitalsDialog, PriorityBadge } from '@/features/waiting-room/VitalsDialog';
import type { Appointment, AppointmentInput } from '@/types/appointment';
import type { Patient, PatientInput } from '@/types/patient';
import type { Token, Prescription, TokenVitals } from '@/types/token';
import type { LabOrder } from '@/types/lab';
import {
  ConsultationClock,
  getConsultationStartMs,
  clearConsultationStartMs,
  formatElapsed,
} from './ConsultationClock';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function personName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

function calcAge(dob: Date | string | null | undefined): string {
  if (!dob) return '';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? `${age} yrs` : '';
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function money(v: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
}

function initials(first?: string | null, last?: string | null): string {
  return [(first ?? '')[0], (last ?? '')[0]].filter(Boolean).join('').toUpperCase();
}

/* ─── Stat Card ────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  note,
  icon,
  accentColor,
}: {
  label: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
  accentColor: string;
}): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: '18px',
        bgcolor: isDark ? alpha(theme.palette.background.paper, 0.7) : '#ffffff',
        border: `1px solid ${isDark ? theme.palette.divider : alpha(theme.palette.divider, 0.6)}`,
        borderLeft: `3px solid ${accentColor}`,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        boxShadow: isDark
          ? `0 4px 20px ${alpha('#000', 0.25)}`
          : `0 4px 18px ${alpha('#000', 0.04)}, 0 1px 3px ${alpha('#000', 0.02)}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? `0 8px 28px ${alpha(accentColor, 0.25)}`
            : `0 8px 24px ${alpha(accentColor, 0.18)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 70,
          height: 70,
          borderRadius: '50%',
          bgcolor: alpha(accentColor, 0.08),
        }}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 800,
              color: 'text.secondary',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              mb: 0.5,
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: 22,
              fontWeight: 900,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {value}
          </Typography>
          {note && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.4, fontWeight: 600 }}>
              {note}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(accentColor, 0.12),
            color: accentColor,
            border: `1px solid ${alpha(accentColor, 0.24)}`,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Box>
  );
}

function DurationStatCard({
  consultationStartMs,
  status,
  accentColor,
}: {
  consultationStartMs: number;
  status?: string;
  accentColor: string;
}): React.JSX.Element {
  const [elapsed, setElapsed] = useState(() =>
    status === 'CHECKED_IN' ? formatElapsed(consultationStartMs, Date.now()) : null,
  );

  useEffect(() => {
    if (status !== 'CHECKED_IN' || !consultationStartMs) {
      setElapsed(null);
      return;
    }
    const t = window.setInterval(() => {
      setElapsed(formatElapsed(consultationStartMs, Date.now()));
    }, 1000);
    return () => window.clearInterval(t);
  }, [consultationStartMs, status]);

  return (
    <StatCard
      label="Duration"
      value={elapsed?.display ?? '—'}
      note="Time in consultation"
      icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 20 }} />}
      accentColor={accentColor}
    />
  );
}

/* ─── Action Button ──────────────────────────────────────────────────────────── */

function ActionBtn({
  icon,
  label,
  onClick,
  color = 'primary',
  variant = 'outline',
  loading,
  disabled,
  fullWidth,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
  variant?: 'outline' | 'solid';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const c = theme.palette[color].main;
  const cDark = theme.palette[color].dark;

  if (variant === 'solid') {
    return (
      <Button
        fullWidth={fullWidth}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        startIcon={icon}
        sx={{
          py: 1.3,
          px: 2.2,
          borderRadius: '12px',
          fontWeight: 800,
          fontSize: 13,
          textTransform: 'none',
          background: `linear-gradient(135deg, ${c} 0%, ${cDark} 100%)`,
          color: theme.palette[color].contrastText,
          boxShadow: `0 4px 18px ${alpha(c, 0.35)}`,
          border: 'none',
          '&:hover': {
            background: `linear-gradient(135deg, ${c} 0%, ${c} 100%)`,
            boxShadow: `0 6px 24px ${alpha(c, 0.45)}`,
            transform: 'translateY(-1px)',
          },
          '&:active': { transform: 'translateY(0)' },
          transition: 'all 0.2s ease',
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      fullWidth={fullWidth}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      startIcon={icon}
      sx={{
        py: 1.15,
        px: 2,
        borderRadius: '12px',
        fontWeight: 700,
        fontSize: 12.5,
        textTransform: 'none',
        bgcolor: alpha(c, 0.08),
        color: c,
        border: `1px solid ${alpha(c, 0.25)}`,
        '&:hover': {
          bgcolor: alpha(c, 0.16),
          borderColor: alpha(c, 0.45),
          boxShadow: `0 0 16px ${alpha(c, 0.25)}`,
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </Button>
  );
}

/* ─── Panel Container ───────────────────────────────────────────────────────── */

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        borderRadius: '20px',
        bgcolor: isDark ? alpha(theme.palette.background.paper, 0.7) : '#ffffff',
        border: `1px solid ${isDark ? theme.palette.divider : alpha(theme.palette.divider, 0.6)}`,
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        boxShadow: isDark
          ? `0 8px 24px ${alpha('#000', 0.25)}`
          : `0 4px 20px ${alpha('#000', 0.04)}`,
      }}
    >
      {(title || action) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, pt: 2.2, pb: 1.2 }}
        >
          <Box>
            {title && (
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: 'text.secondary',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.2 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <Box sx={{ p: 2.5, pt: title ? 1 : 2.5 }}>{children}</Box>
    </Box>
  );
}

/* ─── Edit Medical Info Dialog ───────────────────────────────────────────────── */

function EditMedicalInfoDialog({
  open,
  patient,
  onClose,
  onSaved,
}: {
  open: boolean;
  patient?: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}): React.JSX.Element {
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup || '');
  const [allergies, setAllergies] = useState(patient?.allergies || '');
  const [chronicConditions, setChronicConditions] = useState(patient?.chronicConditions || '');
  const [weight, setWeight] = useState(patient?.weight ? String(patient.weight) : '');
  const [emergencyName, setEmergencyName] = useState(patient?.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(patient?.emergencyContactPhone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBloodGroup(patient?.bloodGroup || '');
    setAllergies(patient?.allergies || '');
    setChronicConditions(patient?.chronicConditions || '');
    setWeight(patient?.weight ? String(patient.weight) : '');
    setEmergencyName(patient?.emergencyContactName || '');
    setEmergencyPhone(patient?.emergencyContactPhone || '');
  }, [open, patient]);

  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      const payload: PatientInput = {
        firstName: patient.firstName,
        lastName: patient.lastName,
        bloodGroup: bloodGroup.trim() || null,
        allergies: allergies.trim() || null,
        chronicConditions: chronicConditions.trim() || null,
        weight: weight ? Number(weight) : null,
        emergencyContactName: emergencyName.trim() || null,
        emergencyContactPhone: emergencyPhone.trim() || null,
      };
      const updated = await patientsService.update(patient.id, payload);
      showAppToast({ type: 'success', message: 'Patient medical alerts & details updated ✓' });
      onSaved(updated as Patient);
      onClose();
    } catch {
      showAppToast({ type: 'error', message: 'Could not update medical details' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="Update Patient Medical Info & Alerts"
        subtitle="Manage drug allergies, chronic conditions, and emergency contact"
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2.2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Blood Group</InputLabel>
              <Select
                value={bloodGroup}
                label="Blood Group"
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                <MenuItem value=""><em>None / Unknown</em></MenuItem>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Weight (kg)"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 68"
            />
          </Stack>

          <TextField
            fullWidth
            size="small"
            label="Known Drug / Food Allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, NSAIDs, Sulfa, Peanuts"
            helperText="Highlight critical drug or environmental allergies (displays in amber/red)"
          />

          <TextField
            fullWidth
            size="small"
            label="Chronic Conditions & Medical History"
            value={chronicConditions}
            onChange={(e) => setChronicConditions(e.target.value)}
            placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma, CKD"
            helperText="Ongoing systemic illnesses relevant to treatment decisions"
          />

          <Divider sx={{ borderColor: 'divider' }} />

          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Emergency Contact Information
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Contact Person Name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="e.g. Father, Spouse, Brother"
            />
            <TextField
              fullWidth
              size="small"
              label="Contact Phone"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 03001234567"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          loading={saving}
          sx={dialogSubmitBtnSx}
        >
          Save Medical Details
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Edit Consultation Notes Dialog ────────────────────────────────────────── */

function EditConsultationNotesDialog({
  open,
  appointment,
  onClose,
  onSaved,
}: {
  open: boolean;
  appointment?: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const [reason, setReason] = useState(appointment?.reason || '');
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(appointment?.reason || '');
    setNotes(appointment?.notes || '');
  }, [open, appointment]);

  const handleSave = async () => {
    if (!appointment?.id) return;
    setSaving(true);
    try {
      const payload: AppointmentInput = {
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      };
      await appointmentsService.update(appointment.id, payload);
      showAppToast({ type: 'success', message: 'Consultation notes & complaint updated ✓' });
      onSaved();
      onClose();
    } catch {
      showAppToast({ type: 'error', message: 'Could not save notes' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="Consultation Reason & Clinical Notes"
        subtitle="Update chief complaint and clinical examination observations"
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2.2} sx={{ pt: 1 }}>
          <TextField
            fullWidth
            size="small"
            label="Chief Complaint / Reason for Visit"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Acute productive cough & high fever for 3 days"
          />

          <TextField
            fullWidth
            multiline
            rows={4}
            size="small"
            label="Doctor's Clinical Notes & Examination Findings"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Chest: bilateral wheezing, Throat: mild hyperemia, Abdomen: soft non-tender, Plan: start nebulization and symptomatic relief."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          loading={saving}
          sx={dialogSubmitBtnSx}
        >
          Save Clinical Notes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Quick Follow-Up Booking Dialog ────────────────────────────────────────── */

function FollowUpDialog({
  open,
  appointment,
  onClose,
  onSaved,
}: {
  open: boolean;
  appointment?: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const getDefaultDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toLocaleDateString('en-CA');
  };

  const [date, setDate] = useState(() => getDefaultDate(7));
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('Follow-up review of treatment response & symptoms');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(getDefaultDate(7));
    if (appointment?.startsAt) {
      const t = new Date(appointment.startsAt).toTimeString().slice(0, 5);
      if (t) setTime(t);
    }
  }, [open, appointment]);

  const handleBook = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const endsAt = new Date(new Date(startsAt).getTime() + 15 * 60_000).toISOString();
      await appointmentsService.create({
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        startsAt,
        endsAt,
        reason: 'Follow-up Consultation',
        notes: notes.trim() || null,
      });
      showAppToast({ type: 'success', message: `Follow-up appointment booked for ${date} ✓` });
      onSaved();
      onClose();
    } catch {
      showAppToast({ type: 'error', message: 'Could not schedule follow-up appointment' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="Schedule Follow-up Visit"
        subtitle={`Schedule return consultation for ${personName(appointment?.patient.firstName, appointment?.patient.lastName)}`}
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
              Quick Preset Dates
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {[
                { label: '+3 Days', days: 3 },
                { label: '+1 Week (7d)', days: 7 },
                { label: '+2 Weeks (14d)', days: 14 },
                { label: '+1 Month', days: 30 },
              ].map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  size="small"
                  onClick={() => setDate(getDefaultDate(p.days))}
                  clickable
                  sx={{
                    fontWeight: 700,
                    bgcolor: date === getDefaultDate(p.days) ? 'primary.main' : 'action.hover',
                    color: date === getDefaultDate(p.days) ? 'primary.contrastText' : 'inherit',
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Follow-up Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="time"
              label="Time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 140 }}
            />
          </Stack>

          <TextField
            fullWidth
            size="small"
            label="Follow-up Clinical Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Check lab reports and BP control"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleBook}
          variant="contained"
          color="primary"
          loading={saving}
          sx={dialogSubmitBtnSx}
        >
          Confirm Follow-Up
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Prescriptions Tab ──────────────────────────────────────────────────────── */

function PrescriptionsTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient?: Patient;
}): React.JSX.Element {
  const theme = useTheme();
  type PrintItem = { prescription: Prescription; doctor: { firstName: string; lastName: string } };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: () => window.clinic.tokens.prescriptionsByPatient(patientId),
    enabled: Boolean(patientId),
  });

  if (isLoading) return <Box sx={{ p: 2 }}><ListCardsSkeleton count={4} /></Box>;

  if (items.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <MedicalServicesOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No prescriptions yet</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>
          Prescriptions written for this patient will be archived here with one-click print preview
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={1.25} sx={{ p: 2 }}>
        {items.map((item, idx) => (
          <Box
            key={idx}
            onClick={() => setPrintItem({ prescription: item.prescription, doctor: item.doctor })}
            sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${theme.palette.divider}`,
              borderLeft: `4px solid ${theme.palette.info.main}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.info.main, 0.08),
                borderColor: alpha(theme.palette.info.main, 0.5),
                transform: 'translateX(3px)',
              },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: 'info.main' }}>
                    {item.prescription.diagnosis || 'Prescription'}
                  </Typography>
                  {item.date && (
                    <Chip
                      label={new Date(item.date).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      size="small"
                      sx={{ ...chipSx, height: 18, fontSize: 10 }}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: 'block' }}>
                  Dr. {personName(item.doctor.firstName, item.doctor.lastName)}
                  {item.prescription.medicines?.length ? ` · ${item.prescription.medicines.length} medicine(s)` : ''}
                  {item.tokenNumber ? ` · Token #${String(item.tokenNumber).padStart(3, '0')}` : ''}
                </Typography>
                {item.prescription.medicines?.slice(0, 3).map((m, mi) => (
                  <Typography key={mi} sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                    • {m.name} — {m.dosage}
                  </Typography>
                ))}
              </Box>
              <PrintOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled', ml: 1 }} />
            </Stack>
          </Box>
        ))}
      </Stack>
      {printItem && patient && (
        <PrescriptionPrintPreview
          prescription={printItem.prescription}
          patient={patient}
          doctor={printItem.doctor}
          onClose={() => setPrintItem(null)}
        />
      )}
    </>
  );
}

/* ─── Billing Tab ───────────────────────────────────────────────────────────── */

function BillingTab({ patientId }: { patientId: string }): React.JSX.Element {
  const theme = useTheme();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-patient', patientId],
    queryFn: () => invoicesService.list(),
  });

  const patientInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => inv.patient?.id === patientId || inv.patientId === patientId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invoices, patientId],
  );

  if (isLoading) return <Box sx={{ p: 2 }}><ListCardsSkeleton count={4} /></Box>;

  if (patientInvoices.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <ReceiptOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No billing records</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>Invoices and payments will appear here</Typography>
      </Box>
    );
  }

  const totalBilled = patientInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const totalPaid = patientInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);

  const statusBorderColor = (status: string): string => {
    if (status === 'PAID') return theme.palette.success.main;
    if (status === 'PARTIALLY_PAID') return theme.palette.warning.main;
    if (status === 'VOID' || status === 'REFUNDED') return theme.palette.error.main;
    return theme.palette.info.main;
  };

  return (
    <Stack spacing={0}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
        {[
          { label: 'Total Billed', value: money(totalBilled), color: theme.palette.warning.main },
          { label: 'Total Paid', value: money(totalPaid), color: theme.palette.success.main },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{
              p: 1.8,
              borderRadius: '12px',
              bgcolor: alpha(s.color, 0.08),
              border: `1px solid ${alpha(s.color, 0.22)}`,
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: 16, color: s.color }}>{s.value}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 700, mt: 0.3 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
      <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
        {patientInvoices.map((inv) => {
          const bc = statusBorderColor(inv.status);
          return (
            <Box
              key={inv.id}
              sx={{
                p: 1.5,
                borderRadius: '12px',
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: `3px solid ${bc}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  bgcolor: alpha(bc, 0.12),
                  color: bc,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {inv.invoiceNumber.slice(-4)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'primary.main' }}>{inv.invoiceNumber}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(inv.createdAt).toLocaleDateString()} · Paid {money(Number(inv.amountPaid ?? 0))}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: 'text.primary' }}>{money(Number(inv.total))}</Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: bc, mt: 0.25 }}>
                  {inv.status.replace('_', ' ')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

/* ─── Lab Tab ───────────────────────────────────────────────────────────────── */

function LabTab({ patientId }: { patientId: string }): React.JSX.Element {
  const { data: labOrders = [], isLoading } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders-patient', patientId],
    queryFn: () => (patientId ? window.clinic.lab.listByPatient(patientId) : Promise.resolve([])),
    enabled: Boolean(patientId),
  });

  const sorted = useMemo(
    () => [...labOrders].sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()),
    [labOrders],
  );

  if (isLoading) return <Box sx={{ p: 2 }}><ListCardsSkeleton count={3} /></Box>;

  if (sorted.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <BiotechOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No lab orders recorded</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>
          Diagnostic investigations and test reports for this patient will appear here
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.25} sx={{ p: 2 }}>
      {sorted.map((o) => <LabOrderHistoryCard key={o.id} order={o} />)}
    </Stack>
  );
}

/* ─── Main ConsultationPage ────────────────────────────────────────────────── */

export function ConsultationPage(): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = useLicense();
  const canOrderLab = can('labDashboard');
  const qc = useQueryClient();
  const tokenPrint = usePrintAppointmentToken();

  const [tab, setTab] = useState(0);
  const [rxToken, setRxToken] = useState<Token | null>(null);
  const [labOpen, setLabOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [medicalInfoOpen, setMedicalInfoOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const [patient, setPatient] = useState<Patient | undefined>();
  const [currentToken, setCurrentToken] = useState<Token | null>(null);
  const [redirectAfterRx, setRedirectAfterRx] = useState(false);

  /* Appointment query */
  const query = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsService.get(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
  const appointment = query.data ?? null;

  /* All appointments for visit history */
  const allAppts = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });

  /* Fetch patient */
  useEffect(() => {
    if (!appointment?.patientId) return;
    void window.clinic.patients
      .list({ page: 1, pageSize: 50, search: appointment.patient.firstName || appointment.patientId })
      .then((res: { data: Patient[] }) => {
        const match = res.data.find((p) => p.id === appointment.patientId);
        if (match) setPatient(match);
      })
      .catch(() => undefined);
  }, [appointment?.patientId, appointment?.patient.firstName]);

  /* Current token for Rx and Vitals */
  const fetchCurrentToken = async () => {
    if (!appointment) return;
    const dateStr = new Date(appointment.startsAt).toLocaleDateString('en-CA');
    try {
      const tokens: Token[] = await window.clinic.tokens.list(dateStr);
      const t = tokens.find(
        (tok) => tok.patientId === appointment.patientId && tok.doctorId === appointment.providerId,
      );
      setCurrentToken(t ?? null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchCurrentToken();
  }, [appointment]);

  /* Ensure token exists when user clicks Vitals or Rx */
  const ensureToken = async (): Promise<Token | null> => {
    if (currentToken) return currentToken;
    if (!appointment) return null;
    const apptDate = new Date(appointment.startsAt).toLocaleDateString('en-CA');
    let tok: Token | null = null;
    try {
      tok = await window.clinic.tokens.getForPatient(appointment.patientId, apptDate, appointment.providerId);
    } catch {}

    if (!tok) {
      try {
        tok = await window.clinic.tokens.create({
          patientId: appointment.patientId,
          doctorId: appointment.providerId,
          date: apptDate,
          reason: appointment.reason || 'Consultation',
          notes: appointment.notes || '',
        });
      } catch {
        tok = {
          id: appointment.id,
          tokenNumber: appointment.tokenNumber ?? 1,
          status: 'DONE',
          date: apptDate,
          patientId: appointment.patientId,
          doctorId: appointment.providerId,
          patient: appointment.patient,
          doctor: appointment.provider,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        } as unknown as Token;
      }
    }
    if (tok) setCurrentToken(tok);
    return tok;
  };

  const parsedVitals = useMemo<TokenVitals | null>(() => {
    if (!currentToken?.vitals) return null;
    if (typeof currentToken.vitals === 'object') return currentToken.vitals as TokenVitals;
    try {
      return JSON.parse(currentToken.vitals) as TokenVitals;
    } catch {
      return null;
    }
  }, [currentToken?.vitals]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['appointment', id] });
    await qc.invalidateQueries({ queryKey: ['appointments'] });
    await fetchCurrentToken();
  };

  const completeMutation = useMutation({
    mutationFn: () => appointmentsService.updateStatus(id!, 'COMPLETED'),
    onSuccess: async () => {
      if (id) clearConsultationStartMs(id);
      await invalidate();
    },
    meta: { toast: 'Consultation completed ✓', errorToast: 'Could not complete.' },
  });

  const checkInMutation = useMutation({
    mutationFn: () => appointmentsService.updateStatus(id!, 'CHECKED_IN'),
    onSuccess: async (updated) => {
      if (updated) {
        qc.setQueryData(['appointment', id], updated);
      }
      await invalidate();
    },
    meta: { toast: 'Patient checked in ✓', errorToast: 'Could not check in.' },
  });

  const handleOpenVitals = async () => {
    const tok = await ensureToken();
    if (tok) {
      setVitalsOpen(true);
    } else {
      showAppToast({ type: 'error', message: 'Could not initialize token for vitals' });
    }
  };

  const handleCompleteVisit = async () => {
    if (!appointment) return;
    try {
      const tok = await ensureToken();
      setRedirectAfterRx(true);
      if (tok) {
        setRxToken(tok);
      }
      await completeMutation.mutateAsync();
    } catch {
      // handled by mutation
    }
  };

  /* Derived Labels */
  const patientLabel = personName(appointment?.patient.firstName, appointment?.patient.lastName);
  const doctorLabel = appointment
    ? `Dr. ${personName(appointment.provider.firstName, appointment.provider.lastName)}`
    : '';
  const ageStr = patient?.dateOfBirth
    ? calcAge(patient.dateOfBirth)
    : patient?.age
      ? `${patient.age} yrs`
      : '';

  const consultationStartMs = useMemo(() => {
    return getConsultationStartMs(appointment, currentToken);
  }, [appointment, currentToken]);

  const slotDurationMs = useMemo(() => {
    if (!appointment?.startsAt || !appointment?.endsAt) return 15 * 60_000;
    const s = new Date(appointment.startsAt).getTime();
    const e = new Date(appointment.endsAt).getTime();
    const diff = e - s;
    return diff > 0 ? diff : 15 * 60_000;
  }, [appointment?.startsAt, appointment?.endsAt]);

  const patientVisits = useMemo(
    () =>
      ((allAppts.data as Appointment[]) ?? [])
        .filter((a) => a.patientId === appointment?.patientId)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [allAppts.data, appointment?.patientId],
  );

  /* Loading State */
  if (query.isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rounded" height={130} sx={{ borderRadius: 4, mb: 2.5 }} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(4,1fr)', mb: 2.5 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={90} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <StatCardsSkeleton count={3} />
      </Box>
    );
  }

  if (user?.role !== 'doctor') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Access restricted. Only doctors have access to the clinical consultation room.
        </Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      </Box>
    );
  }

  if (!appointment) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>Appointment not found.</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(-1)}>Go Back</Button>
      </Box>
    );
  }

  if (appointment.status !== 'CHECKED_IN' && appointment.status !== 'COMPLETED') {
    return (
      <Box sx={{ p: 4, maxWidth: 640 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Appointment status is <strong>{appointment.status.replace('_', ' ')}</strong>. Consultation view is available when the patient is checked in.
        </Alert>
        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<MedicalServicesOutlinedIcon />}
            loading={checkInMutation.isPending}
            onClick={() => checkInMutation.mutate()}
            sx={{ fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
          >
            Check In & Start Consultation
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Return to Dashboard
          </Button>
        </Stack>
      </Box>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 5,
      }}
    >
      {/* ══ STICKY TOP BAR ══════════════════════════════════════════════ */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(24px)',
          bgcolor: alpha(theme.palette.background.default, 0.88),
          borderBottom: `1px solid ${theme.palette.divider}`,
          px: { xs: 2, md: 3 },
          py: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          {/* Left: Navigation & Active Patient Context */}
          <Stack direction="row" alignItems="center" spacing={2}>
            <Tooltip title="Go back">
              <IconButton
                onClick={() => navigate(-1)}
                size="small"
                sx={{
                  color: 'text.secondary',
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '10px',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.1) },
                }}
              >
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Box>
              {/* LIVE badge */}
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.7,
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
                  mb: 0.3,
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    animation: 'consultPulse 1.4s ease-in-out infinite',
                    '@keyframes consultPulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.35, transform: 'scale(1.4)' },
                    },
                  }}
                />
                <Typography sx={{ fontSize: 10, fontWeight: 900, color: 'success.main', letterSpacing: '0.1em' }}>
                  LIVE · IN PROGRESS
                </Typography>
              </Box>

              <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary', lineHeight: 1.2 }}>
                {patientLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                {doctorLabel} ·{' '}
                {new Date(appointment.startsAt).toLocaleDateString([], {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Typography>
            </Box>
          </Stack>

          {/* Right: Quick Action Shortcuts & Clock */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {appointment.patient.phone && (
              <Tooltip title="Send WhatsApp Message">
                <IconButton
                  onClick={() => setWhatsAppOpen(true)}
                  size="small"
                  sx={{
                    color: '#22c55e',
                    bgcolor: alpha('#22c55e', 0.1),
                    border: `1px solid ${alpha('#22c55e', 0.25)}`,
                    borderRadius: '10px',
                    '&:hover': { bgcolor: alpha('#22c55e', 0.2) },
                  }}
                >
                  <WhatsAppIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {appointment.tokenNumber && (
              <Tooltip title="Print Consultation Token Slip">
                <IconButton
                  onClick={() => tokenPrint.printFor(appointment)}
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    bgcolor: alpha(theme.palette.text.primary, 0.05),
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: '10px',
                    '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.1) },
                  }}
                >
                  <PrintOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ flexShrink: 0, pl: 0.5 }}>
              <LiveClock />
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* ══ PAGE BODY ════════════════════════════════════════════════════ */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 3 }}>

        {/* ── HERO PATIENT COCKPIT CARD (Redesigned with Luxury Dark / Light Theme) ── */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            p: { xs: 3, md: 3.5 },
            borderRadius: '24px',
            background: isDark
              ? `linear-gradient(135deg, ${alpha('#064e3b', 0.55)} 0%, ${alpha('#0f172a', 0.9)} 50%, ${alpha('#065f46', 0.38)} 100%)`
              : `linear-gradient(135deg, #ffffff 0%, #f0fdf4 55%, #ecfdf5 100%)`,
            border: '1px solid',
            borderColor: isDark ? alpha('#10b981', 0.35) : alpha('#10b981', 0.3),
            boxShadow: isDark
              ? `0 20px 48px ${alpha('#000000', 0.5)}, 0 0 35px ${alpha('#10b981', 0.1)}`
              : `0 12px 36px ${alpha('#10b981', 0.1)}, 0 2px 10px ${alpha('#000000', 0.04)}`,
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient Background Glow Orbs */}
          <Box
            sx={{
              position: 'absolute',
              right: -30,
              top: -50,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha('#10b981', isDark ? 0.22 : 0.09)} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: 50,
              bottom: -70,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha('#38bdf8', isDark ? 0.14 : 0.06)} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={3}
            alignItems={{ lg: 'center' }}
            justifyContent="space-between"
            sx={{ position: 'relative', zIndex: 1, width: '100%' }}
          >
            {/* Left: Patient Core Identity + Badges */}
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Avatar
                  sx={{
                    width: { xs: 68, md: 78 },
                    height: { xs: 68, md: 78 },
                    fontSize: 28,
                    fontWeight: 900,
                    background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
                    color: '#ffffff',
                    border: `2px solid ${alpha('#10b981', 0.5)}`,
                    boxShadow: `0 8px 24px ${alpha('#10b981', 0.3)}`,
                    flexShrink: 0,
                  }}
                >
                  {initials(appointment.patient.firstName, appointment.patient.lastName)}
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Typography
                      sx={{
                        fontSize: { xs: 24, md: 32 },
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.15,
                        color: isDark ? '#ffffff' : '#0f172a',
                        textShadow: isDark ? `0 2px 10px ${alpha('#000000', 0.4)}` : 'none',
                      }}
                    >
                      {patientLabel}
                    </Typography>

                    {appointment.tokenNumber && (
                      <Box
                        sx={{
                          px: 1.2,
                          py: 0.35,
                          borderRadius: '8px',
                          bgcolor: isDark ? alpha('#f59e0b', 0.16) : alpha('#f59e0b', 0.12),
                          border: `1px solid ${alpha('#f59e0b', isDark ? 0.35 : 0.3)}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <ConfirmationNumberOutlinedIcon sx={{ fontSize: 13, color: '#f59e0b' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>
                          Token #{String(appointment.tokenNumber).padStart(3, '0')}
                        </Typography>
                      </Box>
                    )}

                    {currentToken?.priority && currentToken.priority !== 'NORMAL' && (
                      <PriorityBadge priority={currentToken.priority} />
                    )}

                    <Box
                      sx={{
                        px: 1.2,
                        py: 0.35,
                        borderRadius: '8px',
                        bgcolor: isDark ? alpha('#0284c7', 0.16) : alpha('#0284c7', 0.12),
                        border: `1px solid ${alpha('#0284c7', isDark ? 0.35 : 0.3)}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <MedicalServicesOutlinedIcon sx={{ fontSize: 13, color: '#0284c7' }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#0284c7' }}>
                        {patientVisits.length > 1 ? `${patientVisits.length}th Visit` : '1st Visit'} · OPD
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Metadata Chips Row */}
                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {patient?.mrNumber && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: isDark ? alpha('#fff', 0.08) : alpha('#0f172a', 0.06), border: `1px solid ${isDark ? alpha('#fff', 0.12) : alpha('#0f172a', 0.1)}`, display: 'inline-flex', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                          MR# {patient.mrNumber}
                        </Typography>
                      </Box>
                    )}
                    {doctorLabel && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <LocalHospitalOutlinedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: isDark ? '#a7f3d0' : '#047857' }}>
                          {doctorLabel}
                        </Typography>
                      </Box>
                    )}
                    {(ageStr || patient?.gender) && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: isDark ? alpha('#fff', 0.08) : alpha('#0f172a', 0.06), border: `1px solid ${isDark ? alpha('#fff', 0.12) : alpha('#0f172a', 0.1)}`, display: 'inline-flex', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                          {[ageStr, patient?.gender].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    )}
                    {patient?.dateOfBirth && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: isDark ? alpha('#fff', 0.08) : alpha('#0f172a', 0.06), border: `1px solid ${isDark ? alpha('#fff', 0.12) : alpha('#0f172a', 0.1)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <CakeOutlinedIcon sx={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                          DOB: {new Date(patient.dateOfBirth).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    )}
                    {(appointment.patient.phone || patient?.phone) && (
                      <Box
                        onClick={() => setWhatsAppOpen(true)}
                        sx={{
                          px: 1,
                          py: 0.3,
                          borderRadius: '6px',
                          bgcolor: alpha('#22c55e', 0.12),
                          border: `1px solid ${alpha('#22c55e', 0.3)}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.4,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha('#22c55e', 0.22) },
                        }}
                      >
                        <WhatsAppIcon sx={{ fontSize: 12, color: '#22c55e' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: isDark ? '#86efac' : '#15803d' }}>
                          {appointment.patient.phone || patient?.phone}
                        </Typography>
                      </Box>
                    )}
                    {patient?.address && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: isDark ? alpha('#fff', 0.08) : alpha('#0f172a', 0.06), border: `1px solid ${isDark ? alpha('#fff', 0.12) : alpha('#0f172a', 0.1)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <HomeOutlinedIcon sx={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>
                          {patient.address}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Stack>

              {/* Bottom Clinical Insights Glass Strip (3 Refined Cards) */}
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 1fr' },
                }}
              >
                {/* 1. Chief Complaint & Notes */}
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: '16px',
                    bgcolor: isDark ? alpha('#0f172a', 0.65) : alpha('#ffffff', 0.8),
                    border: `1px solid ${isDark ? alpha('#fff', 0.1) : alpha(theme.palette.primary.main, 0.2)}`,
                    backdropFilter: 'blur(12px)',
                    position: 'relative',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                      Chief Complaint / Reason
                    </Typography>
                    <IconButton size="small" onClick={() => setNotesOpen(true)} sx={{ p: 0.4, color: 'primary.main' }}>
                      <EditOutlinedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Stack>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                    {appointment.reason || 'General OPD Consultation & Evaluation'}
                  </Typography>
                  {appointment.notes && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.4, fontStyle: 'italic' }}>
                      Note: {appointment.notes}
                    </Typography>
                  )}
                </Box>

                {/* 2. Vitals & Physical Status */}
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: '16px',
                    bgcolor: isDark ? alpha('#0f172a', 0.65) : alpha('#ffffff', 0.8),
                    border: `1px solid ${isDark ? alpha('#fff', 0.1) : alpha(theme.palette.primary.main, 0.2)}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                      Vitals & Physical Details
                    </Typography>
                    <Button
                      size="small"
                      onClick={handleOpenVitals}
                      startIcon={<AddCircleOutlineIcon sx={{ fontSize: 13 }} />}
                      sx={{ p: 0.2, minWidth: 'auto', fontSize: 10.5, fontWeight: 800, textTransform: 'none', color: 'primary.main' }}
                    >
                      {parsedVitals ? 'Edit Vitals' : 'Record'}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                    {parsedVitals?.bp && (
                      <Chip
                        size="small"
                        icon={<ThermostatOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                        label={`BP: ${parsedVitals.bp}`}
                        sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}
                      />
                    )}
                    {parsedVitals?.pulse && (
                      <Chip
                        size="small"
                        label={`P: ${parsedVitals.pulse} bpm`}
                        sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.main' }}
                      />
                    )}
                    {parsedVitals?.temp && (
                      <Chip
                        size="small"
                        label={`T: ${parsedVitals.temp}°F`}
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: Number(parsedVitals.temp) >= 99.5 ? alpha(theme.palette.error.main, 0.15) : 'action.hover',
                          color: Number(parsedVitals.temp) >= 99.5 ? 'error.main' : 'inherit',
                        }}
                      />
                    )}
                    {parsedVitals?.spo2 && (
                      <Chip
                        size="small"
                        icon={<OpacityOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                        label={`SpO2: ${parsedVitals.spo2}%`}
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: Number(parsedVitals.spo2) < 95 ? alpha(theme.palette.error.main, 0.15) : 'action.hover',
                          color: Number(parsedVitals.spo2) < 95 ? 'error.main' : 'inherit',
                        }}
                      />
                    )}
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                      Wt: {parsedVitals?.weight || patient?.weight ? `${parsedVitals?.weight || patient?.weight} kg` : '—'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>·</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                      Blood: {patient?.bloodGroup || '—'}
                    </Typography>
                  </Stack>
                </Box>

                {/* 3. Alerts & Emergency Risk */}
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: '16px',
                    bgcolor: isDark ? alpha('#0f172a', 0.65) : alpha('#ffffff', 0.8),
                    border: `1px solid ${isDark ? alpha('#fff', 0.1) : alpha(theme.palette.primary.main, 0.2)}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                      Alerts & Emergency
                    </Typography>
                    <IconButton size="small" onClick={() => setMedicalInfoOpen(true)} sx={{ p: 0.4, color: 'warning.main' }}>
                      <EditOutlinedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Stack>

                  {patient?.allergies ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.error.main, 0.15), border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`, color: 'error.main', mb: 0.4 }}>
                      <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 800 }}>
                        Allergies: {patient.allergies}
                      </Typography>
                    </Box>
                  ) : null}

                  {patient?.chronicConditions ? (
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'warning.main', display: 'block' }}>
                      Chronic: {patient.chronicConditions}
                    </Typography>
                  ) : null}

                  {!patient?.allergies && !patient?.chronicConditions && (
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                      {patient?.emergencyContactName
                        ? `Emergency: ${patient.emergencyContactName} (${patient.emergencyContactPhone || '—'})`
                        : 'No known drug allergies · Low medical risk'}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Stack>

            {/* Right: Consultation Timer Capsule */}
            <Box
              sx={{
                flexShrink: 0,
                px: { xs: 2.5, md: 3 },
                py: 2.2,
                borderRadius: '20px',
                background: isDark
                  ? `linear-gradient(135deg, ${alpha('#0f172a', 0.85)} 0%, ${alpha('#064e3b', 0.35)} 100%)`
                  : `linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${isDark ? alpha('#10b981', 0.3) : alpha('#10b981', 0.25)}`,
                boxShadow: isDark
                  ? `0 12px 28px ${alpha('#000', 0.4)}, inset 0 1px 1px ${alpha('#fff', 0.1)}`
                  : `0 8px 24px ${alpha('#10b981', 0.12)}, inset 0 1px 2px #fff`,
                textAlign: 'center',
                minWidth: { xs: 220, md: 280 },
              }}
            >
              <ConsultationClock
                startedAtMs={consultationStartMs}
                slotDurationMs={slotDurationMs}
              />
            </Box>
          </Stack>
        </Paper>

        {/* ── 4 STAT CARDS ───────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' },
            mb: 2.5,
          }}
        >
          <StatCard
            label="Token"
            value={appointment.tokenNumber ? `#${String(appointment.tokenNumber).padStart(3, '0')}` : '—'}
            note="Queue position"
            icon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 20 }} />}
            accentColor={theme.palette.warning.main}
          />
          <StatCard
            label="Scheduled"
            value={formatClock(appointment.startsAt)}
            note={`Until ${formatClock(appointment.endsAt)}`}
            icon={<AccessTimeOutlinedIcon sx={{ fontSize: 20 }} />}
            accentColor={theme.palette.info.main}
          />
          <DurationStatCard
            consultationStartMs={consultationStartMs}
            status={appointment.status}
            accentColor={theme.palette.success.main}
          />
          <StatCard
            label="Total Visits"
            value={String(patientVisits.length)}
            note="Patient relationship history"
            icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 20 }} />}
            accentColor={theme.palette.secondary.main}
          />
        </Box>

        {/* ── TWO-COLUMN MAIN WORKSPACE ───────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) 360px' },
            alignItems: 'start',
          }}
        >
          {/* ── LEFT: Clinical Context & History Tabs ──────────────────── */}
          <Stack spacing={2.5}>
            <Box
              sx={{
                borderRadius: '20px',
                bgcolor: isDark ? alpha(theme.palette.background.paper, 0.7) : '#ffffff',
                border: `1px solid ${isDark ? theme.palette.divider : alpha(theme.palette.divider, 0.6)}`,
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                boxShadow: isDark
                  ? `0 8px 24px ${alpha('#000', 0.25)}`
                  : `0 4px 20px ${alpha('#000', 0.04)}`,
              }}
            >
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : alpha('#f8fafc', 0.7),
                  px: 1,
                  minHeight: 48,
                  '& .MuiTab-root': {
                    minHeight: 48,
                    fontSize: 12.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    gap: 0.6,
                  },
                  '& .MuiTabs-indicator': {
                    height: 2.5,
                    borderRadius: 99,
                  },
                }}
              >
                <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Visits (${patientVisits.length})`} />
                <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Prescriptions" />
                {canOrderLab && <Tab icon={<BiotechOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Lab Orders" />}
                <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Billing" />
                <Tab icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Medical Info & Alerts" />
                <Tab icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Documents" />
              </Tabs>

              <Box sx={{ minHeight: 240 }}>
                {/* 1. Visits */}
                {tab === 0 && (
                  patientVisits.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <CalendarMonthOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1.5 }} />
                      <Typography color="text.secondary" fontWeight={700}>No visit history found</Typography>
                    </Box>
                  ) : (
                    <AppointmentVisitList
                      appointments={patientVisits}
                      currentId={appointment.id}
                      onOpen={(a) => { if (a.id !== appointment.id) navigate(`/appointments/${a.id}`); }}
                      onPrint={tokenPrint.printFor}
                      printingId={tokenPrint.printingId}
                      showNotes
                    />
                  )
                )}

                {/* 2. Prescriptions */}
                {tab === 1 && <PrescriptionsTab patientId={appointment.patientId} patient={patient} />}

                {/* 3. Lab */}
                {canOrderLab && tab === 2 && <LabTab patientId={appointment.patientId} />}

                {/* 4. Billing */}
                {tab === (canOrderLab ? 3 : 2) && <BillingTab patientId={appointment.patientId} />}

                {/* 5. Medical Info & Alerts */}
                {tab === (canOrderLab ? 4 : 3) && (
                  <Box sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                        Comprehensive Patient Medical Baseline
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => setMedicalInfoOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, borderRadius: '8px' }}
                      >
                        Edit Medical Details
                      </Button>
                    </Stack>

                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, mb: 2 }}>
                      {[
                        { label: 'Blood Group', value: patient?.bloodGroup, color: theme.palette.error.main, icon: <BloodtypeOutlinedIcon sx={{ fontSize: 18 }} /> },
                        { label: 'Known Allergies', value: patient?.allergies, color: theme.palette.warning.main, icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} /> },
                        { label: 'Chronic Conditions', value: patient?.chronicConditions, color: theme.palette.secondary.main, icon: <MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} /> },
                      ].map(({ label, value, color, icon }) => (
                        <Box
                          key={label}
                          sx={{
                            p: 2,
                            borderRadius: '14px',
                            bgcolor: alpha(color, 0.06),
                            border: `1px solid ${alpha(color, 0.22)}`,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Box sx={{ color }}>{icon}</Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {label}
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontWeight: value ? 800 : 500, color: value ? 'text.primary' : 'text.disabled', fontSize: 13.5 }}>
                            {value || 'Not reported'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Vitals Summary Card */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '14px',
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Current Visit Vitals Snapshot
                        </Typography>
                        <Button
                          size="small"
                          onClick={handleOpenVitals}
                          startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
                          sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11.5 }}
                        >
                          Record / Modify Vitals
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Blood Pressure</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.bp || '—'}</Typography>
                        </Box>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Pulse Rate</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.pulse ? `${parsedVitals.pulse} bpm` : '—'}</Typography>
                        </Box>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Temperature</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.temp ? `${parsedVitals.temp} °F` : '—'}</Typography>
                        </Box>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Oxygen (SpO2)</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.spo2 ? `${parsedVitals.spo2} %` : '—'}</Typography>
                        </Box>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Blood Sugar (RBS)</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.rbs ? `${parsedVitals.rbs} mg/dL` : '—'}</Typography>
                        </Box>
                        <Box sx={{ p: 1, minWidth: 100, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">Weight</Typography>
                          <Typography fontWeight={800}>{parsedVitals?.weight || patient?.weight ? `${parsedVitals?.weight || patient?.weight} kg` : '—'}</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                )}

                {/* 6. Documents */}
                {tab === (canOrderLab ? 5 : 4) && patient && <PatientDocumentsPanel patient={patient} />}
              </Box>
            </Box>
          </Stack>

          {/* ── RIGHT: Clinical Quick Actions & Tools Panel ────────────── */}
          <Stack spacing={2} sx={{ position: { xl: 'sticky' }, top: { xl: 88 } }}>
            <Panel
              title="Doctor Clinical Workspace"
              subtitle="Essential diagnostic & consultation actions"
            >
              <Stack spacing={1.5}>
                {/* 1. Primary Action: Write Prescription */}
                <ActionBtn
                  icon={<EditNoteOutlinedIcon sx={{ fontSize: 20 }} />}
                  label="Write Prescription (Rx)"
                  onClick={async () => {
                    const tok = await ensureToken();
                    if (tok) setRxToken(tok);
                  }}
                  color="primary"
                  variant="solid"
                  fullWidth
                />

                {/* 2. Order Lab Test */}
                {canOrderLab && (
                  <ActionBtn
                    icon={<BiotechOutlinedIcon sx={{ fontSize: 18 }} />}
                    label="Order Diagnostic Lab Test"
                    onClick={() => setLabOpen(true)}
                    color="warning"
                    fullWidth
                  />
                )}

                {/* 3. Record / Update Vitals */}
                <ActionBtn
                  icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} />}
                  label={parsedVitals ? 'Update Patient Vitals' : 'Record Patient Vitals'}
                  onClick={handleOpenVitals}
                  color="info"
                  fullWidth
                />

                <Divider sx={{ borderColor: 'divider', my: 0.5 }} />

                <Typography sx={{ fontSize: 10, fontWeight: 900, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Care Continuity & Comms
                </Typography>

                {/* 4. Consultation Notes */}
                <ActionBtn
                  icon={<NoteAltOutlinedIcon sx={{ fontSize: 18 }} />}
                  label="Edit Clinical Notes / Complaint"
                  onClick={() => setNotesOpen(true)}
                  color="primary"
                  fullWidth
                />

                {/* 5. Schedule Follow-up */}
                <ActionBtn
                  icon={<EventAvailableOutlinedIcon sx={{ fontSize: 18 }} />}
                  label="Schedule Follow-up Visit"
                  onClick={() => setFollowUpOpen(true)}
                  color="info"
                  fullWidth
                />

                {/* 6. WhatsApp Communication */}
                <ActionBtn
                  icon={<WhatsAppIcon sx={{ fontSize: 18 }} />}
                  label="Send WhatsApp to Patient"
                  onClick={() => setWhatsAppOpen(true)}
                  color="success"
                  fullWidth
                />

                <Divider sx={{ borderColor: 'divider', my: 0.5 }} />

                {/* 7. Complete Visit */}
                <ActionBtn
                  icon={<CheckCircleOutlinedIcon sx={{ fontSize: 20 }} />}
                  label="Complete Visit & Close"
                  onClick={() => void handleCompleteVisit()}
                  color="success"
                  variant="solid"
                  fullWidth
                  loading={completeMutation.isPending}
                />
              </Stack>
            </Panel>
          </Stack>
        </Box>
      </Box>

      {/* ── MODALS & DIALOGS ─────────────────────────────────────────── */}

      {/* 1. Prescription Pad */}
      {rxToken && (
        <PrescriptionPadDialog
          token={rxToken}
          onClose={() => {
            setRxToken(null);
            if (redirectAfterRx) {
              setRedirectAfterRx(false);
              navigate('/dashboard');
            }
          }}
          onSaved={() => {
            setRxToken(null);
            void invalidate();
            if (redirectAfterRx) {
              setRedirectAfterRx(false);
              navigate('/dashboard');
            }
          }}
        />
      )}

      {/* 2. Order Lab Dialog */}
      {labOpen && user && (
        <OrderLabDialog
          open
          patientId={appointment.patientId}
          patientName={patientLabel}
          orderedById={user.id}
          tokenId={currentToken?.id}
          onClose={() => {
            setLabOpen(false);
            void invalidate();
          }}
        />
      )}

      {/* 3. Vitals Dialog */}
      {vitalsOpen && currentToken && (
        <VitalsDialog
          open={vitalsOpen}
          token={currentToken}
          onClose={() => setVitalsOpen(false)}
          onSaved={() => {
            setVitalsOpen(false);
            void invalidate();
          }}
        />
      )}

      {/* 4. WhatsApp Communication Dialog */}
      <AppointmentWhatsAppDialog
        open={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        appointment={appointment}
      />

      {/* 5. Edit Medical Info & Baseline Dialog */}
      <EditMedicalInfoDialog
        open={medicalInfoOpen}
        patient={patient}
        onClose={() => setMedicalInfoOpen(false)}
        onSaved={(updated) => {
          setPatient(updated);
          void invalidate();
        }}
      />

      {/* 6. Edit Consultation Notes Dialog */}
      <EditConsultationNotesDialog
        open={notesOpen}
        appointment={appointment}
        onClose={() => setNotesOpen(false)}
        onSaved={() => void invalidate()}
      />

      {/* 7. Follow-up Booking Dialog */}
      <FollowUpDialog
        open={followUpOpen}
        appointment={appointment}
        onClose={() => setFollowUpOpen(false)}
        onSaved={() => void invalidate()}
      />

      {/* 8. Token Print Preview */}
      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </Box>
  );
}
