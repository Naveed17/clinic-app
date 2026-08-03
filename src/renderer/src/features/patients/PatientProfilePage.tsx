import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider,
  IconButton, Paper, Stack, Tab, Tabs, TableContainer, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import type { Prescription } from '@/types/token';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tableSx, chipSx, Table, TableBody, TableCell, TableHead, TableRow } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import { PatientDialog } from './PatientDialog';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

const apptStatusColor: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'default', NO_SHOW: 'error',
};

function PrescriptionsTabInline({ patientId, patient }: { patientId: string; patient: { firstName: string; lastName: string; mrNumber?: string | null; phone?: string | null; dateOfBirth?: string | Date | null } }): React.JSX.Element {
  const theme = useTheme();
  const [printPrescription, setPrintPrescription] = useState<Prescription | null>(null);
  const { data: prescriptions = [], isLoading } = useQuery<Prescription[]>({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: async () => {
      const today = new Date();
      const results: Prescription[] = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayTokens = await window.clinic.tokens.list(d.toISOString().slice(0, 10));
        dayTokens.forEach((t: { patientId: string; prescription: Prescription | null }) => {
          if (t.patientId === patientId && t.prescription) results.push(t.prescription);
        });
      }
      return results;
    },
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (prescriptions.length === 0) return <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No prescriptions found.</Box>;

  return (
    <>
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {prescriptions.map((pr) => (
        <Paper
          key={pr.id}
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box>
              <Typography fontWeight={700} fontSize={15} color="text.primary">
                {pr.diagnosis || 'Prescription Entry'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                {new Date(pr.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Print Prescription">
                <IconButton size="small" onClick={() => setPrintPrescription(pr)} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <PrintOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Chip label="Prescription" size="small" color="primary" variant="outlined" sx={{ fontSize: 11, height: 22, fontWeight: 600, borderRadius: 1.5 }} />
            </Stack>
          </Box>
          {pr.medicines.length > 0 && (
            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>
                Prescribed Medicines
              </Typography>
              {pr.medicines.map((m, i) => (
                <Typography key={i} variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                  <strong>{i + 1}. {m.name}</strong> — {m.dosage} · {m.duration}{m.instructions ? ` · (${m.instructions})` : ''}
                </Typography>
              ))}
            </Box>
          )}
          {pr.tests.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lab Tests
              </Typography>
              <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ mt: 0.25 }}>
                {pr.tests.join(', ')}
              </Typography>
            </Box>
          )}
          {pr.advice && (
            <Box sx={{ p: 1.25, bgcolor: alpha(theme.palette.info.main, 0.06), borderRadius: 1, borderLeft: `3px solid ${theme.palette.info.main}` }}>
              <Typography variant="caption" fontWeight={700} color="info.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Doctor's Advice
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25, color: 'text.primary' }}>
                {pr.advice}
              </Typography>
            </Box>
          )}
        </Paper>
      ))}
    </Box>
    {printPrescription && (
      <PrescriptionPrintPreview
        prescription={printPrescription}
        patient={patient}
        onClose={() => setPrintPrescription(null)}
      />
    )}
    </>
  );
}

