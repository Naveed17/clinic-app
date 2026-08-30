import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import {
  Alert, Avatar, Box, Button, Chip, IconButton, Paper, Skeleton, Stack,
  Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import type { Prescription } from '@/types/token';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientDialog } from './PatientDialog';
import { PatientDocumentsPanel } from './PatientDocumentsPanel';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import { AppointmentVisitList } from '@/features/appointments/AppointmentVisitList';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import type { LabOrder } from '@/types/lab';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

const invoiceLeftBorder: Record<string, string> = {
  PAID: 'success.main', PARTIALLY_PAID: 'warning.main', DRAFT: 'info.main', VOID: 'error.main', REFUNDED: 'error.main',
};


function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Box
        sx={{
          width: 64, height: 64, borderRadius: '18px', mx: 'auto', mb: 1.5,
          display: 'grid', placeItems: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  );
}

function PrescriptionsTabInline({ patientId, patient }: {
  patientId: string;
  patient: { firstName: string; lastName?: string | null; mrNumber?: string | null; phone?: string | null; dateOfBirth?: string | Date | null };
}): React.JSX.Element {
  const theme = useTheme();
  type PrintItem = { prescription: Prescription; doctor: { firstName: string; lastName: string } };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: async () => {
      const today = new Date();
      const results: PrintItem[] = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayTokens = await window.clinic.tokens.list(d.toISOString().slice(0, 10));
        for (const t of dayTokens) {
          if (t.patientId === patientId && t.prescription) {
            results.push({ prescription: t.prescription, doctor: t.doctor ?? { firstName: '', lastName: '' } });
          }
        }
      }
      return results;
    },
  });

  if (isLoading) return <Box sx={{ p: 1 }}><ListCardsSkeleton count={4} /></Box>;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 30 }} />}
        title="No prescriptions"
        subtitle="Prescriptions written for this patient will appear here."
      />
    );
  }

  return (
    <>
      <Stack spacing={1} sx={{ p: 2, maxHeight: 520, overflowY: 'auto', pr: 0.5 }}>
        {items.map((item) => {
          const pr = item.prescription;
          const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
          const title = pr.thumbName?.trim() || pr.diagnosis || 'Prescription Entry';
          const thumbSrc = pr.thumbnail ? `data:image/png;base64,${pr.thumbnail}` : null;
          return (
            <Box
              key={pr.id}
              onClick={() => setPrintItem({ prescription: pr, doctor: item.doctor ?? { firstName: '', lastName: '' } })}
              sx={{
                p: 1.25,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                border: '1px solid',
                borderColor: 'divider',
                borderLeft: '4px solid',
                borderLeftColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 72,
                  flexShrink: 0,
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumbSrc ? (
                  <Box
                    component="img"
                    src={thumbSrc}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <MedicalServicesOutlinedIcon sx={{ fontSize: 22, color: 'primary.main' }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} fontSize={14} noWrap>
                  {title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                  {new Date(pr.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  {doctorLabel ? ` · Dr. ${doctorLabel.replace(/^dr\.?\s*/i, '')}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Print Prescription">
                  <IconButton
                    size="small"
                    onClick={() => setPrintItem({ prescription: pr, doctor: item.doctor ?? { firstName: '', lastName: '' } })}
                    sx={{ borderRadius: 1 }}
                  >
                    <PrintOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Chip label="Rx" size="small" color="primary" sx={{ fontWeight: 700, borderRadius: 1, height: 22 }} />
              </Stack>
            </Box>
          );
        })}
      </Stack>
      {printItem && (
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', mt: 0.15, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
          {label}
        </Typography>
        <Typography fontSize={13} fontWeight={600} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
      </Box>
    </Stack>
  );
}

export function PatientProfilePage(): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const { can } = useLicense();
  const isAdmin = user?.role === 'admin';
  const showLab = can('labDashboard');
  const showBilling = can('billing');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const tokenPrint = usePrintAppointmentToken();

  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, id }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
  });
  const patient = (patientsQuery.data?.data ?? []).find((p) => p.id === id);

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, enabled: showBilling });
  const labOrders = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<LabOrder[]>,
    enabled: showLab,
  });

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  if (patientsQuery.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={72} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }
  if (!patient) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>Patient not found.</Alert>
        <Button sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || 'P';
  const totalPaid = patientInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((s, i) => s + Number(i.total), 0);
  const completedAppts = patientAppointments.filter((a) => a.status === 'COMPLETED').length;
  const pendingLab = patientLab.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  const summaryCards = [
    { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon />, bg: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main },
    { label: 'Completed Visits', value: completedAppts, icon: <MedicalServicesOutlinedIcon />, bg: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.dark },
    ...(showLab
      ? [{ label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon />, bg: alpha(theme.palette.info.main, 0.12), color: theme.palette.info.dark }]
      : []),
    ...(showBilling
      ? [{ label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon />, bg: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.dark }]
      : []),
  ];

  const tabs = [
    { label: 'Appointments', count: patientAppointments.length, icon: <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />, value: 0 },
    ...(showBilling
      ? [{ label: 'Billing', count: patientInvoices.length, icon: <ReceiptOutlinedIcon sx={{ fontSize: 18 }} />, value: 1 }]
      : []),
    ...(showLab
      ? [{ label: 'Lab', count: patientLab.length, icon: <BiotechOutlinedIcon sx={{ fontSize: 18 }} />, value: 2 }]
      : []),
    { label: 'Documents', count: null, icon: <InsertDriveFileOutlinedIcon sx={{ fontSize: 18 }} />, value: 3 },
    { label: 'Prescriptions', count: null, icon: <MedicalServicesOutlinedIcon sx={{ fontSize: 18 }} />, value: 4 },
  ];

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: { sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Tooltip title="Back to patients">
              <IconButton
                onClick={() => navigate('/patients')}
                size="small"
                sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Patient profile
              </Typography>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
                {patient.firstName} {patient.lastName || ''}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {patient.mrNumber ? `MR# ${patient.mrNumber}` : 'Medical record overview'}
                {patient.phone ? ` · ${patient.phone}` : ''}
                {patient.weight != null ? ` · ${patient.weight} kg` : ''}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <PatientWhatsAppButton patient={patient} sx={{ px: 2.25, py: 1 }} />
            {!isAdmin && (
              <Button
                startIcon={<EditOutlinedIcon />}
                variant="contained"
                sx={{ borderRadius: 2, fontWeight: 700, px: 2.25, py: 1 }}
                onClick={() => setEditOpen(true)}
              >
                Edit Profile
              </Button>
            )}
          </Stack>
        </Box>

        {/* Summary metrics */}
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {summaryCards.map((c) => (
            <Paper key={c.label} elevation={0} sx={{ p: 2.25, ...softCard, bgcolor: c.bg, border: 'none' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                    {c.label}
                  </Typography>
                </Box>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(c.color, 0.15), color: c.color }}>
                  {c.icon}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>

        {/* Two-column layout */}
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          {/* Main — tabs + records */}
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={{ ...softCard, overflow: 'hidden' }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  minHeight: 48,
                  '& .MuiTab-root': { minHeight: 48, fontSize: 13, fontWeight: 700, textTransform: 'none', gap: 0.75 },
                }}
              >
                {tabs.map((t) => (
                  <Tab
                    key={t.label}
                    icon={t.icon}
                    iconPosition="start"
                    label={t.count !== null ? `${t.label} (${t.count})` : t.label}
                    value={t.value}
                  />
                ))}
              </Tabs>

              <Box sx={{ minHeight: 200 }}>
                {tab === 0 && (
                  patientAppointments.length === 0 ? (
                    <EmptyState
                      icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 30 }} />}
                      title="No appointments"
                      subtitle="Appointment history for this patient will show here."
                    />
                  ) : (
                    <AppointmentVisitList
                      appointments={[...patientAppointments].sort(
                        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
                      )}
                      onOpen={(a) => navigate(`/appointments/${a.id}`)}
                      onPrint={tokenPrint.printFor}
                      printingId={tokenPrint.printingId}
                      maxHeight={480}
                    />
                  )
                )}

                {showBilling && tab === 1 && (
                  patientInvoices.length === 0 ? (
                    <EmptyState
                      icon={<ReceiptOutlinedIcon sx={{ fontSize: 30 }} />}
                      title="No invoices"
                      subtitle="Billing records for this patient will appear here."
                    />
                  ) : (
                    <Stack spacing={1} sx={{ p: 2, maxHeight: 480, overflowY: 'auto' }}>
                      {[...patientInvoices]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((inv) => (
                          <Box
                            key={inv.id}
                            onClick={() => {
                              if (user?.role === 'receptionist') navigate(`/billing/${inv.id}`);
                            }}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              cursor: user?.role === 'receptionist' ? 'pointer' : 'default',
                              bgcolor: alpha(theme.palette.warning.main, 0.03),
                              border: '1px solid',
                              borderColor: 'divider',
                              borderLeft: '4px solid',
                              borderLeftColor: invoiceLeftBorder[inv.status] ?? 'divider',
                              '&:hover': user?.role === 'receptionist'
                                ? { bgcolor: alpha(theme.palette.warning.main, 0.08) }
                                : undefined,
                            }}
                          >
                            <Avatar sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark', fontSize: 11, fontWeight: 800 }}>
                              {inv.invoiceNumber.slice(-4)}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={700} fontSize={14} color="primary.main">{inv.invoiceNumber}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(inv.createdAt).toLocaleDateString()} · Paid {money(Number(inv.amountPaid ?? 0))}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography fontWeight={800} fontSize={14}>{money(Number(inv.total))}</Typography>
                              <Chip
                                label={inv.status.replace('_', ' ')}
                                size="small"
                                color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                                sx={{ ...chipSx, fontWeight: 700, borderRadius: 1, mt: 0.25 }}
                              />
                            </Box>
                          </Box>
                        ))}
                    </Stack>
                  )
                )}

                {showLab && tab === 2 && (
                  patientLab.length === 0 ? (
                    <EmptyState
                      icon={<BiotechOutlinedIcon sx={{ fontSize: 30 }} />}
                      title="No lab orders"
                      subtitle="Lab test orders for this patient will show here."
                    />
                  ) : (
                    <Stack spacing={1} sx={{ p: 2, maxHeight: 480, overflowY: 'auto' }}>
                      {[...patientLab]
                        .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
                        .map((o) => (
                          <Box
                            key={o.id}
                            onClick={() => {
                              if (user?.role === 'lab_technician') navigate(`/lab/${o.id}`);
                            }}
                            sx={{
                              cursor: user?.role === 'lab_technician' ? 'pointer' : 'default',
                              borderRadius: 1,
                              '&:hover': user?.role === 'lab_technician'
                                ? { outline: `1px solid ${alpha(theme.palette.primary.main, 0.35)}` }
                                : undefined,
                            }}
                          >
                            <LabOrderHistoryCard order={o} />
                          </Box>
                        ))}
                    </Stack>
                  )
                )}

                {tab === 3 && <PatientDocumentsPanel patient={patient} />}
                {tab === 4 && <PrescriptionsTabInline patientId={patient.id} patient={patient} />}
              </Box>
            </Paper>
          </Stack>

          {/* Right sidebar */}
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {/* Patient hero card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.75,
                borderRadius: '24px',
                background: `linear-gradient(145deg, ${darken(theme.palette.primary.main, 0.12)} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.primary.light} 100%)`,
                color: theme.palette.primary.contrastText,
                boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.28)}`,
                border: 'none',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: alpha('#fff', 0.2), color: '#fff', fontSize: 22, fontWeight: 900, border: `2px solid ${alpha('#fff', 0.35)}` }}>
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={900} fontSize={18} noWrap>{patient.firstName} {patient.lastName || ''}</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                    {patient.mrNumber && (
                      <Chip label={`MR# ${patient.mrNumber}`} size="small" sx={{ height: 22, fontWeight: 700, bgcolor: alpha('#fff', 0.18), color: '#fff', borderRadius: 1 }} />
                    )}
                    {patient.weight != null && (
                      <Chip label={`${patient.weight} kg`} size="small" sx={{ height: 22, fontWeight: 700, bgcolor: alpha('#fff', 0.18), color: '#fff', borderRadius: 1 }} />
                    )}
                    {patient.bloodGroup && (
                      <Chip label={patient.bloodGroup} size="small" sx={{ height: 22, fontWeight: 700, bgcolor: alpha('#fff', 0.18), color: '#fff', borderRadius: 1 }} />
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Stack spacing={1.25}>
                {patient.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneOutlinedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
                    <Typography fontSize={13} fontWeight={600}>{patient.phone}</Typography>
                  </Stack>
                )}
                {patient.email && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailOutlinedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
                    <Typography fontSize={13} fontWeight={600} sx={{ wordBreak: 'break-all' }}>{patient.email}</Typography>
                  </Stack>
                )}
                {patient.dateOfBirth && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CakeOutlinedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
                    <Typography fontSize={13} fontWeight={600}>
                      {new Date(patient.dateOfBirth).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>

            {/* Contact details */}
            <Paper elevation={0} sx={{ p: 2.25, ...softCard }}>
              <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.75 }}>Contact Details</Typography>
              <Stack spacing={1.75}>
                <InfoRow icon={<PhoneOutlinedIcon sx={{ fontSize: 17 }} />} label="Phone" value={patient.phone || '—'} />
                <InfoRow icon={<EmailOutlinedIcon sx={{ fontSize: 17 }} />} label="Email" value={patient.email || '—'} />
                <InfoRow icon={<HomeOutlinedIcon sx={{ fontSize: 17 }} />} label="Address" value={patient.address || '—'} />
                {patient.emergencyContactName && (
                  <InfoRow
                    icon={<ContactPhoneOutlinedIcon sx={{ fontSize: 17 }} />}
                    label="Emergency"
                    value={`${patient.emergencyContactName}${patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ''}`}
                  />
                )}
              </Stack>
            </Paper>

            {/* Quick stats */}
            <Paper elevation={0} sx={{ p: 2.25, ...softCard }}>
              <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.75 }}>Overview</Typography>
              <Stack spacing={1.25}>
                {[
                  ...(showBilling ? [{ label: 'Total Paid', value: money(totalPaid), color: 'success.main' }] : []),
                  ...(showLab ? [{ label: 'Pending Lab', value: pendingLab, color: 'warning.main' }] : []),
                  { label: 'Completed Visits', value: completedAppts, color: 'primary.main' },
                ].map((s) => (
                  <Stack key={s.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>{s.label}</Typography>
                    <Typography fontWeight={800} fontSize={15} color={s.color}>{s.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            {/* Medical alerts */}
            {(patient.allergies || patient.chronicConditions) && (
              <Paper elevation={0} sx={{ p: 2.25, ...softCard }}>
                <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.75 }}>Medical Alerts</Typography>
                <Stack spacing={1.25}>
                  {patient.allergies && (
                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.error.main, 0.08), borderLeft: '4px solid', borderLeftColor: 'error.main' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <WarningAmberOutlinedIcon color="error" sx={{ fontSize: 18 }} />
                        <Typography variant="caption" fontWeight={700} color="error.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Allergies
                        </Typography>
                      </Stack>
                      <Typography fontSize={13} fontWeight={600}>{patient.allergies}</Typography>
                    </Box>
                  )}
                  {patient.chronicConditions && (
                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.08), borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <HealthAndSafetyOutlinedIcon color="warning" sx={{ fontSize: 18 }} />
                        <Typography variant="caption" fontWeight={700} color="warning.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Chronic Conditions
                        </Typography>
                      </Stack>
                      <Typography fontSize={13} fontWeight={600}>{patient.chronicConditions}</Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
            )}

            {/* MR badge card */}
            {patient.mrNumber && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  ...softCard,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                  <BadgeOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Medical Record
                  </Typography>
                  <Typography fontWeight={800} fontSize={16} color="primary.main">{patient.mrNumber}</Typography>
                </Box>
              </Paper>
            )}
          </Stack>
        </Box>
      </Stack>

      {editOpen && patient && (
        <PatientDialog open={editOpen} patient={patient} onClose={() => setEditOpen(false)} />
      )}
      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </>
  );
}
