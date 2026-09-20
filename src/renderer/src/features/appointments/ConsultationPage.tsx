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
import FavoriteOutlinedIcon from '@mui/icons-material/FavoriteOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LiveClock } from '@/components/LiveClock';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { AppointmentVisitList } from '@/features/appointments/AppointmentVisitList';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import { PrescriptionPadDialog } from '@/features/tokens/PrescriptionPadDialog';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { PatientDocumentsPanel } from '@/features/patients/PatientDocumentsPanel';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import { OrderLabDialog } from '@/features/lab/OrderLabDialog';
import type { Appointment } from '@/types/appointment';
import type { Patient } from '@/types/patient';
import type { Token, Prescription } from '@/types/token';
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


/* ─── Dark Stat Card ────────────────────────────────────────────────────────── */

function StatCard({ label, value, note, icon, accentColor }: {
  label: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
  accentColor: string;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '16px',
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `3px solid ${accentColor}`,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
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
          bgcolor: alpha(accentColor, 0.07),
        }}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
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
            border: `1px solid ${alpha(accentColor, 0.22)}`,
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

/* ─── Info Row ─────────────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  highlight?: 'danger' | 'warning';
}): React.JSX.Element {
  const theme = useTheme();

  const bgColor = highlight === 'danger'
    ? alpha(theme.palette.error.main, 0.07)
    : highlight === 'warning'
      ? alpha(theme.palette.warning.main, 0.07)
      : 'transparent';

  const borderColor = highlight === 'danger'
    ? alpha(theme.palette.error.main, 0.25)
    : highlight === 'warning'
      ? alpha(theme.palette.warning.main, 0.22)
      : 'transparent';

  const iconColor = highlight === 'danger'
    ? theme.palette.error.main
    : highlight === 'warning'
      ? theme.palette.warning.main
      : theme.palette.text.secondary;

  const valueColor = highlight === 'danger'
    ? theme.palette.error.light
    : highlight === 'warning'
      ? theme.palette.warning.light
      : theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: highlight ? 1.5 : 0,
        borderRadius: highlight ? '10px' : 0,
        bgcolor: bgColor,
        border: highlight ? `1px solid ${borderColor}` : 'none',
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ mt: 0.2, color: iconColor, flexShrink: 0, '& svg': { fontSize: 16 } }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
          {label}
        </Typography>
        {typeof value === 'string' ? (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: valueColor, wordBreak: 'break-word' }}>
            {value || '—'}
          </Typography>
        ) : value}
      </Box>
    </Box>
  );
}

/* ─── Dark Glass Panel ───────────────────────────────────────────────────────  */

function Panel({ title, children, noPad }: { title?: string; children: React.ReactNode; noPad?: boolean }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: '20px',
        bgcolor: alpha(theme.palette.background.paper, 0.7),
        border: `1px solid ${theme.palette.divider}`,
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {title && (
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {title}
          </Typography>
        </Box>
      )}
      <Box sx={{ px: noPad ? 0 : 2.5, pb: noPad ? 0 : 2.5 }}>
        {children}
      </Box>
    </Box>
  );
}

/* ─── Action Button ──────────────────────────────────────────────────────────── */

