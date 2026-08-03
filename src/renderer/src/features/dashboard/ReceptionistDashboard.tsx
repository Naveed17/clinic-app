import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputLabel, MenuItem, Paper, Select,
  Step, StepLabel, Stepper, Stack, TextField, Typography, Chip, Avatar,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { useNavigate } from 'react-router-dom';
import type { TokenPerson, Token, PrescriptionFeedItem } from '@/types/token';
import type { PatientInput } from '@/types/patient';

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

/* ── Token slip PDF (same style as TokensPage) ── */
Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzA.ttf' },
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lNkaiiRdih4SpP_SEvyRTo39l8hw.ttf', fontWeight: 'bold' },
  ],
});
const STAR = '- - - - - - - - - - - - - - - - - - - -';
const ts = StyleSheet.create({
  page: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 28, fontFamily: 'Courier' },
  shopName: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
  shopSub: { fontSize: 9, textAlign: 'center', color: '#555', marginBottom: 1 },
  stars: { fontSize: 8, textAlign: 'center', color: '#999', marginVertical: 5 },
  title: { fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginVertical: 2, letterSpacing: 1 },
  tokenBox: { borderWidth: 2, borderColor: '#000', marginVertical: 8, paddingVertical: 8, alignItems: 'center' },
  tokenLabel: { fontSize: 9, letterSpacing: 2, color: '#555' },
  tokenNum: { fontSize: 48, fontWeight: 'bold', lineHeight: 1, letterSpacing: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  lbl: { fontSize: 9, color: '#666' },
  val: { fontSize: 9 },
  footer: { fontSize: 8, color: '#999', textAlign: 'center', marginTop: 10 },
});
function TokenSlip({ token, clinicName, clinicAddress, clinicPhone }: { token: Token; clinicName: string; clinicAddress: string; clinicPhone: string }) {
  const date = new Date(token.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Document>
      <Page size={[226, 380]} style={ts.page} wrap={false}>
        <Text style={ts.shopName}>{clinicName || 'CLINIC'}</Text>
        {clinicAddress ? <Text style={ts.shopSub}>{clinicAddress}</Text> : null}
        {clinicPhone ? <Text style={ts.shopSub}>Tel: {clinicPhone}</Text> : null}
        <Text style={ts.stars}>{STAR}</Text>
        <Text style={ts.title}>PATIENT TOKEN SLIP</Text>
        <Text style={ts.stars}>{STAR}</Text>
        <View style={ts.tokenBox}>
          <Text style={ts.tokenLabel}>TOKEN NO.</Text>
          <Text style={ts.tokenNum}>{String(token.tokenNumber).padStart(3, '0')}</Text>
        </View>
        <Text style={ts.stars}>{STAR}</Text>
        <View style={ts.row}><Text style={ts.lbl}>Patient</Text><Text style={ts.val}>{token.patient.firstName} {token.patient.lastName}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Doctor</Text><Text style={ts.val}>Dr. {token.doctor.firstName} {token.doctor.lastName}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Date</Text><Text style={ts.val}>{date}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Time</Text><Text style={ts.val}>{time}</Text></View>
        {token.reason ? <View style={ts.row}><Text style={ts.lbl}>Reason</Text><Text style={ts.val}>{token.reason}</Text></View> : null}
        <Text style={ts.stars}>{STAR}</Text>
        <Text style={ts.footer}>Please wait for your token to be called.{`\n`}Thank you for your visit.</Text>
      </Page>
    </Document>
  );
}