export function PatientProfilePage(): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, id }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
  });
  const patient = (patientsQuery.data?.data ?? []).find((p) => p.id === id);

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list });
  const labOrders = useQuery<{ id: string; test: string; status: string; result: string | null; orderedAt: string; patientId: string }[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<{ id: string; test: string; status: string; result: string | null; orderedAt: string; patientId: string }[]>,
  });

  if (patientsQuery.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }
  if (!patient) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>Patient not found.</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/patients')}>Back to Patients</Button>
      </Box>
    );
  }

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((s, i) => s + Number(i.total), 0);

  const getAvatarColor = (name: string) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const avatarColor = getAvatarColor(patient.firstName);

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Tooltip title="Back to patients">
              <IconButton onClick={() => navigate('/patients')} size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Patients / Profile
              </Typography>
              <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
                {patient.firstName} {patient.lastName}
              </Typography>
            </Box>
          </Stack>
          {!isAdmin && (
            <Button
              startIcon={<EditOutlinedIcon />}
              variant="outlined"
              size="medium"
              sx={{ borderRadius: 1, fontWeight: 600, px: 2.5 }}
              onClick={() => setEditOpen(true)}
            >
              Edit Profile
            </Button>
          )}
        </Box>

        {/* Hero Patient Profile Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
            <Avatar
              sx={{
                width: 76,
                height: 76,
                bgcolor: avatarColor,
                color: '#fff',
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {initials}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 260 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
                <Typography variant="h5" fontWeight={800} color="text.primary">
                  {patient.firstName} {patient.lastName}
                </Typography>
                {patient.mrNumber && (
                  <Chip
                    icon={<BadgeOutlinedIcon style={{ fontSize: 14 }} />}
                    label={`MR# ${patient.mrNumber}`}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ ...chipSx, fontWeight: 700 }}
                  />
                )}
                {patient.bloodGroup && (
                  <Chip
                    label={`Blood Group: ${patient.bloodGroup}`}
                    size="small"
                    variant="outlined"
                    color="error"
                    sx={{ ...chipSx, fontWeight: 700 }}
                  />
                )}
              </Stack>

              {/* Patient Info Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>Phone</Typography>
                    <Typography fontSize={13.5} fontWeight={600}>{patient.phone || '—'}</Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <EmailOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>Email</Typography>
                    <Typography fontSize={13.5} fontWeight={600} sx={{ wordBreak: 'break-all' }}>{patient.email || '—'}</Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <CakeOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>Date of Birth</Typography>
                    <Typography fontSize={13.5} fontWeight={600}>
                      {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <HomeOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>Address</Typography>
                    <Typography fontSize={13.5} fontWeight={600}>{patient.address || '—'}</Typography>
                  </Box>
                </Stack>

                {patient.emergencyContactName && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ContactPhoneOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>Emergency Contact</Typography>
                      <Typography fontSize={13.5} fontWeight={600}>{patient.emergencyContactName} ({patient.emergencyContactPhone || 'N/A'})</Typography>
                    </Box>
                  </Stack>
                )}
              </Box>
            </Box>
          </Box>

          {/* Medical Alert Banner */}
          {(patient.allergies || patient.chronicConditions) && (
            <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid', borderTopColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {patient.allergies && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.error.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <WarningAmberOutlinedIcon color="error" />
                  <Box>
                    <Typography variant="caption" color="error.main" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Allergies
                    </Typography>
                    <Typography fontSize={13.5} fontWeight={600} color="error.dark">
                      {patient.allergies}
                    </Typography>
                  </Box>
                </Paper>
              )}

              {patient.chronicConditions && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.warning.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <HealthAndSafetyOutlinedIcon color="warning" />
                  <Box>
                    <Typography variant="caption" color="warning.main" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Chronic Conditions
                    </Typography>
                    <Typography fontSize={13.5} fontWeight={600} color="warning.dark">
                      {patient.chronicConditions}
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>
          )}
        </Paper>

        {/* Vital Stats Overview Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {[
            { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon sx={{ color: 'primary.main' }} />, color: theme.palette.primary.main },
            { label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon sx={{ color: 'secondary.main' }} />, color: theme.palette.secondary.main },
            { label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon sx={{ color: 'warning.main' }} />, color: theme.palette.warning.main },
            { label: 'Total Paid', value: money(totalPaid), icon: <ReceiptOutlinedIcon sx={{ color: 'success.main' }} />, color: theme.palette.success.main },
          ].map(({ label, value, icon, color }) => (
            <Paper
              key={label}
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}>
                  {label}
                </Typography>
                <Typography fontWeight={800} fontSize={18} color="text.primary">
                  {value}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Content Tabs */}
        <Paper elevation={0} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              px: 2.5,
              pt: 0.5,
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: 48,
              '& .MuiTab-root': {
                minHeight: 48,
                fontSize: 13.5,
                fontWeight: 700,
                textTransform: 'none',
                gap: 1,
              },
            }}
          >
            <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Appointments (${patientAppointments.length})`} />
            <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Billing (${patientInvoices.length})`} />
            <Tab icon={<BiotechOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Lab (${patientLab.length})`} />
            <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Prescriptions" />
          </Tabs>

          <Box sx={{ minHeight: 220 }}>
            {tab === 0 && (
              patientAppointments.length === 0 ? (
                <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No appointments record found for this patient.</Box>
              ) : (
                <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
                  <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
                    <TableHead sx={tableSx.head}>
                      <TableRow>
                        {['Date & Time', 'Doctor', 'Reason', 'Status'].map((h) => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patientAppointments.map((a) => (
                        <TableRow key={a.id} sx={tableSx.row}>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{new Date(a.startsAt).toLocaleString()}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Dr. {a.provider.firstName} {a.provider.lastName}</TableCell>
                          <TableCell>{a.reason ?? '—'}</TableCell>
                          <TableCell>
                            <Chip
                              label={a.status.replace('_', ' ')}
                              size="small"
                              color={apptStatusColor[a.status] ?? 'default'}
                              sx={chipSx}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            )}

            {tab === 1 && (
              patientInvoices.length === 0 ? (
                <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No billing invoices found.</Box>
              ) : (
                <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
                  <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
                    <TableHead sx={tableSx.head}>
                      <TableRow>
                        {['Invoice #', 'Date', 'Status', 'Total Amount', 'Paid Amount'].map((h, i) => (
                          <TableCell key={h} align={i >= 3 ? 'right' : 'left'}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patientInvoices.map((inv) => (
                        <TableRow key={inv.id} sx={tableSx.row}>
                          <TableCell><Typography fontSize={12.5} fontWeight={700} color="primary.main">{inv.invoiceNumber}</Typography></TableCell>
                          <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={inv.status.replace('_', ' ')}
                              size="small"
                              color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                              sx={chipSx}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{money(Number(inv.total))}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{money(Number(inv.amountPaid ?? 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            )}

            {tab === 2 && (
              patientLab.length === 0 ? (
                <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No lab test orders found.</Box>
              ) : (
                <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
                  <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
                    <TableHead sx={tableSx.head}>
                      <TableRow>
                        {['Test Name', 'Ordered Date', 'Status', 'Result'].map((h) => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patientLab.map((o) => (
                        <TableRow key={o.id} sx={tableSx.row}>
                          <TableCell sx={{ fontWeight: 600 }}>{o.test}</TableCell>
                          <TableCell>{new Date(o.orderedAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={o.status.replace('_', ' ')}
                              size="small"
                              color={o.status === 'COMPLETED' ? 'success' : o.status === 'IN_PROGRESS' ? 'primary' : o.status === 'CANCELLED' ? 'error' : 'warning'}
                              sx={chipSx}
                            />
                          </TableCell>
                          <TableCell sx={{ color: o.result ? 'text.primary' : 'text.disabled', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.result ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            )}
            {tab === 3 && <PrescriptionsTabInline patientId={patient.id} patient={patient} />}
          </Box>
        </Paper>
      </Box>

      {editOpen && patient && (
        <PatientDialog open={editOpen} patient={patient} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
