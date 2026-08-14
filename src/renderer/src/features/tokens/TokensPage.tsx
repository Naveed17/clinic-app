import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useState, useRef } from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import careflowLogo from '@/assets/careflow-logo.png';
import type { Token, TokenInput, TokenPerson, TokenStatus, PrescriptionInput, PrescriptionMedicine } from '@/types/token';
import { useAuth } from '@/features/auth/AuthContext';
import { appointmentsService } from '@/services/appointments.service';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { PdfBlobPreview } from '@/utils/PdfBlobPreview';
import { printTokenSlip } from '@/utils/printTokenSlip';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';

const statusConfig: Record<TokenStatus, { label: string; color: 'warning' | 'primary' | 'success' | 'default' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function IssueTokenDialog({ open, onClose, date, defaultPatientId, defaultDoctorId, onSuccess }: {
  open: boolean;
  onClose: () => void;
  date: string;
  defaultPatientId?: string;
  defaultDoctorId?: string;
  onSuccess?: (token: Token) => void;
}) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState(defaultPatientId ?? '');
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? '');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setPatientId(defaultPatientId ?? '');
      setDoctorId(defaultDoctorId ?? '');
      setNotes('');
      setReason('');
    }
  }, [open, defaultPatientId, defaultDoctorId]);

  const { data: patients = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
  });
  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId]
  );

  const mutation = useMutation({
    mutationFn: () => window.clinic.tokens.create({ patientId, doctorId, date, notes, reason }),
    onSuccess: async (token: Token) => {
      // Auto-create appointment linked to this token
      const tokenTime = new Date(token.createdAt);
      const startsAt = tokenTime.toISOString();
      const endsAt = new Date(tokenTime.getTime() + 30 * 60000).toISOString();
      await appointmentsService.ensureSameDay({
        patientId,
        providerId: doctorId,
        startsAt,
        endsAt,
        reason: reason || null,
        notes: notes || null,
        recurrenceRule: null,
      });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setPatientId(''); setDoctorId(''); setNotes(''); setReason('');
      onClose();
      onSuccess?.(token);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Issue Token" subtitle="Create a queue token for a patient visit." />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && (
            <Alert severity="error">
              {(mutation.error as Error)?.message || 'Failed to issue token.'}
            </Alert>
          )}
          <Autocomplete
            options={patients}
            getOptionLabel={(p) => `${p.firstName} ${p.lastName}`}
            value={selectedPatient}
            onChange={(_, v) => setPatientId(v?.id ?? '')}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => <TextField {...params} label="Patient" fullWidth />}
          />
          <FormControl fullWidth>
            <InputLabel>Doctor</InputLabel>
            <Select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <MenuItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Reason (optional)</InputLabel>
            <Select label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}>
              <MenuItem value="">— None —</MenuItem>
              <MenuItem value="Checkup">Checkup</MenuItem>
              <MenuItem value="Follow-up">Follow-up</MenuItem>
              <MenuItem value="Urgent">Urgent</MenuItem>
              <MenuItem value="Consultation">Consultation</MenuItem>
              <MenuItem value="Lab Results">Lab Results</MenuItem>
              <MenuItem value="Vaccination">Vaccination</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Notes (optional)"
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton
          disabled={!patientId || !doctorId}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Issue Token
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}

Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzA.ttf' },
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lNkaiiRdih4SpP_SEvyRTo39l8hw.ttf', fontWeight: 'bold' },
  ],
});

const ts = StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    color: POS_RECEIPT.ink,
    paddingTop: POS_PAPER.pdfPaddingTop,
    paddingBottom: POS_PAPER.pdfPaddingBottom,
    paddingLeft: POS_PAPER.pdfPaddingLeft,
    paddingRight: POS_PAPER.pdfPaddingRight,
    fontFamily: 'Courier',
  },
  logo: { width: 36, height: 36, alignSelf: 'center', marginBottom: 6 },
  shopName: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 2, color: '#000' },
  shopSub: { fontSize: 9, textAlign: 'center', color: '#000', marginBottom: 1 },
  stars: { fontSize: 9, textAlign: 'center', color: '#000', marginVertical: 5 },
  title: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginVertical: 2, letterSpacing: 1, color: '#000' },
  tokenBox: { borderWidth: 2, borderColor: '#000', marginVertical: 8, paddingVertical: 8, alignItems: 'center' },
  tokenLabel: { fontSize: 9, letterSpacing: 2, color: '#000', fontWeight: 'bold' },
  tokenNum: { fontSize: 48, fontWeight: 'bold', lineHeight: 1, letterSpacing: 3, color: '#000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  lbl: { fontSize: 10, color: '#000', fontWeight: 'bold' },
  val: { fontSize: 10, color: '#000' },
  footer: { fontSize: 9, color: '#000', textAlign: 'center', marginTop: 10 },
  brand: { fontSize: 8, color: '#000', textAlign: 'center', marginTop: 8, fontWeight: 'bold', letterSpacing: 1 },
});

