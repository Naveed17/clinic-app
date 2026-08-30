import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  Select,
  createFilterOptions,
  TablePagination,
} from '@mui/material';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps,
} from '@/components/DialogUI';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import { GenderRadioGroup } from '@/components/GenderRadioGroup';
import { ageToDateOfBirth, dateOfBirthToAge, type AgeUnit } from '@shared/patientAge';
import type { Invoice, InvoiceInput, InvoicePerson, InvoiceUpdateInput, Payment } from '@/types/invoice';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';
import { formatTableDate } from '@/utils/formatDate';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { useAuth } from '@/features/auth/AuthContext';
import { alpha, useTheme } from '@mui/material/styles';

const statusConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  ISSUED: { label: 'Issued', color: 'info' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'error' },
  VOID: { label: 'Void', color: 'error' },
};

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'OTHER'];

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const personLabel = (person: InvoicePerson) => [person.firstName, person.lastName].filter(Boolean).join(' ').trim();

/* ── Payment History Dialog ── */
function PaymentHistoryDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
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
          <Stack spacing={1.2} sx={{ p: 2 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : isError ? (
          <Alert severity="error" sx={{ m: 2 }}>Unable to load payment history.</Alert>
        ) : payments.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">No payments recorded.</Typography>
        ) : (
          <Stack divider={<Divider />}>
            {payments.map((p) => (
              <Box key={p.id} sx={{ px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight={700} fontSize={14} color={Number(p.amount) < 0 ? 'error.main' : undefined}>
                    {money(Number(p.amount))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.method.replace('_', ' ')} · {new Date(p.paidAt).toLocaleString()}
                  </Typography>
                  {(p.reference || p.notes) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {p.notes || `Ref: ${p.reference}`}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={Number(p.amount) < 0 ? 'Refund' : p.method.replace('_', ' ')}
                  size="small"
                  color={Number(p.amount) < 0 ? 'error' : 'default'}
                  sx={{ fontSize: 11 }}
                />
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
export function VoidDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => invoicesService.void(invoice.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      await qc.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      onClose();
    },
    meta: { toast: 'Invoice voided', errorToast: 'Failed to void invoice.' },
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

/* ── Delete Confirm Dialog ── */
export function DeleteInvoiceDialog({
  invoice,
  onClose,
  onDeleted,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDeleted?: () => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => invoicesService.delete(invoice.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      onDeleted?.();
    },
    meta: { toast: 'Invoice deleted', errorToast: 'Failed to delete invoice.' },
  });
  return (
    <ConfirmDialog
      open
      title="Delete invoice?"
      message={
        <>
          Permanently delete <strong>{invoice.invoiceNumber}</strong> for{' '}
          <strong>{personLabel(invoice.patient)}</strong>? Payments recorded on this invoice will also be removed. This cannot be undone.
        </>
      }
      confirmLabel="Delete"
      loading={mutation.isPending}
      error={mutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Failed to delete invoice.</Alert> : undefined}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}

/* ── Payment Dialog ── */
export function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const remaining = Number(invoice.total) - Number(invoice.amountPaid ?? 0);
  const form = useForm({ defaultValues: { amount: remaining, method: 'CASH', reference: '' } });
  const mutation = useMutation({
    mutationFn: (v: { amount: number; method: string; reference: string }) =>
      invoicesService.addPayment(invoice.id, v.amount, v.method, v.reference || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoice.id] });
      onClose();
    },
    meta: { toast: 'Payment recorded', errorToast: 'Failed to record payment.' },
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
              slotProps={{ htmlInput: { min: 0, step: 'any' } }}
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

/* ── Refund Dialog ── */
export function RefundDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const maxRefund = Math.max(0, Number(invoice.amountPaid ?? 0));
  const form = useForm({ defaultValues: { amount: 0, method: 'CASH', reason: '' } });
  const mutation = useMutation({
    mutationFn: (v: { amount: number; method: string; reason: string }) =>
      invoicesService.refund(invoice.id, v.amount, v.method, v.reason || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoice.id] });
      onClose();
    },
    meta: { toast: 'Refund recorded', errorToast: 'Failed to record refund.' },
  });
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title={`Refund — ${invoice.invoiceNumber}`} subtitle="Return money already collected on this invoice." />
      <Box component="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2}>
            {mutation.isError && (
              <Alert severity="error">{(mutation.error as Error)?.message || 'Failed to record refund.'}</Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Paid: <strong>{money(maxRefund)}</strong> — enter any amount up to this (partial refunds allowed).
            </Typography>
            <TextField label="Refund amount" type="number" fullWidth
              slotProps={{ htmlInput: { min: 0.01, max: maxRefund, step: 'any' } }}
              {...form.register('amount', { valueAsNumber: true, min: 0.01, max: maxRefund })} />
            <TextField select label="Refund method" fullWidth defaultValue="CASH"
              {...form.register('method')}>
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>
              ))}
            </TextField>
            <TextField label="Reason (optional)" fullWidth {...form.register('reason')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>
            Record Refund
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
  discount: z.number().min(0),
  notes: z.string(),
  items: z.array(itemSchema).min(1, 'Add at least one item.'),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = { patientId: '', discount: 0, notes: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] };

type InvoicePatientOption = InvoicePerson & { mrNumber?: string; inputLabel?: string };

const filterPatients = createFilterOptions<InvoicePatientOption>({
  stringify: (p) => `${p.firstName || ''} ${p.lastName || ''} ${p.mrNumber ?? ''} ${p.phone ?? ''}`,
});

const ADD_NEW = '__add_new__';

export function InvoiceDialog({
  open,
  onClose,
  onCreated,
  onUpdated,
  initialValues,
  tokenId,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoice: Invoice) => void;
  onUpdated?: (invoice: Invoice) => void;
  initialValues?: Partial<FormValues>;
  /** When set, invoice create links & dispenses the pharmacy Rx. */
  tokenId?: string | null;
  /** When set, edit an existing invoice instead of creating. */
  invoice?: Invoice | null;
}): React.JSX.Element {
  const isEdit = Boolean(invoice);
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const patients = useQuery({ queryKey: ['invoice-patients'], queryFn: invoicesService.patients });
  const [patientInput, setPatientInput] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickFirst, setQuickFirst] = useState('');
  const [quickLast, setQuickLast] = useState('');
  const [quickAge, setQuickAge] = useState('');
  const [quickAgeUnit, setQuickAgeUnit] = useState<AgeUnit>('years');
  const [quickGender, setQuickGender] = useState('');
  const [quickError, setQuickError] = useState('');

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      invoicesService.create({
        ...values,
        tokenId: tokenId || undefined,
      } as InvoiceInput),
    onSuccess: async (created) => {
      await client.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      onCreated?.(created as Invoice);
    },
    meta: { toast: 'Invoice created', errorToast: 'Unable to create the invoice.' },
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      invoicesService.update(invoice!.id, {
        discount: values.discount,
        notes: values.notes || null,
        items: values.items,
      } as InvoiceUpdateInput),
    onSuccess: async (updated) => {
      await client.invalidateQueries({ queryKey: ['invoices'] });
      await client.invalidateQueries({ queryKey: ['invoice', invoice!.id] });
      onClose();
      onUpdated?.(updated as Invoice);
    },
    meta: { toast: 'Invoice updated', errorToast: 'Unable to update the invoice.' },
  });

  const quickPatientMutation = useMutation({
    mutationFn: (input: { firstName: string; lastName: string; age?: string; ageUnit?: AgeUnit; gender?: string }) => {
      const num = input.age?.trim() ? parseFloat(input.age) : null;
      const unit = input.ageUnit || 'years';
      const dob = num != null && !Number.isNaN(num) ? ageToDateOfBirth(num, unit) : null;
      const ageYears = unit === 'years' ? (num != null ? Math.floor(num) : null) : (dob ? dateOfBirthToAge(dob) : null);

      return patientsService.create({
        firstName: input.firstName,
        lastName: input.lastName,
        age: ageYears,
        dateOfBirth: dob ? dob.toISOString() : null,
        gender: input.gender || null,
        phone: null,
        email: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        bloodGroup: null,
        allergies: null,
        chronicConditions: null,
      });
    },
    onSuccess: async (patient) => {
      await client.invalidateQueries({ queryKey: ['invoice-patients'] });
      await client.invalidateQueries({ queryKey: ['patients'] });
      form.setValue('patientId', patient.id);
      setQuickAddOpen(false);
      setQuickFirst('');
      setQuickLast('');
      setQuickAge('');
      setQuickAgeUnit('years');
      setQuickGender('');
      setQuickError('');
    },
    onError: (err) => setQuickError(err instanceof Error ? err.message : 'Could not add patient.'),
  });


  useEffect(() => {
    if (!open) return;
    if (invoice) {
      form.reset({
        patientId: invoice.patient.id,
        discount: Number(invoice.discount) || 0,
        notes: invoice.notes ?? '',
        items: invoice.items.length > 0
          ? invoice.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          }))
          : defaults.items,
      });
      return;
    }
    form.reset({
      ...defaults,
      ...initialValues,
      items:
        initialValues?.items && initialValues.items.length > 0
          ? initialValues.items
          : defaults.items,
    });
  }, [form, open, initialValues, invoice]);

  const patientOptions = (patients.data ?? []) as InvoicePatientOption[];
  const selectedPatientId = form.watch('patientId');
  const selectedPatient = patientOptions.find((p) => p.id === selectedPatientId) ?? null;
  const items = form.watch('items');
  const discount = form.watch('discount');
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const errors = form.formState.errors;
  const mutation = isEdit ? updateMutation : createMutation;

  const autocompleteOptions: InvoicePatientOption[] = [
    { id: ADD_NEW, firstName: '+ Add new patient…', lastName: '', inputLabel: '+ Add new patient…' },
    ...patientOptions,
  ];

  return (
    <>
      <Dialog fullWidth maxWidth="md" open={open} onClose={onClose} PaperProps={dialogPaperProps}>
        <FormDialogTitle
          title={isEdit ? `Edit Invoice — ${invoice?.invoiceNumber ?? ''}` : 'Create Invoice'}
          subtitle={isEdit ? 'Update medicines and adjust the bill total.' : 'Bill a patient for medicines and services.'}
        />
        <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} sx={dialogFormSx}>
          <DialogContent sx={dialogContentSx}>
            <Stack spacing={2.5}>
              {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : `Unable to ${isEdit ? 'update' : 'create'} the invoice.`}</Alert>}
              {isEdit ? (
                <TextField
                  fullWidth
                  label="Patient"
                  value={personLabel(invoice!.patient)}
                  disabled
                />
              ) : (
                <Autocomplete
                  options={autocompleteOptions}
                  filterOptions={(opts, state) => {
                    const filtered = filterPatients(opts.filter((o) => o.id !== ADD_NEW), state).slice(0, 50);
                    return [
                      opts.find((o) => o.id === ADD_NEW)!,
                      ...filtered,
                    ];
                  }}
                  getOptionLabel={(p) => p.inputLabel ?? personLabel(p)}
                  value={selectedPatient}
                  inputValue={patientInput}
                  onInputChange={(_, value, reason) => {
                    if (reason === 'input') setPatientInput(value);
                  }}
                  onChange={(_, option) => {
                    if (!option) {
                      form.setValue('patientId', '');
                      return;
                    }
                    if (option.id === ADD_NEW) {
                      const parts = patientInput.trim().split(/\s+/);
                      setQuickFirst(parts[0] ?? '');
                      setQuickLast(parts.slice(1).join(' ') || 'Patient');
                      setQuickAddOpen(true);
                      return;
                    }

                    form.setValue('patientId', option.id);
                    setPatientInput(personLabel(option));
                  }}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      {option.id === ADD_NEW ? (
                        <Typography fontSize={13.5} fontWeight={700} color="primary.main">{option.inputLabel}</Typography>
                      ) : (
                        <Box>
                          <Typography fontSize={13.5} fontWeight={600}>{personLabel(option)}</Typography>
                          <Typography fontSize={11.5} color="text.secondary">
                            {[option.mrNumber, option.phone].filter(Boolean).join(' · ') || '—'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Patient"
                      error={Boolean(errors.patientId)}
                      helperText={errors.patientId?.message ?? 'Type to search, or add a new patient'}
                    />
                  )}
                />
              )}
              <Typography fontWeight={700} variant="subtitle2">Items</Typography>
              {fields.fields.map((field, index) => {
                const qty = Number(form.watch(`items.${index}.quantity`)) || 0;
                const price = Number(form.watch(`items.${index}.unitPrice`)) || 0;
                const lineTotal = qty * price;
                return (
                  <Box key={field.id} sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 80px 95px 70px 40px' }, alignItems: 'center' }}>
                    <MedicineAutocomplete
                      label="Description / Medicine"
                      value={form.watch(`items.${index}.description`)}
                      onChange={(name, medPrice) => {
                        form.setValue(`items.${index}.description`, name);
                        form.setValue(`items.${index}.unitPrice`, medPrice);
                      }}
                    />
                    <TextField label="Qty" type="number" slotProps={{ htmlInput: { min: 1, step: 1 } }} {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    <TextField label="Unit price" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                    <Typography variant='subtitle1' fontWeight={700} textAlign="center" color="text.secondary">
                      {money(lineTotal)}
                    </Typography>
                    <IconButton aria-label="Remove item" disabled={fields.fields.length === 1} onClick={() => fields.remove(index)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                );
              })}
              <Button onClick={() => fields.append({ description: '', quantity: 1, unitPrice: 0 })} startIcon={<AddOutlinedIcon />} sx={{ alignSelf: 'flex-start' }}>
                Add item
              </Button>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Discount" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} {...form.register('discount', { valueAsNumber: true })} />
                <TextField label="Notes" {...form.register('notes')} />
              </Box>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'right' }}>
                <Typography color="text.secondary" variant="body2">Subtotal (medicines): {money(subtotal)}</Typography>
                <Typography color="text.secondary" variant="body2">Discount: {money(Number(discount) || 0)}</Typography>
                <Typography fontWeight={700} sx={{ mt: 0.5 }}>Total: {money(total)}</Typography>
              </Paper>
            </Stack>
          </DialogContent>
          <DialogActions sx={dialogActionsSx}>
            <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create invoice'}
            </SubmitButton>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
        <FormDialogTitle title="Add patient" subtitle="Quick-register a patient for this invoice." />
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2}>
            {quickError && <Alert severity="error">{quickError}</Alert>}
            <GenderRadioGroup value={quickGender} onChange={setQuickGender} optional />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <TextField label="First name" fullWidth value={quickFirst} onChange={(e) => setQuickFirst(e.target.value)} />
              <TextField label="Last name" fullWidth value={quickLast} onChange={(e) => setQuickLast(e.target.value)} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '110px 130px' }}>
              <TextField label="Age" type="number" value={quickAge} onChange={(e) => setQuickAge(e.target.value)} slotProps={{ htmlInput: { min: 0, max: 150 } }} />
              <TextField select label="Unit" value={quickAgeUnit} onChange={(e) => setQuickAgeUnit(e.target.value as AgeUnit)}>
                <MenuItem value="years">Years</MenuItem>
                <MenuItem value="months">Months</MenuItem>
                <MenuItem value="days">Days</MenuItem>
              </TextField>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setQuickAddOpen(false)} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton
            loading={quickPatientMutation.isPending}
            disabled={!quickFirst.trim() || !quickLast.trim()}
            onClick={() => quickPatientMutation.mutate({ firstName: quickFirst.trim(), lastName: quickLast.trim(), age: quickAge, ageUnit: quickAgeUnit, gender: quickGender })}
          >
            Add patient
          </SubmitButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ── Invoices Page ── */
