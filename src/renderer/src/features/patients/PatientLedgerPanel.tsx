import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { patientsService } from '@/services/patients.service';
import type { LedgerEntry, LedgerEntryType } from '@/types/ledger';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(v)}`;

const TYPE_LABEL: Record<LedgerEntryType, string> = {
  consultation: 'Consultation',
  invoice: 'Invoice',
  payment: 'Payment',
  refund: 'Refund',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Patient ledger: every charge and payment (OPD consultations + invoices) with a running
 * balance, and the outstanding dues at the top.
 */
export function PatientLedgerPanel({
  patientId,
  onOpenInvoice,
  canCollectFee = false,
}: {
  patientId: string;
  /** Called for invoice / payment rows (e.g. navigate to the invoice). Omit to make rows static. */
  onOpenInvoice?: (invoiceId: string) => void;
  /** Show "Collect" on unpaid consultation rows (front desk). */
  canCollectFee?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const qc = useQueryClient();
  const [collecting, setCollecting] = useState<LedgerEntry | null>(null);
  const [amount, setAmount] = useState('');
  const collect = useMutation({
    mutationFn: async () => {
      if (!collecting?.tokenId) throw new Error('Token missing.');
      const value = parseFloat(amount);
      return window.clinic.tokens.collectFee(collecting.tokenId, Number.isFinite(value) ? value : undefined);
    },
    onSuccess: async () => {
      setCollecting(null);
      await qc.invalidateQueries({ queryKey: ['patient-ledger'] });
      await qc.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
  const ledger = useQuery({
    queryKey: ['patient-ledger', patientId],
    queryFn: () => patientsService.ledger(patientId),
    enabled: Boolean(patientId),
  });

  // Newest first on screen; balances were computed oldest → newest on the server.
  const rows = useMemo<LedgerEntry[]>(() => [...(ledger.data?.entries ?? [])].reverse(), [ledger.data]);

  if (ledger.isLoading) {
    return (
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    );
  }
  if (ledger.isError || !ledger.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {ledger.error instanceof Error ? ledger.error.message : 'Could not load the ledger.'}
        </Alert>
      </Box>
    );
  }

  const { totals } = ledger.data;
  const due = totals.due;
  const dueColor = due > 0.009 ? theme.palette.error.main : due < -0.009 ? theme.palette.info.main : theme.palette.success.main;
  const dueLabel = due > 0.009 ? 'Dues' : due < -0.009 ? 'Advance (credit)' : 'Dues';

  const tiles = [
    { label: 'Total Billed', value: money(totals.billed), color: theme.palette.warning.dark },
    { label: 'Total Paid', value: money(totals.paid), color: theme.palette.success.dark },
    { label: dueLabel, value: due > 0.009 || due < -0.009 ? money(Math.abs(due)) : 'Clear', color: dueColor },
  ];

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        {tiles.map((t) => (
          <Box
            key={t.label}
            sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(t.color, 0.08), border: '1px solid', borderColor: alpha(t.color, 0.2) }}
          >
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              {t.label}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1.2, mt: 0.25 }}>{t.value}</Typography>
          </Box>
        ))}
      </Box>

      {(totals.openInvoices > 0 || totals.unpaidVisits > 0) && (
        <Typography variant="body2" color="text.secondary">
          {[
            totals.unpaidVisits > 0 ? `${totals.unpaidVisits} visit fee${totals.unpaidVisits === 1 ? '' : 's'} unpaid` : '',
            totals.openInvoices > 0 ? `${totals.openInvoices} invoice${totals.openInvoices === 1 ? '' : 's'} not fully paid` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          .
        </Typography>
      )}

      {rows.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
          <Typography fontWeight={700} sx={{ mt: 1 }}>
            No charges or payments yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consultation fees and invoices for this patient will appear here.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 480, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Charge</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Paid</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((e) => {
                const clickable = Boolean(onOpenInvoice && e.invoiceId);
                return (
                  <TableRow
                    key={e.id}
                    hover={clickable}
                    onClick={clickable ? () => onOpenInvoice?.(e.invoiceId as string) : undefined}
                    sx={{ cursor: clickable ? 'pointer' : 'default' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: 12.5 }}>{formatDate(e.date)}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={TYPE_LABEL[e.type]}
                          size="small"
                          color={e.type === 'refund' ? 'warning' : e.type === 'payment' ? 'success' : e.type === 'invoice' ? 'primary' : 'default'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700, borderRadius: 1 }}
                        />
                        <Typography fontSize={13} fontWeight={600} noWrap title={e.description}>
                          {e.description}
                        </Typography>
                      </Stack>
                      {(e.reference || e.method) && (
                        <Typography variant="caption" color="text.secondary">
                          {[e.reference, e.method ? e.method.replace('_', ' ').toLowerCase() : null].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                      {e.type === 'consultation' && e.tokenDue > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Chip
                            label={`Unpaid: ${money(e.tokenDue)}`}
                            size="small"
                            color="error"
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, borderRadius: 1 }}
                          />
                          {canCollectFee && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                collect.reset();
                                setAmount(String(e.tokenDue));
                                setCollecting(e);
                              }}
                              sx={{ py: 0, minHeight: 22, fontSize: 11.5, fontWeight: 700, borderRadius: 1 }}
                            >
                              Collect
                            </Button>
                          )}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {e.charge ? money(e.charge) : '—'}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: e.credit < 0 ? 'warning.main' : 'success.main' }}
                    >
                      {e.credit ? money(e.credit) : '—'}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        whiteSpace: 'nowrap',
                        fontWeight: 800,
                        color: e.balance > 0.009 ? 'error.main' : e.balance < -0.009 ? 'info.main' : 'text.primary',
                      }}
                    >
                      {money(e.balance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(collecting)} onClose={() => !collect.isPending && setCollecting(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Collect consultation fee</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {collecting?.reference ? `${collecting.reference} · ` : ''}Due: {collecting ? money(collecting.tokenDue) : ''}
            </Typography>
            <TextField
              label="Amount received"
              type="number"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              autoFocus
              fullWidth
              inputProps={{ min: 0, max: collecting?.tokenDue, step: 'any' }}
              InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
            />
            {collect.isError && (
              <Alert severity="error">{collect.error instanceof Error ? collect.error.message : 'Could not record the payment.'}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCollecting(null)} disabled={collect.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => collect.mutate()}
            disabled={collect.isPending || !(parseFloat(amount) > 0)}
          >
            {collect.isPending ? 'Saving…' : 'Record payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
