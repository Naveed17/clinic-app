import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import type { Token, TokenInput, TokenPerson, TokenStatus, PrescriptionInput, PrescriptionMedicine } from '@/types/token';
import { useAuth } from '@/features/auth/AuthContext';

const statusConfig: Record<TokenStatus, { label: string; color: 'warning' | 'primary' | 'success' | 'default' }> = {
  WAITING:     { label: 'Waiting',     color: 'warning' },
  IN_PROGRESS: { label: 'In Progress', color: 'primary' },
  DONE:        { label: 'Done',        color: 'success' },
  SKIPPED:     { label: 'Skipped',     color: 'default' },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IssueTokenDialog({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TokenInput>({ patientId: '', doctorId: '', date, notes: '' });

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

  const mutation = useMutation({
    mutationFn: () => window.clinic.tokens.create({ ...form, date }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      setForm({ patientId: '', doctorId: '', date, notes: '' });
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Issue Token</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && <Alert severity="error">Failed to issue token.</Alert>}
          <Autocomplete
            options={patients}
            getOptionLabel={(p) => `${p.firstName} ${p.lastName}`}
            onChange={(_, v) => setForm((f) => ({ ...f, patientId: v?.id ?? '' }))}
            renderInput={(params) => <TextField {...params} label="Patient" fullWidth />}
          />
          <FormControl fullWidth>
            <InputLabel>Doctor</InputLabel>
            <Select label="Doctor" value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}>
              {doctors.map((d) => (
                <MenuItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Notes (optional)"
            fullWidth
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.patientId || !form.doctorId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Issue Token
        </Button>
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

const STAR_LINE = '- - - - - - - - - - - - - - - - - - - -';

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

function TokenSlipDocument({ token, clinicName, clinicAddress, clinicPhone }: {
  token: Token; clinicName: string; clinicAddress: string; clinicPhone: string;
}) {
  const date = new Date(token.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pr = token.prescription;
  return (
    <Document>
      <Page size={[226, pr ? 700 : 480]} style={ts.page} wrap={false}>
        <Text style={ts.shopName}>{clinicName || 'CLINIC'}</Text>
        {clinicAddress ? <Text style={ts.shopSub}>{clinicAddress}</Text> : null}
        {clinicPhone ? <Text style={ts.shopSub}>Tel: {clinicPhone}</Text> : null}
        <Text style={ts.stars}>{STAR_LINE}</Text>
        <Text style={ts.title}>PATIENT TOKEN SLIP</Text>
        <Text style={ts.stars}>{STAR_LINE}</Text>
        <View style={ts.tokenBox}>
          <Text style={ts.tokenLabel}>TOKEN NO.</Text>
          <Text style={ts.tokenNum}>{String(token.tokenNumber).padStart(3, '0')}</Text>
        </View>
        <Text style={ts.stars}>{STAR_LINE}</Text>
        <View style={ts.row}><Text style={ts.lbl}>Patient</Text><Text style={ts.val}>{token.patient.firstName} {token.patient.lastName}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Doctor</Text><Text style={ts.val}>Dr. {token.doctor.firstName} {token.doctor.lastName}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Date</Text><Text style={ts.val}>{date}</Text></View>
        <View style={ts.row}><Text style={ts.lbl}>Time</Text><Text style={ts.val}>{time}</Text></View>
        {token.notes ? <View style={ts.row}><Text style={ts.lbl}>Note</Text><Text style={ts.val}>{token.notes}</Text></View> : null}
        {pr && (
          <>
            <Text style={ts.stars}>{STAR_LINE}</Text>
            <Text style={[ts.title, { marginBottom: 4 }]}>PRESCRIPTION</Text>
            {pr.diagnosis ? <View style={ts.row}><Text style={ts.lbl}>Diagnosis</Text><Text style={ts.val}>{pr.diagnosis}</Text></View> : null}
            {pr.medicines.length > 0 && (
              <>
                <Text style={[ts.lbl, { marginTop: 4, marginBottom: 2 }]}>Medicines:</Text>
                {pr.medicines.map((m, i) => (
                  <View key={i} style={{ marginBottom: 3 }}>
                    <Text style={[ts.val, { fontWeight: 'bold' }]}>{i + 1}. {m.name}</Text>
                    <Text style={ts.lbl}>   {m.dosage} · {m.duration}{m.instructions ? ` · ${m.instructions}` : ''}</Text>
                  </View>
                ))}
              </>
            )}
            {pr.tests.length > 0 && (
              <>
                <Text style={[ts.lbl, { marginTop: 4, marginBottom: 2 }]}>Lab Tests:</Text>
                {pr.tests.map((t, i) => <Text key={i} style={ts.val}>  • {t}</Text>)}
              </>
            )}
            {pr.advice ? <><Text style={[ts.lbl, { marginTop: 4 }]}>Advice:</Text><Text style={ts.val}>{pr.advice}</Text></> : null}
          </>
        )}
        <Text style={ts.stars}>{STAR_LINE}</Text>
        <Text style={ts.footer}>Please wait for your token to be called.{`\n`}Thank you for your visit.</Text>
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
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Prescription — Token #{String(token.tokenNumber).padStart(3, '0')}
        <Typography variant="body2" color="text.secondary">
          {token.patient.firstName} {token.patient.lastName} · Dr. {token.doctor.firstName} {token.doctor.lastName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Diagnosis" fullWidth value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Medicines</Typography>
            <Stack spacing={1.5}>
              {medicines.map((m, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 1 }}>
                    <TextField size="small" label="Medicine" value={m.name} onChange={(e) => updateMed(i, 'name', e.target.value)} />
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
                disabled={!labTest.trim() || createLabOrderMutation.isPending}
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
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Save Prescription</Button>
      </DialogActions>
    </Dialog>
  );
}


export function TokenPrintPreview({ token, onClose }: { token: Token; onClose: () => void }) {
  const [clinic, setClinic] = useState<{ clinicName: string; clinicAddress: string; clinicPhone: string } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setClinic({
      clinicName: s.clinicName ?? '',
      clinicAddress: s.clinicAddress ?? '',
      clinicPhone: s.clinicPhone ?? '',
    }));
  }, []);

  useEffect(() => {
    if (!clinic) return;
    let url: string;
    void pdf(<TokenSlipDocument token={token} {...clinic} />).toBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [clinic, token]);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ p: 0, height: 560 }}>
        {blobUrl ? (
          <iframe src={blobUrl} width="100%" height="100%" style={{ border: 'none' }} />
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading...</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function TokensPage(): React.JSX.Element {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [date, setDate] = useState(todayStr());
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printToken, setPrintToken] = useState<Token | null>(null);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });

  const roleFiltered = isDoctor ? tokens.filter((t) => t.doctorId === user?.id) : tokens;
  const filtered = filterDoctor === 'ALL' ? roleFiltered : roleFiltered.filter((t) => t.doctorId === filterDoctor);

  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const inProgress = tokens.filter((t) => t.status === 'IN_PROGRESS').length;
  const done = tokens.filter((t) => t.status === 'DONE').length;

  const currentToken = filtered.find((t) => t.status === 'IN_PROGRESS') ?? filtered.find((t) => t.status === 'WAITING');

  return (
    <>
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: { sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Token Queue</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Daily patient queue management.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={date ? new Date(date) : null}
                onChange={(v) => setDate(v ? v.toISOString().slice(0, 10) : todayStr())}
                slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
              />
            </LocalizationProvider>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} sx={{ borderRadius: 2, fontWeight: 600 }} onClick={() => setDialogOpen(true)}>
              Issue Token
            </Button>
          </Stack>
        </Box>

        {/* Summary cards */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {[
            { label: 'Total',       value: tokens.length, color: theme.palette.text.primary },
            { label: 'Waiting',     value: waiting,       color: theme.palette.warning.main },
            { label: 'In Progress', value: inProgress,    color: theme.palette.primary.main },
            { label: 'Done',        value: done,          color: theme.palette.success.main },
          ].map((c) => (
            <Paper key={c.label} variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            </Paper>
          ))}
        </Box>

        {/* Current token highlight */}
        {currentToken && (
          <Paper
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>NOW SERVING</Typography>
              <Typography sx={{ fontSize: 52, fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>
                {String(currentToken.tokenNumber).padStart(3, '0')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700} fontSize={18}>
                {currentToken.patient.firstName} {currentToken.patient.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dr. {currentToken.doctor.firstName} {currentToken.doctor.lastName}
              </Typography>
              {currentToken.notes && (
                <Typography variant="caption" color="text.secondary">{currentToken.notes}</Typography>
              )}
            </Box>
            <Chip
              label={statusConfig[currentToken.status].label}
              color={statusConfig[currentToken.status].color}
              sx={{ fontWeight: 700 }}
            />
          </Paper>
        )}

        {!isDoctor && (
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Filter:</Typography>
            {[{ id: 'ALL', firstName: 'All', lastName: 'Doctors' }, ...doctors].map((d) => (
              <Chip
                key={d.id}
                label={d.id === 'ALL' ? 'All Doctors' : `Dr. ${d.firstName} ${d.lastName}`}
                onClick={() => setFilterDoctor(d.id)}
                color={filterDoctor === d.id ? 'primary' : 'default'}
                variant={filterDoctor === d.id ? 'filled' : 'outlined'}
                sx={{ borderRadius: 2 }}
              />
            ))}
          </Stack>
        )}

        {/* Queue list */}
        {isError && <Alert severity="error">Failed to load tokens.</Alert>}
        {isLoading ? (
          <Typography color="text.secondary">Loading queue...</Typography>
        ) : filtered.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
            <ConfirmationNumberOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No tokens for this date.</Typography>
          </Paper>
        ) : (
          <Stack spacing={1}>
            {filtered.map((token) => {
              const cfg = statusConfig[token.status];
              const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
              return (
                <Paper
                  key={token.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    opacity: isDone ? 0.55 : 1,
                    borderLeft: `4px solid`,
                    borderLeftColor: token.status === 'IN_PROGRESS'
                      ? 'primary.main'
                      : token.status === 'WAITING'
                      ? 'warning.main'
                      : token.status === 'DONE'
                      ? 'success.main'
                      : 'divider',
                  }}
                >
                  {/* Token number */}
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: alpha(cfg.color === 'default' ? theme.palette.action.active : theme.palette[cfg.color].main, 0.12),
                      color: cfg.color === 'default' ? 'text.secondary' : `${cfg.color}.main`,
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    {String(token.tokenNumber).padStart(3, '0')}
                  </Avatar>

                  {/* Info */}
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={700} fontSize={14}>
                      {token.patient.firstName} {token.patient.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Dr. {token.doctor.firstName} {token.doctor.lastName}
                      {token.notes ? ` · ${token.notes}` : ''}
                    </Typography>
                  </Box>

                  <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontWeight: 600, minWidth: 90 }} />

                  {/* Actions */}
                  <Stack direction="row" gap={0.5}>
                    <Tooltip title="Print Token">
                      <IconButton size="small" onClick={() => setPrintToken(token)}>
                        <PrintOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {token.status === 'WAITING' && (
                      <Tooltip title="Start">
                        <IconButton size="small" color="primary" onClick={() => statusMutation.mutate({ id: token.id, status: 'IN_PROGRESS' })}>
                          <PlayArrowOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {token.status === 'IN_PROGRESS' && (
                      <Tooltip title="Mark Done">
                        <IconButton size="small" color="success" onClick={() => statusMutation.mutate({ id: token.id, status: 'DONE' })}>
                          <CheckCircleOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(token.status === 'WAITING' || token.status === 'IN_PROGRESS') && (
                      <Tooltip title="Skip">
                        <IconButton size="small" onClick={() => statusMutation.mutate({ id: token.id, status: 'SKIPPED' })}>
                          <SkipNextOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {token.status === 'WAITING' && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(token.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>

      <IssueTokenDialog open={dialogOpen} onClose={() => setDialogOpen(false)} date={date} />
      {printToken && <TokenPrintPreview token={printToken} onClose={() => setPrintToken(null)} />}

    </>
  );
}