export function InvoicesPage(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | undefined>();
  const [refundInvoice, setRefundInvoice] = useState<Invoice | undefined>();
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | undefined>();
  const [voidInvoice, setVoidInvoice] = useState<Invoice | undefined>();
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | undefined>();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeMenuInvoice, setActiveMenuInvoice] = useState<Invoice | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const handlePageChange = (newPage: number) => {
    setIsPageChanging(true);
    setPage(newPage);
    setTimeout(() => setIsPageChanging(false), 250);
  };
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, staleTime: 30_000 });

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

  const filtered = (invoices.data ?? []).filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      personLabel(inv.patient).toLowerCase().includes(q)
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
        toolbar={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
            <SearchField
              value={search}
              onChange={(v) => { setSearch(v); setPage(0); }}
              placeholder="Search invoice or patient..."
              sx={{ flex: 1, maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}
            />
            <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                sx={{
                  borderRadius: 0.5,
                  fontSize: 13.5,
                  fontWeight: 500,
                  bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 0.5 },
                }}
              >
                <MenuItem value="ALL">All statuses</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ISSUED">Issued</MenuItem>
                <MenuItem value="PARTIALLY_PAID">Partial</MenuItem>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="REFUNDED">Refunded</MenuItem>
                <MenuItem value="VOID">Void</MenuItem>
              </Select>
            </FormControl>
          </Box>
        }
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={handlePageChange} />
          ) : undefined
        }
        error={invoices.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load invoices.</Alert>}
        fetching={(invoices.isFetching && !invoices.isLoading) || isPageChanging}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Invoice</TableCell>
            <TableCell>Patient</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell align="right" sx={{ width: 64, pr: 2, whiteSpace: 'nowrap' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.isLoading ? (
            <TableRowsSkeleton cols={7} />
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No invoices created.</TableCell></TableRow>
          ) : (
            paginated.map((invoice) => {
              const cfg = statusConfig[invoice.status] ?? { label: invoice.status, color: 'default' as const };
              return (
                <TableRow
                  key={invoice.id}
                  sx={{ ...tableSx.row, cursor: 'pointer' }}
                  onClick={() => navigate(`/billing/${invoice.id}`)}
                >
                  <TableCell><Typography fontSize={13.5} fontWeight={600}>{invoice.invoiceNumber}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                        {invoice.patient.firstName[0]}{invoice.patient.lastName?.[0] ?? ''}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>{personLabel(invoice.patient)}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          {invoice.patient.phone?.trim() || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, whiteSpace: 'nowrap' }}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: 'info.main',
                          flexShrink: 0,
                        }}
                      >
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Typography fontSize={13} fontWeight={500} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatTableDate(invoice.createdAt)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Chip label={cfg.label} color={cfg.color} size="small" sx={chipSx} /></TableCell>
                  <TableCell align="right"><Typography fontSize={13.5} fontWeight={700}>{money(invoice.total)}</Typography></TableCell>
                  <TableCell align="right">{money(Number(invoice.amountPaid ?? 0))}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ width: 64, pr: 2 }}>
                    <Tooltip title="Actions" placement="left">
                      <IconButton
                        size="small"
                        sx={{
                          ...actionBtnSx,
                          border: '1px solid',
                          borderColor: activeMenuInvoice?.id === invoice.id ? 'primary.main' : 'divider',
                          bgcolor: activeMenuInvoice?.id === invoice.id ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), borderColor: 'primary.main' },
                        }}
                        onClick={(e) => {
                          setMenuAnchor(e.currentTarget);
                          setActiveMenuInvoice(invoice);
                        }}
                      >
                        <MoreVertOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TablePageShell>

      {/* Floating Action Popover (Right to Left) */}
      <Popover
        open={Boolean(menuAnchor && activeMenuInvoice)}
        anchorEl={menuAnchor}
        onClose={() => { setMenuAnchor(null); setActiveMenuInvoice(null); }}
        anchorOrigin={{ vertical: 'center', horizontal: -8 }}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 'max-content',
              maxWidth: 'none',
              borderRadius: '8px',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? '0 10px 30px rgba(0,0,0,0.6)'
                : '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              borderLeft: '4px solid',
              borderLeftColor: 'primary.main',
              p: 0.5,
              px: 0.75,
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'background.paper',
              position: 'relative',
              overflow: 'visible',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                right: -5,
                transform: 'translateY(-50%) rotate(45deg)',
                width: 8,
                height: 8,
                bgcolor: 'background.paper',
                borderTop: '1px solid',
                borderRight: '1px solid',
                borderColor: 'divider',
                pointerEvents: 'none',
              },
            },
          },
        }}
      >
        {activeMenuInvoice && (() => {
          const invoice = activeMenuInvoice;
          const isVoid = invoice.status === 'VOID';
          const paid = Number(invoice.amountPaid ?? 0);
          const total = Number(invoice.total);
          const balance = Math.max(0, total - paid);
          const canPay = !isAdmin && !isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && balance > 0;
          const canRefund = !isAdmin && !isVoid && paid > 0;
          const close = () => { setMenuAnchor(null); setActiveMenuInvoice(null); };

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="View details" arrow placement="top">
                <IconButton sx={actionBtnSx} onClick={() => { close(); navigate(`/billing/${invoice.id}`); }}>
                  <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>

              {!isAdmin && canPay && (
                <Tooltip title="Record Payment" arrow placement="top">
                  <IconButton sx={{ ...actionBtnSx, color: 'primary.main' }} onClick={() => { close(); setPaymentInvoice(invoice); }}>
                    <PaymentOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}

              {canRefund && (
                <Tooltip title="Refund" arrow placement="top">
                  <IconButton sx={actionBtnSx} onClick={() => { close(); setRefundInvoice(invoice); }}>
                    <UndoOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Payment History" arrow placement="top">
                <IconButton sx={actionBtnSx} onClick={() => { close(); setHistoryInvoice(invoice); }}>
                  <HistoryOutlinedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Print invoice" arrow placement="top">
                <span>
                  <IconButton
                    sx={actionBtnSx}
                    loading={printingId === invoice.id}
                    disabled={printingId === invoice.id}
                    onClick={() => { close(); void handlePrintInvoice(invoice); }}
                  >
                    <PrintOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </span>
              </Tooltip>

              {!isAdmin && invoice.status !== 'VOID' && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && (
                <Tooltip title="Void Invoice" arrow placement="top">
                  <IconButton sx={{ ...actionBtnSx, color: 'warning.main' }} onClick={() => { close(); setVoidInvoice(invoice); }}>
                    <BlockOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}

              {!isAdmin && (
                <>
                  <Divider orientation="vertical" flexItem sx={{ my: 0.5, mx: 0.5 }} />
                  <Tooltip title="Delete invoice" arrow placement="top">
                    <IconButton
                      sx={{
                        ...actionBtnSx,
                        color: 'error.main',
                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                      }}
                      onClick={() => { close(); setDeleteInvoice(invoice); }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          );
        })()}
      </Popover>
      <InvoiceDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(invoice) => {
          void handlePrintInvoice(invoice);
        }}
      />
      {paymentInvoice && <PaymentDialog invoice={paymentInvoice} onClose={() => setPaymentInvoice(undefined)} />}
      {refundInvoice && <RefundDialog invoice={refundInvoice} onClose={() => setRefundInvoice(undefined)} />}
      {historyInvoice && <PaymentHistoryDialog invoice={historyInvoice} onClose={() => setHistoryInvoice(undefined)} />}
      {voidInvoice && <VoidDialog invoice={voidInvoice} onClose={() => setVoidInvoice(undefined)} />}
      {deleteInvoice && <DeleteInvoiceDialog invoice={deleteInvoice} onClose={() => setDeleteInvoice(undefined)} />}
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
