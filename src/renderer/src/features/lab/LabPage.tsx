import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import type { LabOrder, LabOrderStatus } from '@/types/lab';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { LabReportPrint } from './LabReportPrint';
import { LabReportBuilderDialog } from './LabReportBuilderDialog';
import { LAB_TEST_OPTIONS } from './labTestCatalog';
import { labReportNumber } from './labReportNumber';
import { DoctorAvatar } from '@/components/DoctorAvatar';

const statusColor: Record<LabOrderStatus, 'warning' | 'primary' | 'success' | 'error'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export function LabPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const isLabTech = user?.role === 'lab_technician';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [builderOrder, setBuilderOrder] = useState<LabOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null);
  const [form, setForm] = useState({ patientId: '', test: '', notes: '' });

  const { data: orders = [], isLoading, isFetching, isError } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list(),
    refetchInterval: 15_000,
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
    meta: { toast: 'Lab order created', errorToast: 'Unable to create lab order.' },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      window.clinic.lab.updateStatus(id, status),
    onSuccess: invalidate,
    meta: { toast: 'Lab status updated' },
  });

  const filtered = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    const reportNo = labReportNumber(order.id).toLowerCase();
    const needle = q.replace(/[^a-z0-9]/g, '');
    const matchSearch =
      !q ||
      order.patientName.toLowerCase().includes(q) ||
      reportNo.includes(needle) ||
      reportNo.replace(/^lab/, '').includes(needle.replace(/^lab/, ''));
    const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const completed = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <>
      <TablePageShell
        title="Lab Orders"
        subtitle="Manage lab test orders and results."
        action={
          isLabTech && (
            <Button onClick={() => setDialogOpen(true)} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>New order</Button>
          )
        }
        toolbar={
          <>
            <SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search by patient or report no." sx={{ flex: 1, maxWidth: 280 }} />
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
        fetching={isFetching && !isLoading}
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>Test</TableCell>
            <TableCell>Report no.</TableCell>
            <TableCell>Ordered by</TableCell>
            <TableCell>Date & time</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRowsSkeleton cols={7} />
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No lab orders found.</TableCell></TableRow>
          ) : (
            paginated.map((order) => (
              <TableRow
                key={order.id}
                sx={{ ...tableSx.row, cursor: 'pointer' }}
                onClick={() => navigate(`/lab/${order.id}`)}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                      {order.patientName[0]}
                    </Avatar>
                    <Box>
                      <Typography fontSize={13.5} fontWeight={600}>{order.patientName}</Typography>
                      <Typography fontSize={11.5} color="text.secondary">
                        {order.patientPhone?.trim() || '—'}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={0.8}>
                    <BiotechOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    {order.test}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography fontSize={12.5} fontWeight={700} sx={{ fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: '0.02em' }}>
                    {labReportNumber(order.id)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <DoctorAvatar name={order.orderedByName} size={28} />
                    <Box>
                      <Typography fontSize={13}>{order.orderedByName}</Typography>
                      <Typography fontSize={11} color="text.secondary">Doctor</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(order.orderedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip color={statusColor[order.status]} label={order.status.replace('_', ' ')} size="small" sx={chipSx} />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" gap={0.5} justifyContent="flex-end">
                    <Tooltip title="View details">
                      <IconButton sx={actionBtnSx} onClick={() => navigate(`/lab/${order.id}`)}>
                        <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    {order.status === 'COMPLETED' && (
                      <Tooltip title="Print report"><IconButton sx={actionBtnSx} onClick={() => setPrintOrder(order)}><PrintOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    )}
                    {(isLabTech || isDoctor || isAdmin) && (order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') && (
                      <Tooltip title={order.status === 'COMPLETED' ? 'Open report' : 'Build report'}>
                        <Button
                          size="small"
                          color={order.status === 'IN_PROGRESS' ? 'success' : 'primary'}
                          variant={order.status === 'IN_PROGRESS' ? 'contained' : 'outlined'}
                          startIcon={<ScienceOutlinedIcon sx={{ fontSize: 16 }} />}
                          sx={{ borderRadius: 1.5, fontSize: 12, py: 0.25, px: 1.25 }}
                          onClick={() => setBuilderOrder(order)}
                        >
                          {order.status === 'IN_PROGRESS' ? 'Build report' : 'Open report'}
                        </Button>
                      </Tooltip>
                    )}
                    {isLabTech && order.status === 'PENDING' && (
                      <Button size="small" variant="outlined" loading={statusMutation.isPending} sx={{ borderRadius: 1.5, fontSize: 12, py: 0.25, px: 1.25 }} onClick={() => statusMutation.mutate({ id: order.id, status: 'IN_PROGRESS' })}>Start</Button>
                    )}

                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </TablePageShell>

      {/* New Order Dialog */}
      <Dialog fullWidth maxWidth="xs" onClose={() => setDialogOpen(false)} open={dialogOpen} PaperProps={dialogPaperProps}>
        <FormDialogTitle title="New Lab Order" subtitle="Create a lab test order for a patient." />
        <DialogContent sx={dialogContentSx}>
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
                {LAB_TEST_OPTIONS.map((test) => (
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
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)} disabled={createMutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton
            disabled={!form.patientId || !form.test}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create order
          </SubmitButton>
        </DialogActions>
      </Dialog>

      {builderOrder && (
        <LabReportBuilderDialog
          order={builderOrder}
          onClose={() => setBuilderOrder(null)}
          onSaved={() => {
            invalidate();
            setBuilderOrder(null);
          }}
        />
      )}

      {printOrder && <LabReportPrint order={printOrder} onClose={() => setPrintOrder(null)} />}
    </>
  );
}