export function TokenSlipDocument({ token, clinicName, clinicAddress, clinicPhone }: {
  token: Token; clinicName: string; clinicAddress: string; clinicPhone: string;
}) {
  const date = new Date(token.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Document>
      <Page size={[POS_PAPER.pdfPageWidth, POS_PAPER.pdfPageHeightToken]} style={ts.page} wrap={false}>
        <Image src={careflowLogo} style={ts.logo} />
        <Text style={ts.shopName}>{clinicName || POS_RECEIPT.clinicFallback}</Text>
        {clinicAddress ? <Text style={ts.shopSub}>{clinicAddress}</Text> : null}
        {clinicPhone ? <Text style={ts.shopSub}>Tel: {clinicPhone}</Text> : null}
        <Text style={ts.stars}>{POS_RECEIPT.starLine}</Text>
        <Text style={ts.title}>PATIENT TOKEN SLIP</Text>
        <Text style={ts.stars}>{POS_RECEIPT.starLine}</Text>
        <View style={ts.tokenBox}>
          <Text style={ts.tokenLabel}>TOKEN NO.</Text>
          <Text style={ts.tokenNum}>{String(token.tokenNumber).padStart(3, '0')}</Text>
        </View>
        <Text style={ts.stars}>{POS_RECEIPT.starLine}</Text>
        <View style={ts.row}><Text style={ts.lbl}>Patient</Text><Text style={ts.val}>{token.patient.firstName} {token.patient.lastName}</Text></View>
        {token.patient.mrNumber ? <View style={ts.row}><Text style={ts.lbl}>MR #</Text><Text style={ts.val}>{token.patient.mrNumber}</Text></View> : null}
        <View style={ts.row}><Text style={ts.lbl}>Doctor</Text><Text style={ts.val}>Dr. {token.doctor.firstName} {token.doctor.lastName}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Date</Text><Text style={ts.val}>{date}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Time</Text><Text style={ts.val}>{time}</Text></View>
        {token.notes ? <View style={ts.row}><Text style={ts.lbl}>Note</Text><Text style={ts.val}>{token.notes}</Text></View> : null}
        {token.reason ? <View style={ts.row}><Text style={ts.lbl}>Reason</Text><Text style={ts.val}>{token.reason}</Text></View> : null}
        <Text style={ts.stars}>{POS_RECEIPT.starLine}</Text>
        <Text style={ts.footer}>Please wait for your token to be called.{`\n`}{POS_RECEIPT.thankYou}</Text>
        <Text style={ts.brand}>CAREFLOW</Text>
      </Page>
    </Document>
  );
}

export function PrescriptionDialog({ token, onClose }: { token: Token; onClose: () => void }) {
  const qc = useQueryClient();
  const emptyMed = (): PrescriptionMedicine => ({ name: '', dosage: '', duration: '', instructions: '' });
  const [diagnosis, setDiagnosis] = useState(token.prescription?.diagnosis ?? '');
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(
    token.prescription?.medicines.length ? token.prescription.medicines : [emptyMed()]
  );
  const [tests, setTests] = useState<string[]>(token.prescription?.tests ?? []);
  const [testInput, setTestInput] = useState('');
  const [advice, setAdvice] = useState(token.prescription?.advice ?? '');
  const [labTest, setLabTest] = useState('');

  const { data: labOrders = [], refetch: refetchLabOrders } = useQuery<import('@/types/lab').LabOrder[]>({
    queryKey: ['lab-orders-token', token.id],
    queryFn: () => window.clinic.lab.listByToken(token.id),
  });

  const createLabOrderMutation = useMutation({
    mutationFn: (test: string) =>
      window.clinic.lab.create({ patientId: token.patientId, orderedById: token.doctorId, tokenId: token.id, test }),
    onSuccess: () => { void refetchLabOrders(); setLabTest(''); },
  });

  const mutation = useMutation({
    mutationFn: () => window.clinic.tokens.upsertPrescription(token.id, { diagnosis, medicines, tests, advice } as PrescriptionInput),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['tokens'] }); onClose(); },
  });

  const updateMed = (i: number, field: keyof PrescriptionMedicine, val: string) =>
    setMedicines((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={dialogPaperProps}>
        <FormDialogTitle
          title={`Prescription — Token #${String(token.tokenNumber).padStart(3, '0')}`}
          subtitle={`${token.patient.firstName} ${token.patient.lastName} · Dr. ${token.doctor.firstName} ${token.doctor.lastName}`}
        />
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Diagnosis" fullWidth value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Medicines</Typography>
              <Stack spacing={1.5}>
                {medicines.map((m, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 1 }}>
                      <MedicineAutocomplete
                        value={m.name}
                        onChange={(name) => updateMed(i, 'name', name)}
                        size="small"
                      />
                      <TextField size="small" label="Dosage" value={m.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)} />
                      <TextField size="small" label="Duration" value={m.duration} onChange={(e) => updateMed(i, 'duration', e.target.value)} />
                      <TextField size="small" label="Instructions" value={m.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)} />
                      <IconButton size="small" color="error" onClick={() => setMedicines((p) => p.filter((_, idx) => idx !== i))} disabled={medicines.length === 1}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
                <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setMedicines((p) => [...p, emptyMed()])} sx={{ alignSelf: 'flex-start' }}>
                  Add Medicine
                </Button>
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Lab Orders</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  label="Test name"
                  value={labTest}
                  onChange={(e) => setLabTest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && labTest.trim()) createLabOrderMutation.mutate(labTest.trim()); }}
                  sx={{ flex: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!labTest.trim()}
                  loading={createLabOrderMutation.isPending}
                  onClick={() => createLabOrderMutation.mutate(labTest.trim())}
                >
                  Order
                </Button>
              </Stack>
              {labOrders.length > 0 && (
                <Stack spacing={0.5}>
                  {labOrders.map((o) => (
                    <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={o.test}
                        size="small"
                        color={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'error' : 'warning'}
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">{o.status.replace('_', ' ')}</Typography>
                      {o.result && <Typography variant="caption" color="text.secondary">— {o.result}</Typography>}
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Notes / Tests (text)</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                {tests.map((t, i) => (
                  <Chip key={i} label={t} onDelete={() => setTests((p) => p.filter((_, idx) => idx !== i))} size="small" />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Add note" value={testInput} onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && testInput.trim()) { setTests((p) => [...p, testInput.trim()]); setTestInput(''); } }}
                />
                <Button size="small" onClick={() => { if (testInput.trim()) { setTests((p) => [...p, testInput.trim()]); setTestInput(''); } }}>Add</Button>
              </Stack>
            </Box>

            <TextField label="Advice / Notes" fullWidth multiline rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton loading={mutation.isPending} onClick={() => mutation.mutate()}>Save Prescription</SubmitButton>
        </DialogActions>
      </Dialog>
    </>
  );
}


export function TokenPrintPreview({
  token,
  onClose,
  autoPrint = false,
}: {
  token: Token;
  onClose: () => void;
  /** Walk-in: open preview and silently print to the POS printer */
  autoPrint?: boolean;
}) {
  const [clinic, setClinic] = useState<{ clinicName: string; clinicAddress: string; clinicPhone: string } | null>(null);
  const [freshToken, setFreshToken] = useState<Token>(token);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const autoPrintDone = useRef(false);

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setClinic({
      clinicName: s.clinicName ?? '',
      clinicAddress: s.clinicAddress ?? '',
      clinicPhone: s.clinicPhone ?? '',
    }));
    // Always fetch fresh token data from DB so prescription is always included
    void window.clinic?.tokens?.getById?.(token.id).then((fresh) => {
      if (fresh) setFreshToken(fresh as Token);
    });
  }, [token.id]);

  const documentKey = [
    freshToken.id,
    freshToken.tokenNumber,
    clinic?.clinicName ?? '',
    clinic?.clinicAddress ?? '',
    clinic?.clinicPhone ?? '',
  ].join('|');

  const pdfDocument = useMemo(() => {
    if (!clinic) return null;
    return <TokenSlipDocument token={freshToken} {...clinic} />;
  }, [clinic, freshToken]);

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printTokenSlip(freshToken, { silent: true });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    if (!autoPrint || autoPrintDone.current) return;
    autoPrintDone.current = true;
    void handlePrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography fontWeight={700} fontSize={15}>
          Token Slip PDF
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto', bgcolor: '#f1f5f9' }}>
        {pdfDocument ? (
          <PdfBlobPreview documentKey={documentKey} pdfDocument={pdfDocument} height={560} />
        ) : (
          <Box sx={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading...</Typography>
          </Box>
        )}
      </DialogContent>
      <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        {printError && <Alert severity="error">{printError}</Alert>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <Tooltip title="Close">
            <IconButton onClick={onClose} aria-label="Close" size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={printing ? 'Printing...' : 'Print'}>
            <span>
              <IconButton
                color="primary"
                disabled={printing || !pdfDocument}
                onClick={() => void handlePrint()}
                aria-label="Print"
                size="small"
              >
                {printing ? <CircularProgress size={18} /> : <PrintOutlinedIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Dialog>
  );
}

export function TokensPage(): React.JSX.Element {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const [date, setDate] = useState(todayStr());
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printToken, setPrintToken] = useState<Token | null>(null);
  const [deleteToken, setDeleteToken] = useState<Token | null>(null);

  const { data: tokens = [], isLoading, isError } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
    refetchInterval: 10_000,
  });

  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TokenStatus }) =>
      window.clinic.tokens.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.tokens.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tokens'] });
      setDeleteToken(null);
    },
  });

  const roleFiltered = isDoctor ? tokens.filter((t) => t.doctorId === user?.id) : tokens;
  const filtered = filterDoctor === 'ALL' ? roleFiltered : roleFiltered.filter((t) => t.doctorId === filterDoctor);

  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const done = tokens.filter((t) => t.status === 'DONE').length;
  const skipped = tokens.filter((t) => t.status === 'SKIPPED').length;

  const currentToken = filtered.find((t) => t.status === 'WAITING');

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const summaryCards = [
    {
      label: 'Total Tokens',
      value: tokens.length,
      icon: <ConfirmationNumberOutlinedIcon />,
      bg: alpha(theme.palette.primary.main, 0.1),
      color: theme.palette.primary.main,
    },
    {
      label: 'Waiting',
      value: waiting,
      icon: <HourglassEmptyOutlinedIcon />,
      bg: alpha(theme.palette.warning.main, 0.12),
      color: theme.palette.warning.dark,
    },
    {
      label: 'Completed',
      value: done,
      icon: <DoneAllOutlinedIcon />,
      bg: alpha(theme.palette.success.main, 0.12),
      color: theme.palette.success.dark,
    },
    {
      label: 'Skipped',
      value: skipped,
      icon: <SkipNextOutlinedIcon />,
      bg: alpha(theme.palette.grey[500], 0.12),
      color: theme.palette.text.secondary,
    },
  ];

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: { sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Live OPD queue
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
              Token Queue
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Issue, track, and complete patient tokens for the day.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={date ? new Date(date) : null}
                onChange={(v) => setDate(v ? v.toLocaleDateString('en-CA') : todayStr())}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: {
                      width: 168,
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                      '& .MuiOutlinedInput-root': { borderRadius: 2 },
                    },
                  },
                }}
              />
            </LocalizationProvider>
            {!isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700, px: 2.25, py: 1 }}
                onClick={() => setDialogOpen(true)}
              >
                Issue Token
              </Button>
            )}
          </Stack>
        </Box>

        {/* Summary metrics */}
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {summaryCards.map((c) => (
            <Paper
              key={c.label}
              elevation={0}
              sx={{
                p: 2.25,
                ...softCard,
                bgcolor: c.bg,
                border: 'none',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                    {c.label}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(c.color, 0.15),
                    color: c.color,
                  }}
                >
                  {c.icon}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>

        {/* Now serving + queue */}
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: currentToken ? 'minmax(0, 1fr) 300px' : '1fr' }, alignItems: 'start' }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {!isDoctor && (
              <Paper elevation={0} sx={{ p: 1.5, ...softCard }}>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mr: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Doctor
                  </Typography>
                  {[{ id: 'ALL', firstName: 'All', lastName: 'Doctors' }, ...doctors].map((d) => {
                    const active = filterDoctor === d.id;
                    return (
                      <Chip
                        key={d.id}
                        label={d.id === 'ALL' ? 'All Doctors' : `Dr. ${d.firstName} ${d.lastName}`}
                        onClick={() => setFilterDoctor(d.id)}
                        color={active ? 'primary' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 700,
                          ...(active
                            ? { boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.28)}` }
                            : { borderColor: alpha(theme.palette.divider, 1) }),
                        }}
                      />
                    );
                  })}
                </Stack>
              </Paper>
            )}

            {isError && <Alert severity="error">Failed to load tokens.</Alert>}

            <Paper elevation={0} sx={{ p: 2.25, ...softCard }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.75 }}>
                <Box>
                  <Typography fontWeight={800} fontSize={16}>Queue</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    {' · '}
                    {filtered.length} token{filtered.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
                {isLoading && <CircularProgress size={18} />}
              </Stack>

              {isLoading && filtered.length === 0 ? (
                <Typography color="text.secondary" variant="body2">Loading queue…</Typography>
              ) : filtered.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '18px',
                      mx: 'auto',
                      mb: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: 'primary.main',
                    }}
                  >
                    <ConfirmationNumberOutlinedIcon sx={{ fontSize: 30 }} />
                  </Box>
                  <Typography fontWeight={700} sx={{ mb: 0.5 }}>No tokens yet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    No tokens for this date{!isAdmin ? ' — issue one to start the queue.' : '.'}
                  </Typography>
                  {!isAdmin && (
                    <Button
                      variant="contained"
                      startIcon={<AddOutlinedIcon />}
                      sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
                      onClick={() => setDialogOpen(true)}
                    >
                      Issue Token
                    </Button>
                  )}
                </Box>
              ) : (
                <Stack
                  spacing={1}
                  sx={{
                    maxHeight: { lg: 520 },
                    overflowY: 'auto',
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                  }}
                >
                  {filtered.map((token) => {
                    const cfg = statusConfig[token.status];
                    const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
                    const isCurrent = currentToken?.id === token.id;
                    return (
                      <Box
                        key={token.id}
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.75,
                          borderRadius: 1,
                          opacity: isDone ? 0.62 : 1,
                          bgcolor: isCurrent
                            ? alpha(theme.palette.primary.main, 0.07)
                            : alpha(theme.palette.primary.main, 0.03),
                          border: '1px solid',
                          borderColor: isCurrent
                            ? alpha(theme.palette.primary.main, 0.28)
                            : theme.palette.divider,
                          borderLeft: '4px solid',
                          borderLeftColor:
                            token.status === 'WAITING'
                              ? 'warning.main'
                              : token.status === 'DONE'
                                ? 'success.main'
                                : 'divider',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            bgcolor: alpha(
                              cfg.color === 'default' ? theme.palette.action.active : theme.palette[cfg.color].main,
                              0.12,
                            ),
                            color: cfg.color === 'default' ? 'text.secondary' : `${cfg.color}.main`,
                            fontWeight: 900,
                            fontSize: 14,
                          }}
                        >
                          {String(token.tokenNumber).padStart(3, '0')}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography fontWeight={700} fontSize={14} noWrap>
                              {token.patient.firstName} {token.patient.lastName}
                            </Typography>
                            {isCurrent && (
                              <Chip
                                label="Now"
                                size="small"
                                color="primary"
                                sx={{ height: 18, fontSize: 10, fontWeight: 800, borderRadius: 1 }}
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            Dr. {token.doctor.firstName} {token.doctor.lastName}
                            {token.reason ? ` · ${token.reason}` : ''}
                            {token.notes ? ` · ${token.notes}` : ''}
                          </Typography>
                        </Box>

                        <Chip
                          label={cfg.label}
                          color={cfg.color}
                          size="small"
                          sx={{ fontWeight: 700, minWidth: 78, borderRadius: 1, display: { xs: 'none', sm: 'inline-flex' } }}
                        />

                        <Stack direction="row" gap={0.25}>
                          <Tooltip title="Print Token">
                            <IconButton size="small" onClick={() => setPrintToken(token)} sx={{ borderRadius: 1 }}>
                              <PrintOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip title="Mark Done">
                              <IconButton
                                size="small"
                                color="success"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: token.id, status: 'DONE' })}
                                sx={{ borderRadius: 1 }}
                              >
                                <CheckCircleOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip title="Skip">
                              <IconButton
                                size="small"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: token.id, status: 'SKIPPED' })}
                                sx={{ borderRadius: 1 }}
                              >
                                <SkipNextOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteToken(token)}
                                sx={{ borderRadius: 1 }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Stack>

          {/* Now serving sidebar */}
          {currentToken && (
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.75,
                  borderRadius: '24px',
                  border: 'none',
                  background: theme.palette.mode === 'dark'
                    ? `linear-gradient(160deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.dark, 0.7)} 100%)`
                    : `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${darken(theme.palette.primary.main, 0.42)} 100%)`,
                  color: theme.palette.common.white,
                  boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.28)}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.12)}` }} />
                <Box sx={{ position: 'absolute', right: 20, bottom: -40, width: 100, height: 100, borderRadius: '50%', bgcolor: alpha('#fff', 0.08) }} />
                <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Now Serving
                </Typography>
                <Typography sx={{ fontSize: 64, fontWeight: 900, lineHeight: 1, mt: 1, letterSpacing: '-0.03em' }}>
                  {String(currentToken.tokenNumber).padStart(3, '0')}
                </Typography>
                <Typography fontWeight={800} fontSize={18} sx={{ mt: 1.5 }}>
                  {currentToken.patient.firstName} {currentToken.patient.lastName}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.88, mt: 0.35 }}>
                  Dr. {currentToken.doctor.firstName} {currentToken.doctor.lastName}
                </Typography>
                {(currentToken.reason || currentToken.notes) && (
                  <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mt: 1 }}>
                    {[currentToken.reason, currentToken.notes].filter(Boolean).join(' · ')}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
                  <Chip
                    label={statusConfig[currentToken.status].label}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      bgcolor: alpha('#fff', 0.18),
                      color: '#fff',
                      borderRadius: 1,
                    }}
                  />
                  <Tooltip title="Print Token">
                    <IconButton
                      size="small"
                      onClick={() => setPrintToken(currentToken)}
                      sx={{ color: '#fff', bgcolor: alpha('#fff', 0.12), borderRadius: 1, '&:hover': { bgcolor: alpha('#fff', 0.22) } }}
                    >
                      <PrintOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {!isAdmin && (
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<CheckCircleOutlinedIcon />}
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: currentToken.id, status: 'DONE' })}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 800,
                        bgcolor: '#fff',
                        color: theme.palette.primary.dark,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: alpha('#fff', 0.9), boxShadow: 'none' },
                      }}
                    >
                      Done
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<SkipNextOutlinedIcon />}
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: currentToken.id, status: 'SKIPPED' })}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        borderColor: alpha('#fff', 0.45),
                        color: '#fff',
                        '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) },
                      }}
                    >
                      Skip
                    </Button>
                  </Stack>
                )}
              </Paper>

              <Paper elevation={0} sx={{ p: 2, ...softCard }}>
                <Typography fontWeight={800} fontSize={13} sx={{ mb: 1.25 }}>Queue snapshot</Typography>
                <Stack spacing={1}>
                  {[
                    { label: 'Waiting ahead', value: Math.max(0, waiting - (currentToken ? 1 : 0)) },
                    { label: 'Done today', value: done },
                    { label: 'Skipped', value: skipped },
                  ].map((row) => (
                    <Stack key={row.label} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>{row.label}</Typography>
                      <Typography fontWeight={800} fontSize={14} color="primary.main">{row.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}
        </Box>
      </Stack>

      <IssueTokenDialog open={dialogOpen} onClose={() => setDialogOpen(false)} date={date} />
      {printToken && <TokenPrintPreview token={printToken} onClose={() => setPrintToken(null)} />}
      <ConfirmDialog
        open={Boolean(deleteToken)}
        title="Delete token?"
        message={deleteToken ? `Delete token #${String(deleteToken.tokenNumber).padStart(3, '0')} for ${deleteToken.patient.firstName} ${deleteToken.patient.lastName}?` : ''}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteToken(null)}
        onConfirm={() => deleteToken && deleteMutation.mutate(deleteToken.id)}
      />
    </>
  );
}