function ActionBtn({
  icon, label, onClick, color = 'primary', variant = 'outline', loading, disabled, fullWidth,
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
          py: 1.4,
          px: 2.5,
          borderRadius: '12px',
          fontWeight: 800,
          fontSize: 13,
          textTransform: 'none',
          background: `linear-gradient(135deg, ${c} 0%, ${cDark} 100%)`,
          color: theme.palette[color].contrastText,
          boxShadow: `0 4px 20px ${alpha(c, 0.35)}`,
          border: 'none',
          '&:hover': {
            background: `linear-gradient(135deg, ${c} 0%, ${c} 100%)`,
            boxShadow: `0 6px 28px ${alpha(c, 0.45)}`,
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
        py: 1.2,
        px: 2,
        borderRadius: '12px',
        fontWeight: 700,
        fontSize: 13,
        textTransform: 'none',
        bgcolor: alpha(c, 0.08),
        color: c,
        border: `1px solid ${alpha(c, 0.22)}`,
        '&:hover': {
          bgcolor: alpha(c, 0.14),
          borderColor: alpha(c, 0.45),
          boxShadow: `0 0 16px ${alpha(c, 0.25)}`,
        },
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </Button>
  );
}

/* ─── Prescriptions Tab ──────────────────────────────────────────────────────── */

function PrescriptionsTab({ patientId, patient }: { patientId: string; patient?: Patient }): React.JSX.Element {
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
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <MedicalServicesOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No prescriptions yet</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>
          Prescriptions for this patient will appear here
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
              borderRadius: '12px',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${theme.palette.divider}`,
              borderLeft: `3px solid ${theme.palette.info.main}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderColor: alpha(theme.palette.info.main, 0.5),
                boxShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.06)}`,
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
                      label={new Date(item.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
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
                {item.prescription.medicines?.slice(0, 2).map((m, mi) => (
                  <Typography key={mi} sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                    • {m.name} — {m.dosage}
                  </Typography>
                ))}
              </Box>
              <PrintOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 1 }} />
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
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <ReceiptOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No billing records</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>Invoices will appear here</Typography>
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
      <Box sx={{ px: 2, pt: 2, pb: 1.5, display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
        {[
          { label: 'Total Billed', value: money(totalBilled), color: theme.palette.warning.main },
          { label: 'Total Paid', value: money(totalPaid), color: theme.palette.success.main },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{ p: 1.5, borderRadius: '10px', bgcolor: alpha(s.color, 0.08), border: `1px solid ${alpha(s.color, 0.2)}` }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.value}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 700, mt: 0.25 }}>{s.label}</Typography>
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
                borderRadius: '10px',
                bgcolor: alpha(theme.palette.background.paper, 0.5),
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
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <BiotechOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.5 }} />
        <Typography fontWeight={700} color="text.secondary">No lab orders</Typography>
        <Typography fontSize={13} color="text.disabled" sx={{ mt: 0.5 }}>
          Lab test orders will appear here
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {sorted.map((o) => <LabOrderHistoryCard key={o.id} order={o} />)}
    </Stack>
  );
}

/* ─── Main ConsultationPage ────────────────────────────────────────────────── */

export function ConsultationPage(): React.JSX.Element {
  const theme = useTheme();
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
  const [patient, setPatient] = useState<Patient | undefined>();
  const [currentToken, setCurrentToken] = useState<Token | null>(null);

  /* Appointment */
  const query = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsService.get(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
  const appointment = query.data ?? null;

  /* All appointments for visit history */
  const allAppts = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });

  /* Full patient */
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

  /* Current token for Rx */
  useEffect(() => {
    if (!appointment) return;
    const dateStr = new Date(appointment.startsAt).toLocaleDateString('en-CA');
    void window.clinic.tokens
      .list(dateStr)
      .then((tokens: Token[]) => {
        const t = tokens.find(
          (tok) => tok.patientId === appointment.patientId && tok.doctorId === appointment.providerId,
        );
        setCurrentToken(t ?? null);
      })
      .catch(() => undefined);
  }, [appointment]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['appointment', id] });
    await qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const [redirectAfterRx, setRedirectAfterRx] = useState(false);

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

  const handleCompleteVisit = async () => {
    if (!appointment) return;
    try {
      const apptDate = new Date(appointment.startsAt).toLocaleDateString('en-CA');
      let tok = currentToken;
      if (!tok) {
        tok = await window.clinic.tokens.getForPatient(appointment.patientId, apptDate, appointment.providerId);
      }
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

      setRedirectAfterRx(true);
      if (tok) {
        setRxToken(tok);
      }

      await completeMutation.mutateAsync();
    } catch {
      // Error handled by mutation toast
    }
  };

  /* Derived */
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

  /* Loading */
  if (query.isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={100} sx={{ borderRadius: 4, mb: 2 }} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(4,1fr)', mb: 2 }}>
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
        pb: 4,
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
          {/* Left */}
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
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.09) },
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
                  gap: 0.6,
                  px: 1,
                  py: 0.3,
                  borderRadius: '6px',
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
                  mb: 0.4,
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    animation: 'consultPulse 1.4s ease-in-out infinite',
                    '@keyframes consultPulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.4, transform: 'scale(1.5)' },
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

          {/* Right: Global Watch */}
          <Box sx={{ flexShrink: 0 }}>
            <LiveClock />
          </Box>
        </Stack>
      </Box>

      {/* ══ PAGE BODY ════════════════════════════════════════════════════ */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 3 }}>

        {/* ── HERO PATIENT CARD ──────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            p: { xs: 3.5, md: 5 },
            borderRadius: '28px',
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 100%)`,
            color: theme.palette.primary.contrastText,
            position: 'relative',
            overflow: 'hidden',
            minHeight: { xs: 240, sm: 260 },
            display: 'flex',
            alignItems: 'center',
            boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.28)}`,
            border: 'none',
          }}
        >
          {/* Decorative background circles matching Waiting Room */}
          <Box sx={{ position: 'absolute', right: -20, top: -50, width: 320, height: 320, borderRadius: '50%', border: `2px solid ${alpha(theme.palette.common.white, 0.12)}`, pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', right: 100, bottom: -90, width: 260, height: 260, borderRadius: '50%', border: `2px solid ${alpha(theme.palette.common.white, 0.08)}`, pointerEvents: 'none' }} />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
            sx={{ position: 'relative', zIndex: 1, width: '100%' }}
          >
            {/* Left: Patient Identity & Clinical Overview */}
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              {/* Top Row: Avatar + Name + Tags */}
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Avatar
                  sx={{
                    width: { xs: 68, md: 78 },
                    height: { xs: 68, md: 78 },
                    fontSize: 28,
                    fontWeight: 900,
                    bgcolor: alpha(theme.palette.common.white, 0.22),
                    color: theme.palette.common.white,
                    border: `2px solid ${alpha(theme.palette.common.white, 0.45)}`,
                    boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.18)}`,
                    flexShrink: 0,
                  }}
                >
                  {initials(appointment.patient.firstName, appointment.patient.lastName)}
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <Typography
                      sx={{
                        fontSize: { xs: 24, md: 34 },
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.15,
                        color: theme.palette.common.white,
                        textShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.15)}`,
                      }}
                    >
                      {patientLabel}
                    </Typography>

                    {appointment.tokenNumber && (
                      <Box sx={{ px: 1.2, py: 0.35, borderRadius: '8px', bgcolor: alpha(theme.palette.common.white, 0.25), border: `1px solid ${alpha(theme.palette.common.white, 0.4)}`, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <ConfirmationNumberOutlinedIcon sx={{ fontSize: 13, color: theme.palette.common.white }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: theme.palette.common.white }}>
                          Token #{String(appointment.tokenNumber).padStart(3, '0')}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ px: 1.2, py: 0.35, borderRadius: '8px', bgcolor: alpha(theme.palette.common.white, 0.18), border: `1px solid ${alpha(theme.palette.common.white, 0.3)}`, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <MedicalServicesOutlinedIcon sx={{ fontSize: 13, color: theme.palette.common.white }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: theme.palette.common.white }}>
                        {patientVisits.length > 1 ? `${patientVisits.length}th Visit` : '1st Visit'} · OPD
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Key Metadata Pills */}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {patient?.mrNumber && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.2), border: `1px solid ${alpha(theme.palette.common.white, 0.35)}`, display: 'inline-flex', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.common.white }}>MR# {patient.mrNumber}</Typography>
                      </Box>
                    )}
                    {doctorLabel && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <LocalHospitalOutlinedIcon sx={{ fontSize: 12, color: theme.palette.common.white }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.common.white }}>{doctorLabel}</Typography>
                      </Box>
                    )}
                    {(ageStr || patient?.gender) && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`, display: 'inline-flex', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.common.white }}>
                          {[ageStr, patient?.gender].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    )}
                    {patient?.dateOfBirth && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <CakeOutlinedIcon sx={{ fontSize: 12, color: alpha(theme.palette.common.white, 0.9) }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.common.white }}>
                          DOB: {new Date(patient.dateOfBirth).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    )}
                    {(appointment.patient.phone || patient?.phone) && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <LocalPhoneOutlinedIcon sx={{ fontSize: 12, color: alpha(theme.palette.common.white, 0.9) }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.common.white }}>
                          {appointment.patient.phone || patient?.phone}
                        </Typography>
                      </Box>
                    )}
                    {patient?.address && (
                      <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                        <HomeOutlinedIcon sx={{ fontSize: 12, color: alpha(theme.palette.common.white, 0.9) }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: theme.palette.common.white }}>{patient.address}</Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Stack>

              {/* Bottom Clinical Insights Glass Strip */}
              <Box
                sx={{
                  p: { xs: 1.5, md: 1.75 },
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.18)} 0%, ${alpha(theme.palette.common.white, 0.08)} 100%)`,
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${alpha(theme.palette.common.white, 0.25)}`,
                  boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.08)}`,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1fr 1fr' },
                    alignItems: 'center',
                  }}
                >
                  {/* Chief Complaint / Visit Reason */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha(theme.palette.common.white, 0.75), mb: 0.2 }}>
                      Chief Complaint / Reason
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: theme.palette.common.white, lineHeight: 1.3 }}>
                      {appointment.reason || 'General OPD Consultation & Evaluation'}
                    </Typography>
                    {appointment.notes && (
                      <Typography sx={{ fontSize: 11, color: alpha(theme.palette.common.white, 0.85), mt: 0.2 }}>
                        Note: {appointment.notes}
                      </Typography>
                    )}
                  </Box>

                  {/* Vitals & Physical Status */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha(theme.palette.common.white, 0.75), mb: 0.2 }}>
                      Vitals & Physical Details
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.common.white }}>
                        Weight: {patient?.weight ? `${patient.weight} kg` : '—'}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: alpha(theme.palette.common.white, 0.6) }}>·</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.common.white }}>
                        Blood: {patient?.bloodGroup || '—'}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Alerts & Emergency */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha(theme.palette.common.white, 0.75), mb: 0.2 }}>
                      Alerts & Emergency
                    </Typography>
                    {patient?.allergies || patient?.chronicConditions ? (
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: alpha(theme.palette.common.white, 0.95), lineHeight: 1.3 }}>
                        {[patient?.allergies ? `Allergies: ${patient.allergies}` : null, patient?.chronicConditions ? `Chronic: ${patient.chronicConditions}` : null].filter(Boolean).join(' · ')}
                      </Typography>
                    ) : patient?.emergencyContactName ? (
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.common.white, lineHeight: 1.3 }}>
                        Emergency: {patient.emergencyContactName} {patient.emergencyContactPhone ? `(${patient.emergencyContactPhone})` : ''}
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: alpha(theme.palette.common.white, 0.75) }}>
                        No known medical alerts · Normal risk
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Stack>

            {/* Consultation Timer Block */}
            <Box
              sx={{
                flexShrink: 0,
                px: { xs: 2.5, md: 3 },
                py: 2.2,
                borderRadius: '20px',
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.45)} 0%, ${alpha(theme.palette.background.default, 0.68)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.42)} 0%, ${alpha(theme.palette.common.white, 0.18)} 100%)`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: theme.palette.mode === 'dark'
                  ? `1px solid ${alpha(theme.palette.common.white, 0.22)}`
                  : `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
                boxShadow: theme.palette.mode === 'dark'
                  ? `0 12px 32px ${alpha(theme.palette.common.black, 0.25)}, inset 0 1px 1px ${alpha(theme.palette.common.white, 0.25)}`
                  : `0 12px 32px ${alpha(theme.palette.common.black, 0.08)}, inset 0 1px 2px ${alpha(theme.palette.common.white, 0.85)}`,
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

        {/* ── STAT CARDS ─────────────────────────────────────────────── */}
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
            note="Queue number"
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
            note="All appointments"
            icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 20 }} />}
            accentColor={theme.palette.secondary.main}
          />
        </Box>

        {/* ── TWO-COLUMN LAYOUT ──────────────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) 360px' },
            alignItems: 'start',
          }}
        >
          {/* ── LEFT ──────────────────────────────────────────────────── */}
          <Stack spacing={2.5}>
            {/* History Tabs */}
            <Box
              sx={{
                borderRadius: '20px',
                bgcolor: alpha(theme.palette.background.paper, 0.7),
                border: `1px solid ${theme.palette.divider}`,
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
              }}
            >
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
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
                <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label={`Visits (${patientVisits.length})`} />
                <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Prescriptions" />
                {canOrderLab && <Tab icon={<BiotechOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Lab" />}
                <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Billing" />
                <Tab icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Medical Info" />
                <Tab icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Documents" />
              </Tabs>

              <Box sx={{ minHeight: 200 }}>
                {/* Visits */}
                {tab === 0 && (
                  patientVisits.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">No visit history found.</Typography>
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

                {/* Prescriptions */}
                {tab === 1 && <PrescriptionsTab patientId={appointment.patientId} patient={patient} />}

                {/* Lab */}
                {canOrderLab && tab === 2 && <LabTab patientId={appointment.patientId} />}

                {/* Billing */}
                {tab === (canOrderLab ? 3 : 2) && <BillingTab patientId={appointment.patientId} />}

                {/* Medical Info */}
                {tab === (canOrderLab ? 4 : 3) && (
                  <Box sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                      {[
                        { label: 'Blood Group', value: patient?.bloodGroup, color: theme.palette.error.main },
                        { label: 'Allergies', value: patient?.allergies, color: theme.palette.warning.main },
                        { label: 'Chronic Conditions', value: patient?.chronicConditions, color: theme.palette.secondary.main },
                      ].map(({ label, value, color }) => (
                        <Box key={label} sx={{ p: 2, borderRadius: '12px', bgcolor: alpha(color, 0.06), border: `1px solid ${alpha(color, 0.18)}` }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                            {label}
                          </Typography>
                          <Typography sx={{ fontWeight: value ? 700 : 400, color: value ? 'text.primary' : 'text.disabled' }}>
                            {value || '—'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Documents */}
                {tab === (canOrderLab ? 5 : 4) && patient && <PatientDocumentsPanel patient={patient} />}
              </Box>
            </Box>
          </Stack>

          {/* ── RIGHT ──────────────────────────────────────────────────── */}
          <Stack spacing={2} sx={{ position: { xl: 'sticky' }, top: { xl: 88 } }}>
            {/* Actions */}
            <Panel title="Quick Actions">
              <Stack spacing={1.25}>
                <ActionBtn
                  icon={<EditNoteOutlinedIcon />}
                  label="Write Prescription (Rx)"
                  onClick={() => { if (currentToken) setRxToken(currentToken); }}
                  color="primary"
                  variant="solid"
                  fullWidth
                  disabled={!currentToken}
                />
                {canOrderLab && (
                  <ActionBtn
                    icon={<BiotechOutlinedIcon />}
                    label="Order Lab Test"
                    onClick={() => setLabOpen(true)}
                    color="warning"
                    fullWidth
                  />
                )}
                <Divider sx={{ borderColor: 'divider', my: 0.5 }} />
                <ActionBtn
                  icon={<CheckCircleOutlinedIcon />}
                  label="Complete Visit"
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
            if (redirectAfterRx) {
              setRedirectAfterRx(false);
              navigate('/dashboard');
            }
          }}
        />
      )}

      {labOpen && user && (
        <OrderLabDialog
          open
          patientId={appointment.patientId}
          patientName={patientLabel}
          orderedById={user.id}
          tokenId={currentToken?.id}
          onClose={() => setLabOpen(false)}
        />
      )}

      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </Box>
  );
}
