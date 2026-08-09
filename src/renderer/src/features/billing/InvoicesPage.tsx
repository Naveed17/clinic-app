import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
} from '@mui/material';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps,
} from '@/components/DialogUI';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { invoicesService } from '@/services/invoices.service';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import type { Invoice, InvoiceInput, InvoicePerson, Payment } from '@/types/invoice';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';

const statusConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  DRAFT:          { label: 'Draft',    color: 'default' },
  ISSUED:         { label: 'Issued',   color: 'info' },
  PARTIALLY_PAID: { label: 'Partial',  color: 'warning' },
  PAID:           { label: 'Paid',     color: 'success' },
  VOID:           { label: 'Void',     color: 'error' },
};

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'OTHER'];

const money = (value: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(Number(value))}`;
const personLabel = (person: InvoicePerson) => `${person.firstName} ${person.lastName}`;

/* ── Payment History Dialog ── */
function PaymentHistoryDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['invoice-payments', invoice.id],
    queryFn: () => window.clinic.invoices.payments(invoice.id),
  });
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title={`Payment History — ${invoice.invoiceNumber}`} subtitle="All payments recorded for this invoice." />
      <DialogContent sx={{ ...dialogContentSx, p: 0, px: 0, py: 0 }}>
        <Box sx={{ px: 3, py: 1.5, bgcolor: 'background.default', display: 'flex', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">Total: <strong>{money(invoice.total)}</strong></Typography>
          <Typography variant="body2" color="text.secondary">Paid: <strong>{money(Number(invoice.amountPaid))}</strong></Typography>
          <Typography variant="body2" color="text.secondary">Remaining: <strong>{money(invoice.total - Number(invoice.amountPaid))}</strong></Typography>
        </Box>
        <Divider />
        {isLoading ? (
          <Typography sx={{ p: 3 }} color="text.secondary">Loading...</Typography>
        ) : payments.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">No payments recorded.</Typography>
        ) : (
          <Stack divider={<Divider />}>
            {payments.map((p) => (
              <Box key={p.id} sx={{ px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight={700} fontSize={14}>{money(Number(p.amount))}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.method.replace('_', ' ')} · {new Date(p.paidAt).toLocaleString()}
                  </Typography>
                  {p.reference && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Ref: {p.reference}</Typography>}
                </Box>
                <Chip label={p.method.replace('_', ' ')} size="small" sx={{ fontSize: 11 }} />
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Void Confirm Dialog ── */
function VoidDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => window.clinic.invoices.void(invoice.id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['invoices'] }); onClose(); },
  });
  return (
    <ConfirmDialog
      open
      title="Void invoice?"
      message={<>Void <strong>{invoice.invoiceNumber}</strong>?</>}
      confirmLabel="Void Invoice"
      loading={mutation.isPending}
      error={mutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Failed to void invoice.</Alert> : undefined}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}

/* ── Payment Dialog ── */
function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const remaining = Number(invoice.total) - Number(invoice.amountPaid ?? 0);
  const form = useForm({ defaultValues: { amount: remaining, method: 'CASH', reference: '' } });
  const mutation = useMutation({
    mutationFn: (v: { amount: number; method: string; reference: string }) =>
      invoicesService.addPayment(invoice.id, v.amount, v.method, v.reference || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    },
  });
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title={`Record Payment — ${invoice.invoiceNumber}`} subtitle="Add a payment against this invoice." />
      <Box component="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2}>
            {mutation.isError && <Alert severity="error">Failed to record payment.</Alert>}
            <Typography variant="body2" color="text.secondary">
              Total: <strong>{money(Number(invoice.total))}</strong> &nbsp;|&nbsp;
              Paid: <strong>{money(Number(invoice.amountPaid ?? 0))}</strong> &nbsp;|&nbsp;
              Remaining: <strong>{money(remaining)}</strong>
            </Typography>
            <TextField label="Amount" type="number" fullWidth
              {...form.register('amount', { valueAsNumber: true })} />
            <TextField select label="Payment Method" fullWidth defaultValue="CASH"
              {...form.register('method')}>
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>
              ))}
            </TextField>
            <TextField label="Reference (optional)" fullWidth {...form.register('reference')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>
            Record Payment
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/* ── Create Invoice Dialog ── */
const itemSchema = z.object({
  description: z.string().trim().min(1, 'Required'),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});
const schema = z.object({
  patientId: z.string().min(1, 'Select a patient.'),
  drFee: z.number().min(0),
  discount: z.number().min(0),
  notes: z.string(),
  items: z.array(itemSchema).min(1, 'Add at least one item.'),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = { patientId: '', drFee: 0, discount: 0, notes: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] };

export function InvoiceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoice: Invoice) => void;
}): React.JSX.Element {
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const patients = useQuery({ queryKey: ['invoice-patients'], queryFn: invoicesService.patients });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => invoicesService.create(values as InvoiceInput),
    onSuccess: async (invoice) => {
      await client.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      onCreated?.(invoice as Invoice);
    },
  });
  useEffect(() => { if (open) form.reset(defaults); }, [form, open]);
  const items = form.watch('items');
  const discount = form.watch('discount');
  const drFee = form.watch('drFee');
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal + (Number(drFee) || 0) - (Number(discount) || 0));
  const errors = form.formState.errors;

  return (
    <>
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Create Invoice" subtitle="Bill a patient for medicines and services." />
      <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.5}>
            {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : 'Unable to create the invoice.'}</Alert>}
            <TextField select fullWidth label="Patient" error={Boolean(errors.patientId)} helperText={errors.patientId?.message} {...form.register('patientId')}>
              {(patients.data ?? []).map((patient) => (
                <MenuItem key={patient.id} value={patient.id}>{personLabel(patient)}</MenuItem>
              ))}
            </TextField>
            <Typography fontWeight={700} variant="subtitle2">Items</Typography>
            {fields.fields.map((field, index) => (
              <Box key={field.id} sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 90px 120px 40px' } }}>
                <MedicineAutocomplete
                  label="Description / Medicine"
                  value={form.watch(`items.${index}.description`)}
                  onChange={(name, price) => {
                    form.setValue(`items.${index}.description`, name);
                    form.setValue(`items.${index}.unitPrice`, price);
                  }}
                />
                <TextField label="Qty" type="number" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
                <TextField label="Unit price" type="number" {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                <IconButton aria-label="Remove item" disabled={fields.fields.length === 1} onClick={() => fields.remove(index)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            ))}
            <Button onClick={() => fields.append({ description: '', quantity: 1, unitPrice: 0 })} startIcon={<AddOutlinedIcon />} sx={{ alignSelf: 'flex-start' }}>
              Add item
            </Button>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              <TextField label="Doctor Fee" type="number" {...form.register('drFee', { valueAsNumber: true })} />
              <TextField label="Discount" type="number" {...form.register('discount', { valueAsNumber: true })} />
              <TextField label="Notes" {...form.register('notes')} />
            </Box>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'right' }}>
              <Typography color="text.secondary" variant="body2">Subtotal (medicines): {money(subtotal)}</Typography>
              <Typography color="text.secondary" variant="body2">Doctor Fee: {money(Number(drFee) || 0)}</Typography>
              <Typography color="text.secondary" variant="body2">Discount: {money(Number(discount) || 0)}</Typography>
              <Typography fontWeight={700} sx={{ mt: 0.5 }}>Total: {money(total)}</Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>Create invoice</SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
    </>
  );
}

/* ── Invoices Page ── */
export function InvoicesPage(): React.JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | undefined>();
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | undefined>();
  const [voidInvoice, setVoidInvoice] = useState<Invoice | undefined>();
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list });

  async function handlePrintInvoice(invoice: Invoice): Promise<void> {
    setPrintingId(invoice.id);
    setPrintError(null);
    try {
      await printInvoiceReceipt(invoice);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrintingId(null);
    }
  }

  async function openPaymentHistory(invoice: Invoice): Promise<void> {
    setLoadingHistoryId(invoice.id);
    try {
      await qc.fetchQuery({
        queryKey: ['invoice-payments', invoice.id],
        queryFn: () => window.clinic.invoices.payments(invoice.id),
      });
      setHistoryInvoice(invoice);
    } finally {
      setLoadingHistoryId(null);
    }
  }

  const filtered = (invoices.data ?? []).filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <TablePageShell
        title="Invoices"
        subtitle="Create itemized invoices and track payments."
        action={
          !isAdmin && <Button onClick={() => setOpen(true)} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>Create invoice</Button>
        }
        toolbar={<SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search invoice or patient..." sx={{ flex: 1, maxWidth: 360 }} />}
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
        error={invoices.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load invoices.</Alert>}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Invoice</TableCell>
            <TableCell>Patient</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.isLoading ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Loading invoices...</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No invoices created.</TableCell></TableRow>
          ) : (
            paginated.map((invoice) => {
              const cfg = statusConfig[invoice.status] ?? { label: invoice.status, color: 'default' as const };
              const isPaid = invoice.status === 'PAID' || invoice.status === 'VOID';
              return (
                <TableRow key={invoice.id} sx={tableSx.row}>
                  <TableCell><Typography fontSize={13.5} fontWeight={600}>{invoice.invoiceNumber}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                        {invoice.patient.firstName[0]}{invoice.patient.lastName[0]}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(invoice.patient)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          {invoice.invoiceNumber} · {new Date(invoice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Chip label={cfg.label} color={cfg.color} size="small" sx={chipSx} /></TableCell>
                  <TableCell align="right"><Typography fontSize={13.5} fontWeight={700}>{money(invoice.total)}</Typography></TableCell>
                  <TableCell align="right">{money(Number(invoice.amountPaid ?? 0))}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                      {!isAdmin && !isPaid && (
                        <Tooltip title="Record Payment">
                          <IconButton sx={actionBtnSx} onClick={() => setPaymentInvoice(invoice)}><PaymentOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Payment History">
                        <span>
                          <IconButton
                            sx={actionBtnSx}
                            loading={loadingHistoryId === invoice.id}
                            disabled={loadingHistoryId === invoice.id}
                            onClick={() => void openPaymentHistory(invoice)}
                          >
                            <HistoryOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Print invoice">
                        <span>
                          <IconButton
                            sx={actionBtnSx}
                            loading={printingId === invoice.id}
                            disabled={printingId === invoice.id}
                            onClick={() => void handlePrintInvoice(invoice)}
                          >
                            <PrintOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {!isAdmin && invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
                        <Tooltip title="Void Invoice">
                          <IconButton sx={actionBtnSx} onClick={() => setVoidInvoice(invoice)}><BlockOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TablePageShell>
      <InvoiceDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(invoice) => {
          void handlePrintInvoice(invoice);
        }}
      />
      {paymentInvoice && <PaymentDialog invoice={paymentInvoice} onClose={() => setPaymentInvoice(undefined)} />}
      {historyInvoice && <PaymentHistoryDialog invoice={historyInvoice} onClose={() => setHistoryInvoice(undefined)} />}
      {voidInvoice && <VoidDialog invoice={voidInvoice} onClose={() => setVoidInvoice(undefined)} />}
      <Snackbar
        open={Boolean(printError)}
        autoHideDuration={5000}
        onClose={() => setPrintError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setPrintError(null)} variant="filled">
          {printError}
        </Alert>
      </Snackbar>
    </>
  );
}