async function printTokenSlip(token: Token) {
  const s = await window.clinic.settings.get();
  const blob = await pdf(
    <TokenSlip token={token} clinicName={s.clinicName ?? ''} clinicAddress={s.clinicAddress ?? ''} clinicPhone={s.clinicPhone ?? ''} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => { iframe.contentWindow?.print(); };
}

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
  });

  const tokenMutation = useMutation({
    mutationFn: () => window.clinic.tokens.create({
      patientId, doctorId,
      date: new Date().toISOString().slice(0, 10),
      reason: reason || null,
    }),
    onSuccess: async (token: Token) => {
      await window.clinic.tokens.updateStatus(token.id, 'WAITING');
      const startsAt = new Date(token.createdAt).toISOString();
      const endsAt = new Date(new Date(token.createdAt).getTime() + 30 * 60000).toISOString();
      await appointmentsService.create({ patientId, providerId: doctorId, startsAt, endsAt, reason: reason || null, notes: null, recurrenceRule: null });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setCreatedToken(token);
      setStep(2);
      void printTokenSlip(token);
    },
  });

  function handleClose() {
    setStep(0); setPatientId(''); setDoctorId(''); setReason('');
    setCreatedToken(null); setUseExisting(false);
    form.reset(patientDefaults);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <ConfirmationNumberOutlinedIcon color="primary" />
          Walk-in Registration
        </Stack>
      </DialogTitle>
      <DialogContent>
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
                  <TextField label="Phone (optional)" {...form.register('phone')} />
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
            {tokenMutation.isError && <Alert severity="error">Could not issue token.</Alert>}
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
            <Typography variant="caption" color="text.secondary">Slip sent to printer automatically.</Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose}>Close</Button>
        {step === 0 && !useExisting && (
          <Button variant="contained" form="patient-form" type="submit" disabled={createPatientMutation.isPending}>
            Next
          </Button>
        )}
        {step === 0 && useExisting && (
          <Button variant="contained" disabled={!patientId} onClick={() => setStep(1)}>
            Next
          </Button>
        )}
        {step === 1 && (
          <Button variant="contained" disabled={!doctorId || tokenMutation.isPending} onClick={() => tokenMutation.mutate()}>
            Issue Token & Print
          </Button>
        )}
        {step === 2 && (
          <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => createdToken && printTokenSlip(createdToken)}>
            Reprint
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PrescriptionFeed(): React.JSX.Element {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const date = new Date().toISOString().slice(0, 10);
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
    <Paper variant="outlined" sx={{ p: 2.5, minWidth: 200 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <MedicalServicesOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography fontWeight={700} fontSize={14}>Prescriptions</Typography>
        {feed.length > 0 && <Chip label={feed.length} size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
      {feed.length === 0 ? (
        <Typography variant="caption" color="text.disabled">No prescriptions yet today.</Typography>
      ) : (
        <Stack spacing={1}>
          {feed.map((item) => (
            <Box key={item.id} sx={{ p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.15) }}>
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

export function ReceptionistDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data: appointments = [], isLoading } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list, refetchInterval: 15_000 });
  const { data: patientsData } = useQuery({ queryKey: ['patients', { page: 1, pageSize: 1, search: '' }], queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }), refetchInterval: 30_000 });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, refetchInterval: 30_000 });

  const today = new Date();
  const todaysAppts = appointments.filter((a) => {
    const d = new Date(a.startsAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && a.status !== 'CANCELLED';
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const checkedIn = todaysAppts.filter((a) => a.status === 'CHECKED_IN').length;
  const pendingBilling = invoices.filter((i) => i.status === 'DRAFT').length;

  return (
    <>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Reception Desk</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            {today.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        </Box>

        {/* Stat cards */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' } }}>
          {[
            { label: 'Patients Today', value: todaysAppts.length, icon: <CalendarMonthOutlinedIcon />, color: theme.palette.primary.main },
            { label: 'Checked In', value: checkedIn, icon: <HowToRegOutlinedIcon />, color: theme.palette.success.main },
            { label: 'Total Patients', value: patientsData?.total ?? 0, icon: <GroupOutlinedIcon />, color: theme.palette.secondary.main },
            { label: 'Pending Billing', value: pendingBilling, icon: <PaymentsOutlinedIcon />, color: theme.palette.warning.main },
          ].map((c) => (
            <Paper key={c.label} variant="outlined" sx={{ p: 2.5, borderTop: `3px solid ${c.color}` }}>
              <Box sx={{ color: c.color, mb: 1 }}>{c.icon}</Box>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{c.value}</Typography>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            </Paper>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr auto' } }}>
          {/* Today's queue */}
          <Paper variant="outlined" sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography fontWeight={700}>Today's Queue</Typography>
              <Button size="small" variant="outlined" onClick={() => navigate('/appointments')} sx={{ borderRadius: 2 }}>
                Manage
              </Button>
            </Stack>
            {isLoading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : todaysAppts.length === 0 ? (
              <Box sx={{ display: 'grid', minHeight: 100, placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">No appointments today.</Typography>
              </Box>
            ) : (
              <>
                <Stack spacing={1} sx={{
                  maxHeight: 340, overflowY: 'auto', pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}>
                  {todaysAppts.map((a) => (
                    <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.6), border: `1px solid ${theme.palette.divider}` }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                        {a.patient.firstName[0]}{a.patient.lastName[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{a.patient.firstName} {a.patient.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · Dr. '}{a.provider.firstName} {a.provider.lastName}
                        </Typography>
                      </Box>
                      <Chip size="small" label={a.status.replace('_', ' ')} color={statusColor[a.status]} sx={{ borderRadius: 1, fontSize: 10 }} />
                    </Box>
                  ))}
                </Stack>
                {todaysAppts.length > 5 && (
                  <Button
                    size="small"
                    onClick={() => navigate('/appointments')}
                    sx={{ mt: 1.5, alignSelf: 'center', borderRadius: 2, fontSize: 12 }}
                  >
                    View All ({todaysAppts.length})
                  </Button>
                )}
              </>
            )}
          </Paper>

          {/* Quick actions */}
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 3, minWidth: 200 }}>
              <Typography fontWeight={700} sx={{ mb: 2 }}>Quick Actions</Typography>
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<ConfirmationNumberOutlinedIcon />}
                  onClick={() => setWalkInOpen(true)}
                  fullWidth
                  sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.2, fontWeight: 700 }}
                >
                  Walk-in Registration
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PaymentsOutlinedIcon />}
                  onClick={() => navigate('/billing')}
                  fullWidth
                  sx={{
                    justifyContent: 'flex-start', borderRadius: 2, py: 1.2,
                    borderColor: alpha(theme.palette.success.main, 0.4), color: theme.palette.success.main,
                    '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.06), borderColor: theme.palette.success.main },
                  }}
                >
                  Create Invoice
                </Button>
              </Stack>
            </Paper>
            <PrescriptionFeed />
          </Stack>
        </Box>
      </Stack>
      <WalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} />
    </>
  );
}
