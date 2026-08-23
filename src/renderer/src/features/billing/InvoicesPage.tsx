import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Skeleton,
  Spinner,
  TableCellLayout,
  Text,
  Tooltip,
  createTableColumn,
  makeStyles,
  tokens,
  type BadgeProps,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import {
  Add24Regular,
  ArrowUndo24Regular,
  Delete24Regular,
  Eye24Regular,
  History24Regular,
  Payment24Regular,
  Print24Regular,
  Prohibited24Regular,
} from '@fluentui/react-icons';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoicesService } from '@/services/invoices.service';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import type { Invoice, InvoiceInput, InvoicePerson, Payment } from '@/types/invoice';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';
import {
  actionBtnStyle,
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog, FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { useAuth } from '@/features/auth/AuthContext';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<string, { label: string; color: StatusColor }> = {
  DRAFT: { label: 'Draft', color: 'subtle' },
  ISSUED: { label: 'Issued', color: 'informative' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'danger' },
  VOID: { label: 'Void', color: 'danger' },
};

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'OTHER'];

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const personLabel = (person: InvoicePerson) => `${person.firstName} ${person.lastName}`;

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  surfaceMd: {
    maxWidth: '720px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionsBar: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  summaryBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  paymentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  personMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  name: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  muted: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalXXS,
    justifyContent: 'flex-end',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flex: 1,
    minWidth: 0,
  },
  statusFilter: {
    minWidth: '150px',
    flexShrink: 0,
  },
  errorBar: {
    marginLeft: tokens.spacingHorizontalL,
    marginRight: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalS,
  },
  deleteError: {
    marginTop: tokens.spacingVerticalM,
  },
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  itemRow: {
    display: 'grid',
    gap: tokens.spacingHorizontalS,
    gridTemplateColumns: 'minmax(0, 1fr) 90px 120px 40px',
    alignItems: 'end',
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr 1fr',
  },
  totals: {
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'right',
  },
  printError: {
    position: 'fixed',
    bottom: tokens.spacingVerticalXXL,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    maxWidth: '420px',
  },
  skeletonStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
  },
  emptyPad: {
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground2,
  },
});

/* ── Payment History Dialog ── */
function PaymentHistoryDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['invoice-payments', invoice.id],
    queryFn: () => window.clinic.invoices.payments(invoice.id),
  });
  return (
    <Dialog open onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={`Payment History — ${invoice.invoiceNumber}`}
          subtitle="All payments recorded for this invoice."
        />
        <div className={styles.form}>
          <DialogBody>
            <DialogContent className={styles.body} style={{ padding: 0 }}>
              <div className={styles.summaryBar}>
                <Text size={200}>
                  Total: <strong>{money(invoice.total)}</strong>
                </Text>
                <Text size={200}>
                  Paid: <strong>{money(Number(invoice.amountPaid))}</strong>
                </Text>
                <Text size={200}>
                  Remaining: <strong>{money(invoice.total - Number(invoice.amountPaid))}</strong>
                </Text>
              </div>
              <Divider />
              {isLoading ? (
                <div className={styles.skeletonStack}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} appearance="opaque" style={{ height: 48 }} />
                  ))}
                </div>
              ) : isError ? (
                <MessageBar intent="error" style={{ margin: tokens.spacingHorizontalL }}>
                  <MessageBarBody>Unable to load payment history.</MessageBarBody>
                </MessageBar>
              ) : payments.length === 0 ? (
                <Text className={styles.emptyPad}>No payments recorded.</Text>
              ) : (
                payments.map((p, idx) => (
                  <div key={p.id}>
                    {idx > 0 ? <Divider /> : null}
                    <div className={styles.paymentRow}>
                      <div>
                        <Text
                          weight="bold"
                          size={300}
                          style={
                            Number(p.amount) < 0
                              ? { color: tokens.colorPaletteRedForeground1 }
                              : undefined
                          }
                        >
                          {money(Number(p.amount))}
                        </Text>
                        <Text className={styles.muted} style={{ display: 'block' }}>
                          {p.method.replace('_', ' ')} · {new Date(p.paidAt).toLocaleString()}
                        </Text>
                        {(p.reference || p.notes) && (
                          <Text className={styles.muted} style={{ display: 'block' }}>
                            {p.notes || `Ref: ${p.reference}`}
                          </Text>
                        )}
                      </div>
                      <Badge
                        appearance="tint"
                        color={Number(p.amount) < 0 ? 'danger' : 'subtle'}
                        size="small"
                      >
                        {Number(p.amount) < 0 ? 'Refund' : p.method.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </div>
      </DialogSurface>
    </Dialog>
  );
}

/* ── Void Confirm Dialog ── */
export function VoidDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
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
      message={
        <>
          Void <strong>{invoice.invoiceNumber}</strong>?
        </>
      }
      confirmLabel="Void Invoice"
      loading={mutation.isPending}
      error={
        mutation.isError ? (
          <MessageBar intent="error" className={styles.deleteError}>
            <MessageBarBody>Failed to void invoice.</MessageBarBody>
          </MessageBar>
        ) : undefined
      }
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
  const styles = useStyles();
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
          <strong>{personLabel(invoice.patient)}</strong>? Payments recorded on this invoice will also be
          removed. This cannot be undone.
        </>
      }
      confirmLabel="Delete"
      loading={mutation.isPending}
      error={
        mutation.isError ? (
          <MessageBar intent="error" className={styles.deleteError}>
            <MessageBarBody>Failed to delete invoice.</MessageBarBody>
          </MessageBar>
        ) : undefined
      }
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}

