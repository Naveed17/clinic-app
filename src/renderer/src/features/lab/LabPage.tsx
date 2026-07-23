import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import type { LabOrder, LabOrderStatus } from '@/types/lab';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { LabReportPrint } from './LabReportPrint';

const LAB_TESTS = [
  'CBC', 'Blood Sugar (FBS)', 'Blood Sugar (RBS)', 'HbA1c', 'Lipid Profile',
  'LFTs', 'KFTs', 'Urine R/E', 'Urine C/S', 'Thyroid Profile (TSH)',
  'Thyroid Profile (T3/T4)', 'ECG', 'X-Ray', 'Ultrasound', 'COVID-19 PCR',
  'Hepatitis B', 'Hepatitis C', 'Blood Group', 'ESR', 'CRP',
];

const statusColor: Record<LabOrderStatus, 'warning' | 'primary' | 'success' | 'error'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export function LabPage(): React.JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState<LabOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null);
  const [resultText, setResultText] = useState('');
  const [form, setForm] = useState({ patientId: '', test: '', notes: '' });

  const { data: orders = [], isLoading, isError } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list(),
  });

  const { data: patients = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ['lab-patients'],
    queryFn: () => window.clinic.lab.patients(),
    enabled: dialogOpen,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lab-orders'] });

  const createMutation = useMutation({
    mutationFn: () =>
      window.clinic.lab.create({
        patientId: form.patientId,
        orderedById: user!.id,
        test: form.test,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ patientId: '', test: '', notes: '' });
      setDialogOpen(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      window.clinic.lab.updateStatus(id, status),
    onSuccess: invalidate,
  });

  const resultMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: string }) =>
      window.clinic.lab.saveResult(id, result),
    onSuccess: () => {
      invalidate();
      setResultDialog(null);
      setResultText('');
    },
  });

  const { data: labReports = [], refetch: refetchReports } = useQuery<{ id: string; name: string; filePath: string; uploadedAt: string }[]>({
    queryKey: ['lab-reports', resultDialog?.id],
    queryFn: () => window.clinic.docs.lab.list(resultDialog!.id),
    enabled: Boolean(resultDialog),
  });
  const uploadReportMutation = useMutation({
    mutationFn: () => window.clinic.docs.lab.upload(resultDialog!.id),
    onSuccess: () => refetchReports(),
  });
  const deleteReportMutation = useMutation({
    mutationFn: (id: string) => window.clinic.docs.lab.delete(id),
    onSuccess: () => refetchReports(),
  });

  const filtered = orders.filter((order) => {
    const matchSearch =
      order.patientName.toLowerCase().includes(search.toLowerCase()) ||
      order.test.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const completed = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <>
      <TablePageShell
        title="Lab Orders"
        subtitle="Manage lab test orders and results."
        action={
          (isDoctor || isAdmin || user?.role === 'receptionist') && (
            <Button onClick={() => setDialogOpen(true)} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>New order</Button>
          )
        }
        toolbar={
          <>
            <SearchField value={search} onChange={setSearch} placeholder="Search by patient or test" sx={{ flex: 1, maxWidth: 320 }} />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={{ borderRadius: 2, fontSize: 13.5 }}>
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" gap={1} sx={{ ml: 'auto' }}>
              {[
                { label: `${pending} Pending`, color: 'warning' as const },
                { label: `${inProgress} In progress`, color: 'primary' as const },
                { label: `${completed} Completed`, color: 'success' as const },
              ].map((item) => (
                <Chip key={item.label} label={item.label} color={item.color} variant="outlined" sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 26, '& .MuiChip-label': { px: 1 } }} />
              ))}
            </Stack>
          </>
        }
        error={isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Failed to load lab orders.</Alert>}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>Test</TableCell>
            <TableCell>Ordered by</TableCell>
            <TableCell>Date & time</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} /></TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No lab orders found.</TableCell></TableRow>
          ) : (
            filtered.map((order) => (
              <TableRow key={order.id} sx={tableSx.row}>
                <TableCell><Typography fontSize={13.5} fontWeight={600}>{order.patientName}</Typography></TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={0.8}>
                    <BiotechOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    {order.test}
                  </Stack>
                </TableCell>
                <TableCell>{order.orderedByName}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(order.orderedAt).toLocaleString()}</TableCell>
                <TableCell sx={{ color: order.result ? 'text.primary' : 'text.disabled', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.result || '—'}
                </TableCell>
                <TableCell>
                  <Chip color={statusColor[order.status]} label={order.status.replace('_', ' ')} size="small" sx={chipSx} />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" gap={0.5} justifyContent="flex-end">
                    {order.status === 'COMPLETED' && (
                      <Tooltip title="Print report"><IconButton sx={actionBtnSx} onClick={() => setPrintOrder(order)}><PrintOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    )}
                    {order.status === 'PENDING' && (
                      <Button size="small" variant="outlined" sx={{ borderRadius: 1.5, fontSize: 12, py: 0.25, px: 1.25 }} onClick={() => statusMutation.mutate({ id: order.id, status: 'IN_PROGRESS' })}>Start</Button>
                    )}
                    {order.status === 'IN_PROGRESS' && (
                      <Button size="small" color="success" variant="contained" sx={{ borderRadius: 1.5, fontSize: 12, py: 0.25, px: 1.25 }} onClick={() => { setResultDialog(order); setResultText(order.result ?? ''); }}>Add result</Button>
                    )}
                    {(isDoctor || isAdmin) && order.status === 'PENDING' && (
                      <Button size="small" color="error" variant="outlined" sx={{ borderRadius: 1.5, fontSize: 12, py: 0.25, px: 1.25 }} onClick={() => statusMutation.mutate({ id: order.id, status: 'CANCELLED' })}>Cancel</Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </TablePageShell>

      {/* New Order Dialog */}
      <Dialog fullWidth maxWidth="xs" onClose={() => setDialogOpen(false)} open={dialogOpen}>
        <DialogTitle>New Lab Order</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Patient</InputLabel>
              <Select
                label="Patient"
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                value={form.patientId}
              >
                {patients.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Test</InputLabel>
              <Select
                label="Test"
                onChange={(e) => setForm((f) => ({ ...f, test: e.target.value }))}
                value={form.test}
              >
                {LAB_TESTS.map((test) => (
                  <MenuItem key={test} value={test}>{test}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Notes (optional)"
              multiline
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              value={form.notes}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.patientId || !form.test || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            variant="contained"
          >
            Create order
          </Button>
        </DialogActions>
      </Dialog>

      {Boolean(resultDialog) && <Dialog fullWidth maxWidth="sm" onClose={() => setResultDialog(null)} open={Boolean(resultDialog)}>
        <DialogTitle>Add Result — {resultDialog?.test}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Patient: <strong>{resultDialog?.patientName}</strong>
            </Typography>
            <TextField
              fullWidth
              label="Result"
              multiline
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Enter test result"
              rows={3}
              value={resultText}
            />
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Attachments</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={uploadReportMutation.isPending ? <CircularProgress size={14} /> : <AttachFileOutlinedIcon />}
                disabled={uploadReportMutation.isPending}
                onClick={() => uploadReportMutation.mutate()}
              >
                Attach file
              </Button>
            </Box>
            {labReports.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No attachments.</Typography>
            ) : (
              <List dense disablePadding>
                {labReports.map((r) => (
                  <ListItem
                    key={r.id}
                    secondaryAction={
                      <Stack direction="row" gap={0.5}>
                        <Tooltip title="Open">
                          <IconButton size="small" onClick={() => window.clinic.docs.lab.open(r.id)}>
                            <FolderOpenOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => deleteReportMutation.mutate(r.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <ListItemText primary={r.name} secondary={new Date(r.uploadedAt).toLocaleDateString()} />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setResultDialog(null)}>Cancel</Button>
          <Button
            color="success"
            disabled={!resultText || resultMutation.isPending}
            onClick={() => resultMutation.mutate({ id: resultDialog!.id, result: resultText })}
            variant="contained"
          >
            Save and complete
          </Button>
        </DialogActions>
      </Dialog>}

      {printOrder && <LabReportPrint order={printOrder} onClose={() => setPrintOrder(null)} />}
    </>
  );
}
