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
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { invoicesService } from '@/services/invoices.service';
import type { Invoice, InvoiceInput, InvoicePerson, Payment } from '@/types/invoice';
import { InvoicePrintPreview } from './InvoicePrintPreview';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';

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
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>Payment History — {invoice.invoiceNumber}</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
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
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
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
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>Void Invoice?</DialogTitle>
      <DialogContent>
        <Typography>Void <strong>{invoice.invoiceNumber}</strong>? This cannot be undone.</Typography>
        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>Failed to void invoice.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Void Invoice</Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>Record Payment — {invoice.invoiceNumber}</DialogTitle>
      <Box component="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <DialogContent>
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
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Record Payment
          </Button>
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
  discount: z.number().min(0),
  notes: z.string(),
  items: z.array(itemSchema).min(1, 'Add at least one item.'),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = { patientId: '', discount: 0, notes: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] };

function InvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const patients = useQuery({ queryKey: ['invoice-patients'], queryFn: invoicesService.patients });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => invoicesService.create(values as InvoiceInput),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['invoices'] }); onClose(); },
  });
  useEffect(() => { if (open) form.reset(defaults); }, [form, open]);
  const items = form.watch('items');
  const discount = form.watch('discount');
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const errors = form.formState.errors;
  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle>Create invoice</DialogTitle>
      <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <DialogContent>
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
                <TextField label="Description" {...form.register(`items.${index}.description`)} />
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
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Discount" type="number" {...form.register('discount', { valueAsNumber: true })} />
              <TextField label="Notes" {...form.register('notes')} />
            </Box>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'right' }}>
              <Typography color="text.secondary" variant="body2">Subtotal: {money(subtotal)}</Typography>
              <Typography color="text.secondary" variant="body2">Discount: {money(Number(discount) || 0)}</Typography>
              <Typography fontWeight={700} sx={{ mt: 0.5 }}>Total: {money(total)}</Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} type="submit" variant="contained">Create invoice</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/* ── Invoices Page ── */
export function InvoicesPage(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | undefined>();
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | undefined>();
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | undefined>();
  const [voidInvoice, setVoidInvoice] = useState<Invoice | undefined>();
  const [search, setSearch] = useState('');
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list });

  const filtered = (invoices.data ?? []).filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <TablePageShell
        title="Invoices"
        subtitle="Create itemized invoices and track payments."
        action={
          <Button onClick={() => setOpen(true)} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>Create invoice</Button>
        }
        toolbar={<SearchField value={search} onChange={setSearch} placeholder="Search invoice or patient..." sx={{ flex: 1, maxWidth: 360 }} />}
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
            filtered.map((invoice) => {
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
                      {!isPaid && (
                        <Tooltip title="Record Payment">
                          <IconButton sx={actionBtnSx} onClick={() => setPaymentInvoice(invoice)}><PaymentOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Payment History">
                        <IconButton sx={actionBtnSx} onClick={() => setHistoryInvoice(invoice)}><HistoryOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Print invoice">
                        <IconButton sx={actionBtnSx} onClick={() => setPreviewInvoice(invoice)}><PrintOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
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
      <InvoiceDialog open={open} onClose={() => setOpen(false)} />
      {previewInvoice && <InvoicePrintPreview invoice={previewInvoice} onClose={() => setPreviewInvoice(undefined)} />}
      {paymentInvoice && <PaymentDialog invoice={paymentInvoice} onClose={() => setPaymentInvoice(undefined)} />}
      {historyInvoice && <PaymentHistoryDialog invoice={historyInvoice} onClose={() => setHistoryInvoice(undefined)} />}
      {voidInvoice && <VoidDialog invoice={voidInvoice} onClose={() => setVoidInvoice(undefined)} />}
    </>
  );
}