/* ── Payment Dialog ── */
export function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
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
    <Dialog open onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={`Record Payment — ${invoice.invoiceNumber}`}
          subtitle="Add a payment against this invoice."
        />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>Failed to record payment.</MessageBarBody>
                  </MessageBar>
                )}
                <Text size={200} className={styles.muted}>
                  Total: <strong>{money(Number(invoice.total))}</strong> | Paid:{' '}
                  <strong>{money(Number(invoice.amountPaid ?? 0))}</strong> | Remaining:{' '}
                  <strong>{money(remaining)}</strong>
                </Text>
                <Field label="Amount">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    {...form.register('amount', { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Payment Method">
                  <Controller
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <Dropdown
                        value={field.value.replace('_', ' ')}
                        selectedOptions={[field.value]}
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) field.onChange(data.optionValue);
                        }}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <Option key={m} value={m} text={m.replace('_', ' ')}>
                            {m.replace('_', ' ')}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                  />
                </Field>
                <Field label="Reference (optional)">
                  <Input {...form.register('reference')} />
                </Field>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending} type="button">
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              Record Payment
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

/* ── Refund Dialog ── */
export function RefundDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const maxRefund = Math.max(0, Number(invoice.amountPaid ?? 0));
  const form = useForm({ defaultValues: { amount: maxRefund, method: 'CASH', reason: '' } });
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
    <Dialog open onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={`Refund — ${invoice.invoiceNumber}`}
          subtitle="Return money already collected on this invoice."
        />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      {(mutation.error as Error)?.message || 'Failed to record refund.'}
                    </MessageBarBody>
                  </MessageBar>
                )}
                <Text size={200} className={styles.muted}>
                  Paid: <strong>{money(maxRefund)}</strong> — refund cannot exceed this amount.
                </Text>
                <Field label="Refund amount">
                  <Input
                    type="number"
                    min={0}
                    max={maxRefund}
                    step="any"
                    {...form.register('amount', { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Refund method">
                  <Controller
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <Dropdown
                        value={field.value.replace('_', ' ')}
                        selectedOptions={[field.value]}
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) field.onChange(data.optionValue);
                        }}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <Option key={m} value={m} text={m.replace('_', ' ')}>
                            {m.replace('_', ' ')}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                  />
                </Field>
                <Field label="Reason (optional)">
                  <Input {...form.register('reason')} />
                </Field>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending} type="button">
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              Record Refund
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
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
const defaults: FormValues = {
  patientId: '',
  discount: 0,
  notes: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export function InvoiceDialog({
  open,
  onClose,
  onCreated,
  initialValues,
  tokenId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoice: Invoice) => void;
  initialValues?: Partial<FormValues>;
  /** When set, invoice create links & dispenses the pharmacy Rx. */
  tokenId?: string | null;
}): React.JSX.Element {
  const styles = useStyles();
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const patients = useQuery({ queryKey: ['invoice-patients'], queryFn: invoicesService.patients });
  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      invoicesService.create({
        ...values,
        tokenId: tokenId || undefined,
      } as InvoiceInput),
    onSuccess: async (invoice) => {
      await client.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      onCreated?.(invoice as Invoice);
    },
    meta: { toast: 'Invoice created', errorToast: 'Unable to create the invoice.' },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({
      ...defaults,
      ...initialValues,
      items:
        initialValues?.items && initialValues.items.length > 0 ? initialValues.items : defaults.items,
    });
  }, [form, open, initialValues]);
  const items = form.watch('items');
  const discount = form.watch('discount');
  const patientId = form.watch('patientId');
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const errors = form.formState.errors;
  const patientOptions = patients.data ?? [];
  const selectedPatient = patientOptions.find((p) => p.id === patientId);

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface className={styles.surfaceMd}>
        <FormDialogTitle title="Create Invoice" subtitle="Bill a patient for medicines and services." />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      {mutation.error instanceof Error
                        ? mutation.error.message
                        : 'Unable to create the invoice.'}
                    </MessageBarBody>
                  </MessageBar>
                )}
                <Field
                  label="Patient"
                  validationState={errors.patientId ? 'error' : undefined}
                  validationMessage={errors.patientId?.message}
                >
                  <Dropdown
                    placeholder="Select patient"
                    value={selectedPatient ? personLabel(selectedPatient) : ''}
                    selectedOptions={patientId ? [patientId] : []}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) form.setValue('patientId', data.optionValue, { shouldValidate: true });
                    }}
                  >
                    {patientOptions.map((patient) => (
                      <Option key={patient.id} value={patient.id} text={personLabel(patient)}>
                        {personLabel(patient)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Text className={styles.sectionLabel}>Items</Text>
                {fields.fields.map((field, index) => (
                  <div key={field.id} className={styles.itemRow}>
                    <MedicineAutocomplete
                      label="Description / Medicine"
                      value={form.watch(`items.${index}.description`)}
                      onChange={(name, price) => {
                        form.setValue(`items.${index}.description`, name);
                        form.setValue(`items.${index}.unitPrice`, price);
                      }}
                    />
                    <Field label="Qty">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Field label="Unit price">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Button
                      appearance="subtle"
                      icon={<Delete24Regular />}
                      disabled={fields.fields.length === 1}
                      aria-label="Remove item"
                      onClick={() => fields.remove(index)}
                      type="button"
                    />
                  </div>
                ))}
                <Button
                  appearance="secondary"
                  icon={<Add24Regular />}
                  onClick={() => fields.append({ description: '', quantity: 1, unitPrice: 0 })}
                  type="button"
                  style={{ alignSelf: 'flex-start' }}
                >
                  Add item
                </Button>
                <div className={styles.grid2}>
                  <Field label="Discount">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      {...form.register('discount', { valueAsNumber: true })}
                    />
                  </Field>
                  <Field label="Notes">
                    <Input {...form.register('notes')} />
                  </Field>
                </div>
                <div className={styles.totals}>
                  <Text size={200} className={styles.muted}>
                    Subtotal (medicines): {money(subtotal)}
                  </Text>
                  <Text size={200} className={styles.muted} style={{ display: 'block' }}>
                    Discount: {money(Number(discount) || 0)}
                  </Text>
                  <Text weight="bold" style={{ display: 'block', marginTop: 4 }}>
                    Total: {money(total)}
                  </Text>
                </div>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending} type="button">
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              Create invoice
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

/* ── Invoices Page ── */
export function InvoicesPage(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | undefined>();
  const [refundInvoice, setRefundInvoice] = useState<Invoice | undefined>();
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | undefined>();
  const [voidInvoice, setVoidInvoice] = useState<Invoice | undefined>();
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | undefined>();
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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

  const filtered = (invoices.data ?? []).filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const statusFilterLabel =
    statusFilter === 'ALL'
      ? 'All statuses'
      : (statusConfig[statusFilter]?.label ?? statusFilter);

  const columns = useMemo<TableColumnDefinition<Invoice>[]>(
    () => [
      createTableColumn<Invoice>({
        columnId: 'invoice',
        compare: (a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber),
        renderHeaderCell: () => 'Invoice',
        renderCell: (invoice) => (
          <Text weight="semibold" size={300}>
            {invoice.invoiceNumber}
          </Text>
        ),
      }),
      createTableColumn<Invoice>({
        columnId: 'patient',
        compare: (a, b) =>
          personLabel(a.patient).localeCompare(personLabel(b.patient)),
        renderHeaderCell: () => 'Patient',
        renderCell: (invoice) => (
          <TableCellLayout
            media={
              <Avatar
                name={personLabel(invoice.patient)}
                color="brand"
                size={32}
              />
            }
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>{personLabel(invoice.patient)}</Text>
              <Text className={styles.muted}>{invoice.patient.phone?.trim() || '—'}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Invoice>({
        columnId: 'created',
        compare: (a, b) => a.createdAt.localeCompare(b.createdAt),
        renderHeaderCell: () => 'Created',
        renderCell: (invoice) => (
          <Text size={300} style={{ whiteSpace: 'nowrap' }}>
            {new Date(invoice.createdAt).toLocaleDateString()}
          </Text>
        ),
      }),
      createTableColumn<Invoice>({
        columnId: 'status',
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => 'Status',
        renderCell: (invoice) => {
          const cfg = statusConfig[invoice.status] ?? { label: invoice.status, color: 'subtle' as const };
          return (
            <Badge appearance="tint" color={cfg.color} size="small">
              {cfg.label}
            </Badge>
          );
        },
      }),
      createTableColumn<Invoice>({
        columnId: 'total',
        compare: (a, b) => a.total - b.total,
        renderHeaderCell: () => 'Total',
        renderCell: (invoice) => (
          <Text weight="bold" size={300}>
            {money(invoice.total)}
          </Text>
        ),
      }),
      createTableColumn<Invoice>({
        columnId: 'paid',
        compare: (a, b) => Number(a.amountPaid ?? 0) - Number(b.amountPaid ?? 0),
        renderHeaderCell: () => 'Paid',
        renderCell: (invoice) => <Text size={300}>{money(Number(invoice.amountPaid ?? 0))}</Text>,
      }),
      createTableColumn<Invoice>({
        columnId: 'actions',
        renderHeaderCell: () => 'Actions',
        renderCell: (invoice) => {
          const isVoid = invoice.status === 'VOID';
          const canPay = !isAdmin && !isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED';
          const canRefund = !isAdmin && !isVoid && Number(invoice.amountPaid ?? 0) > 0;
          return (
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <Tooltip content="View details" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Eye24Regular />}
                  style={actionBtnStyle}
                  onClick={() => navigate(`/billing/${invoice.id}`)}
                />
              </Tooltip>
              {!isAdmin && canPay && (
                <Tooltip content="Record Payment" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Payment24Regular />}
                    style={actionBtnStyle}
                    onClick={() => setPaymentInvoice(invoice)}
                  />
                </Tooltip>
              )}
              {canRefund && (
                <Tooltip content="Refund" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<ArrowUndo24Regular />}
                    style={actionBtnStyle}
                    onClick={() => setRefundInvoice(invoice)}
                  />
                </Tooltip>
              )}
              <Tooltip content="Payment History" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<History24Regular />}
                  style={actionBtnStyle}
                  onClick={() => setHistoryInvoice(invoice)}
                />
              </Tooltip>
              <Tooltip content="Print invoice" relationship="label">
                <Button
                  appearance="subtle"
                  icon={printingId === invoice.id ? <Spinner size="tiny" /> : <Print24Regular />}
                  style={actionBtnStyle}
                  disabled={printingId === invoice.id}
                  onClick={() => void handlePrintInvoice(invoice)}
                />
              </Tooltip>
              {!isAdmin &&
                invoice.status !== 'VOID' &&
                invoice.status !== 'PAID' &&
                invoice.status !== 'REFUNDED' && (
                  <Tooltip content="Void Invoice" relationship="label">
                    <Button
                      appearance="subtle"
                      icon={<Prohibited24Regular />}
                      style={actionBtnStyle}
                      onClick={() => setVoidInvoice(invoice)}
                    />
                  </Tooltip>
                )}
              {!isAdmin && (
                <Tooltip content="Delete invoice" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    style={actionBtnStyle}
                    onClick={() => setDeleteInvoice(invoice)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      }),
    ],
    [isAdmin, navigate, printingId, styles],
  );

  return (
    <>
      <TablePageShell
        title="Invoices"
        subtitle="Create itemized invoices and track payments."
        action={
          !isAdmin ? (
            <Button appearance="primary" icon={<Add24Regular />} onClick={() => setOpen(true)}>
              Create invoice
            </Button>
          ) : undefined
        }
        toolbar={
          <div className={styles.toolbar}>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              placeholder="Search invoice or patient..."
            />
            <Dropdown
              className={styles.statusFilter}
              value={statusFilterLabel}
              selectedOptions={[statusFilter]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  setStatusFilter(data.optionValue);
                  setPage(0);
                }
              }}
            >
              <Option value="ALL" text="All statuses">All statuses</Option>
              <Option value="DRAFT" text="Draft">Draft</Option>
              <Option value="ISSUED" text="Issued">Issued</Option>
              <Option value="PARTIALLY_PAID" text="Partial">Partial</Option>
              <Option value="PAID" text="Paid">Paid</Option>
              <Option value="REFUNDED" text="Refunded">Refunded</Option>
              <Option value="VOID" text="Void">Void</Option>
            </Dropdown>
          </div>
        }
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
        error={
          invoices.isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load invoices.</MessageBarBody>
            </MessageBar>
          )
        }
        fetching={invoices.isFetching && !invoices.isLoading}
      >
        {invoices.isLoading ? (
          <TableRowsSkeleton cols={7} />
        ) : (
          <DataGridTable
            items={paginated}
            columns={columns}
            getRowId={(inv) => inv.id}
            emptyMessage="No invoices created."
            onRowClick={(invoice) => navigate(`/billing/${invoice.id}`)}
          />
        )}
      </TablePageShell>
      <InvoiceDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(invoice) => {
          void handlePrintInvoice(invoice);
        }}
      />
      {paymentInvoice && <PaymentDialog invoice={paymentInvoice} onClose={() => setPaymentInvoice(undefined)} />}
      {refundInvoice && <RefundDialog invoice={refundInvoice} onClose={() => setRefundInvoice(undefined)} />}
      {historyInvoice && (
        <PaymentHistoryDialog invoice={historyInvoice} onClose={() => setHistoryInvoice(undefined)} />
      )}
      {voidInvoice && <VoidDialog invoice={voidInvoice} onClose={() => setVoidInvoice(undefined)} />}
      {deleteInvoice && (
        <DeleteInvoiceDialog invoice={deleteInvoice} onClose={() => setDeleteInvoice(undefined)} />
      )}
      {printError && (
        <MessageBar intent="error" className={styles.printError}>
          <MessageBarBody>{printError}</MessageBarBody>
          <Button appearance="transparent" size="small" onClick={() => setPrintError(null)}>
            Dismiss
          </Button>
        </MessageBar>
      )}
    </>
  );
}
