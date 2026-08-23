import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StatCardsSkeleton, TableRowsSkeleton } from '@/components/LoadingUI';
import { chipSx, tableSx, Table, TableBody, TableCell, TableHead, TableRow } from '@/components/TableUI';
import {
  DeleteInvoiceDialog,
  InvoiceDialog,
  PaymentDialog,
  RefundDialog,
  VoidDialog,
} from '@/features/billing/InvoicesPage';
import { invoicesService } from '@/services/invoices.service';
import type { Invoice, Payment } from '@/types/invoice';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';

const statusConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  ISSUED: { label: 'Issued', color: 'info' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'error' },
  VOID: { label: 'Void', color: 'error' },
};

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

export function InvoiceDetailPage(): React.JSX.Element {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  function goBack(): void {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
      return;
    }
    if (location.pathname.startsWith('/opd-reports')) {
      navigate('/opd-reports');
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/billing');
  }

  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesService.get(id!),
    enabled: Boolean(id),
  });

  const paymentsQuery = useQuery<Payment[]>({
    queryKey: ['invoice-payments', id],
    queryFn: () => invoicesService.payments(id!),
    enabled: Boolean(id),
  });

  const invoice = query.data ?? null;

  async function handlePrint(inv: Invoice): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printInvoiceReceipt(inv);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  if (query.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 1 }}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (!invoice) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Invoice not found.
        </Alert>
        <Button
          sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back
        </Button>
      </Box>
    );
  }

  const status = statusConfig[invoice.status] ?? { label: invoice.status, color: 'default' as const };
  const paid = Number(invoice.amountPaid ?? 0);
  const total = Number(invoice.total);
  const balance = Math.max(0, total - paid);
  const isVoid = invoice.status === 'VOID';
  const canPay = !isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && balance > 0;
  const canRefund = !isVoid && paid > 0;
  const patientLabel = `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim();
  const payments = paymentsQuery.data ?? [];

  const summaryCards = [
    {
      label: 'Total',
      value: money(total),
      note: invoice.discount ? `Discount ${money(Number(invoice.discount))}` : 'Bill total',
      icon: <ReceiptOutlinedIcon fontSize="small" />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Paid',
      value: money(paid),
      note: 'Collected',
      icon: <PaymentOutlinedIcon fontSize="small" />,
      color: theme.palette.success.main,
    },
    {
      label: 'Balance',
      value: money(balance),
      note: balance > 0 ? 'Due' : 'Cleared',
      icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Status',
      value: status.label,
      note: new Date(invoice.createdAt).toLocaleDateString(),
      icon: <ReceiptOutlinedIcon fontSize="small" />,
      color: theme.palette.info.main,
    },
  ];

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Tooltip title="Back">
              <IconButton
                onClick={() => goBack()}
                size="small"
                sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Invoice details
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  {invoice.invoiceNumber}
                </Typography>
                <Chip color={status.color} label={status.label} size="small" sx={chipSx} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
                {patientLabel}
                {invoice.patient.phone ? ` · ${invoice.patient.phone}` : ''}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={1} justifyContent="flex-end" flexWrap="wrap">
            <Button
              variant="outlined"
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => navigate(`/patients/${invoice.patient.id}`)}
            >
              Open patient
            </Button>
            {canPay && (
              <Button
                startIcon={<PaymentOutlinedIcon />}
                variant="contained"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setPaymentOpen(true)}
              >
                Record payment
              </Button>
            )}
            {!isVoid && (
              <Button
                startIcon={<EditOutlinedIcon />}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setEditOpen(true)}
              >
                Edit invoice
              </Button>
            )}
            {canRefund && (
              <Button
                startIcon={<UndoOutlinedIcon />}
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setRefundOpen(true)}
              >
                Refund
              </Button>
            )}
            <Button
              startIcon={<PrintOutlinedIcon />}
              variant="outlined"
              loading={printing}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => void handlePrint(invoice)}
            >
              Print
            </Button>
            {!isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && (
              <Button
                startIcon={<BlockOutlinedIcon />}
                variant="outlined"
                color="warning"
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => setVoidOpen(true)}
              >
                Void
              </Button>
            )}
            <Button
              startIcon={<DeleteOutlineIcon />}
              variant="outlined"
              color="error"
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </Stack>
        </Stack>

        {printError && (
          <Alert severity="error" onClose={() => setPrintError(null)}>
            {printError}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 1.75,
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          }}
        >
          {summaryCards.map((c) => (
            <Paper key={c.label} elevation={0} sx={{ p: 2.25, ...softCard, position: 'relative', overflow: 'hidden' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: -18,
                  right: -18,
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: alpha(c.color, 0.1),
                }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {c.label}
                  </Typography>
                  <Typography fontWeight={900} fontSize={20} sx={{ mt: 0.25, letterSpacing: '-0.02em' }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {c.note}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(c.color, 0.12),
                    color: c.color,
                  }}
                >
                  {c.icon}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(280px, 1fr)' },
            alignItems: 'start',
          }}
        >
          <Paper elevation={0} sx={{ ...softCard, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5 }}>
              <Typography fontWeight={800}>Line items</Typography>
            </Box>
            <Table size="small">
              <TableHead sx={tableSx.head}>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                      No line items.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.items.map((item) => (
                    <TableRow key={item.id} sx={tableSx.row}>
                      <TableCell>
                        <Typography fontSize={13.5} fontWeight={600}>
                          {item.description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{money(Number(item.unitPrice))}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {money(Number(item.lineTotal))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Divider />
            <Stack spacing={0.75} sx={{ px: 2.5, py: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary" fontWeight={600}>
                  Subtotal
                </Typography>
                <Typography fontWeight={700}>{money(Number(invoice.subtotal))}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary" fontWeight={600}>
                  Discount
                </Typography>
                <Typography fontWeight={700}>{money(Number(invoice.discount))}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={800}>Total</Typography>
                <Typography fontWeight={900}>{money(total)}</Typography>
              </Stack>
              {invoice.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                  Notes: {invoice.notes}
                </Typography>
              )}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
            <Typography fontWeight={800} sx={{ mb: 1.75 }}>
              Payment history
            </Typography>
            {paymentsQuery.isLoading ? (
              <TableRowsSkeleton cols={1} rows={3} />
            ) : payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No payments recorded yet.
              </Typography>
            ) : (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {payments.map((p) => (
                  <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} fontSize={14}>
                        {money(Number(p.amount))}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {p.method.replace('_', ' ')}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </Typography>
                      {p.notes && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {p.notes}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(p.paidAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      </Stack>

      {paymentOpen && <PaymentDialog invoice={invoice} onClose={() => setPaymentOpen(false)} />}
      {editOpen && (
        <InvoiceDialog
          open
          invoice={invoice}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            setEditOpen(false);
            void query.refetch();
          }}
        />
      )}
      {refundOpen && <RefundDialog invoice={invoice} onClose={() => setRefundOpen(false)} />}
      {voidOpen && <VoidDialog invoice={invoice} onClose={() => setVoidOpen(false)} />}
      {deleteOpen && (
        <DeleteInvoiceDialog
          invoice={invoice}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => goBack()}
        />
      )}
    </>
  );
}
