import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  Divider, Paper, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { InvoiceDialog } from '@/features/billing/InvoicesPage';
import { formatAdvicePreview } from '@/features/tokens/PrescriptionPadPdf';
import { chipSx } from '@/components/TableUI';
import { dialogActionsSx, dialogCancelBtnSx, dialogContentSx, dialogPaperProps, FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import type { PharmacyQueueItem } from '@/types/token';
import imgMask from '@/assets/dashboard/clinic-mask.svg';
import imgCapsule from '@/assets/dashboard/clinic-capsule.svg';
import imgVirus from '@/assets/dashboard/clinic-virus.svg';
import imgHeart from '@/assets/dashboard/clinic-heart.svg';

/** Same illustration cluster style as ReceptionistDashboard (pharmacy-weighted layout). */
const PHARMACY_CLUSTER = [
  { src: imgCapsule, alt: 'Capsule large', w: 88, top: '8%', left: '8%', rot: -22, z: 3, opacity: 1 },
  { src: imgCapsule, alt: 'Capsule small', w: 58, top: '52%', left: '2%', rot: 28, z: 2, opacity: 0.92 },
  { src: imgMask, alt: 'Surgical mask', w: 160, top: '20%', left: '28%', rot: 6, z: 4, opacity: 1 },
  { src: imgVirus, alt: 'Virus', w: 72, top: '4%', left: '68%', rot: 16, z: 5, opacity: 1 },
  { src: imgHeart, alt: 'Heart', w: 68, top: '58%', left: '66%', rot: -10, z: 5, opacity: 1 },
] as const;

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export function PharmacistDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [queueTab, setQueueTab] = useState<'pending' | 'done' | 'all'>('pending');
  const [selected, setSelected] = useState<PharmacyQueueItem | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [blankInvoiceOpen, setBlankInvoiceOpen] = useState(false);

  const date = todayStr();

  const {
    data: queueData,
    isPending: queuePending,
    isError: queueError,
    error: queueErr,
  } = useQuery<PharmacyQueueItem[]>({
    queryKey: ['pharmacy-queue', date],
    queryFn: () => window.clinic.tokens.pharmacyQueue(date),
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });
  const queue = queueData ?? [];
  // Only first load — background refetch / realtime must not flash a spinner.
  const showQueueLoading = queuePending && queueData === undefined;

  const { data: rawMedicines = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-medicines'],
    queryFn: () => window.clinic.inventory.medicines.list(),
  });

  const { data: lowStockRaw = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => window.clinic.inventory.medicines.lowStock(),
  });

  const { data: expiring = [] } = useQuery<InventoryBatch[]>({
    queryKey: ['inventory-expiring'],
    queryFn: () => window.clinic.inventory.batches.expiringSoon(60),
  });

  const priceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const med of rawMedicines) {
      const batches = med.batches ?? [];
      const priced = batches.find((b) => Number(b.salePrice) > 0) ?? batches[0];
      map.set(med.name.trim().toLowerCase(), Number(priced?.salePrice ?? 0));
    }
    return map;
  }, [rawMedicines]);

  const pending = useMemo(
    () => queue.filter((q) => q.pharmacyStatus !== 'DISPENSED'),
    [queue],
  );
  const dispensed = useMemo(
    () => queue.filter((q) => q.pharmacyStatus === 'DISPENSED'),
    [queue],
  );
  const readyCount = useMemo(
    () => pending.filter((q) => q.appointmentCompleted).length,
    [pending],
  );

  const visibleQueue = useMemo(() => {
    if (queueTab === 'pending') return pending;
    if (queueTab === 'done') return dispensed;
    return queue;
  }, [queueTab, pending, dispensed, queue]);

  const dispenseMutation = useMutation({
    mutationFn: (tokenId: string) => window.clinic.tokens.pharmacyDispense(tokenId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      await qc.invalidateQueries({ queryKey: ['inventory-medicines'] });
      await qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      setSelected(null);
    },
    meta: { toast: 'Prescription dispensed', errorToast: 'Unable to dispense.' },
  });

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const invoicePrefill = useMemo(() => {
    if (!selected) return undefined;
    const items = selected.medicines
      .filter((m) => m.name?.trim())
      .map((m) => ({
        description: m.name.trim(),
        quantity: 1,
        unitPrice: priceByName.get(m.name.trim().toLowerCase()) ?? 0,
      }));
    return {
      patientId: selected.patientId,
      drFee: 0,
      discount: 0,
      notes: `Token #${String(selected.tokenNumber).padStart(3, '0')} · Dr. ${selected.doctorName}`,
      items: items.length > 0 ? items : [{ description: '', quantity: 1, unitPrice: 0 }],
    };
  }, [selected, priceByName]);

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          Hi {user?.name || 'Pharmacist'},
        </Typography>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
          Pharmacy Desk
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 4.5 },
              borderRadius: '28px',
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 100%)`,
              color: theme.palette.primary.contrastText,
              position: 'relative',
              overflow: 'hidden',
              minHeight: { xs: 220, sm: 260 },
              display: 'flex',
              alignItems: 'center',
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.28)}`,
              border: 'none',
            }}
          >
            <Box sx={{ position: 'absolute', right: -10, top: -40, width: 220, height: 220, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.12)}` }} />
            <Box sx={{ position: 'absolute', right: 80, bottom: -70, width: 180, height: 180, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.08)}` }} />
            <Box sx={{ position: 'relative', zIndex: 1, maxWidth: { xs: '100%', sm: '48%' }, pr: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.88, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Pharmacy Desk
              </Typography>
              <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 1, lineHeight: 1.3, textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}` }}>
                Dispense Queue
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 440 }}>
                {pending.length} waiting
                {readyCount > 0 ? `, ${readyCount} visit complete` : ''}.
                Doctor Rx lands here by token — bill medicines + doctor fee in one invoice.
              </Typography>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                right: { sm: 8, md: 20 },
                bottom: 0,
                width: { sm: 280, md: 320 },
                height: { sm: 210, md: 230 },
                zIndex: 1,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              {PHARMACY_CLUSTER.map((img) => (
                <Box
                  key={img.alt}
                  component="img"
                  src={img.src}
                  alt={img.alt}
                  sx={{
                    position: 'absolute',
                    top: img.top,
                    left: img.left,
                    width: img.w,
                    height: 'auto',
                    objectFit: 'contain',
                    transform: `rotate(${img.rot}deg)`,
                    zIndex: img.z,
                    opacity: img.opacity,
                    filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.28))',
                    userSelect: 'none',
                  }}
                />
              ))}
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {[
              { label: 'Pending Rx', value: pending.length, icon: <HourglassEmptyOutlinedIcon />, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.12) },
              { label: 'Visit complete', value: readyCount, icon: <CheckCircleOutlineIcon />, color: theme.palette.success.dark, bg: alpha(theme.palette.success.main, 0.12) },
              { label: 'Low stock', value: lowStockRaw.length, icon: <WarningAmberOutlinedIcon />, color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.1) },
              { label: 'Expiring (60d)', value: expiring.length, icon: <EventBusyOutlinedIcon />, color: theme.palette.info.dark, bg: alpha(theme.palette.info.main, 0.12) },
            ].map((c) => (
              <Paper key={c.label} elevation={0} sx={{ p: 2.1, ...softCard, bgcolor: c.bg, border: 'none' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>
                      {c.label}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(c.color, 0.15), color: c.color }}>
                    {c.icon}
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Paper elevation={0} sx={{ ...softCard, overflow: 'hidden' }}>
            <Box sx={{ px: 2.25, pt: 1.5, pb: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography fontWeight={800}>Patient queue</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Sorted by visit-ready · token #
                </Typography>
              </Stack>
              <Tabs
                value={queueTab}
                onChange={(_, v: 'pending' | 'done' | 'all') => setQueueTab(v)}
                sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700 } }}
              >
                <Tab value="pending" label={`Pending (${pending.length})`} />
                <Tab value="done" label={`Dispensed (${dispensed.length})`} />
                <Tab value="all" label={`All (${queue.length})`} />
              </Tabs>
            </Box>
            <Divider />
            <Box sx={{ p: 1.5, maxHeight: 420, overflowY: 'auto' }}>
              {queueError ? (
                <Alert severity="error" sx={{ m: 1 }}>
                  {queueErr instanceof Error ? queueErr.message : 'Unable to load pharmacy queue.'}
                </Alert>
              ) : showQueueLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
              ) : visibleQueue.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" sx={{ py: 5 }}>
                  No prescriptions in this list yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {visibleQueue.map((item) => {
                    const isDone = item.pharmacyStatus === 'DISPENSED';
                    return (
                      <Box
                        key={item.prescriptionId}
                        onClick={() => setSelected(item)}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          display: 'flex',
                          gap: 1.5,
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          bgcolor: item.appointmentCompleted && !isDone
                            ? alpha(theme.palette.success.main, 0.08)
                            : alpha(theme.palette.primary.main, 0.03),
                          border: '1px solid',
                          borderColor: item.appointmentCompleted && !isDone ? alpha(theme.palette.success.main, 0.35) : 'divider',
                          borderLeft: '4px solid',
                          borderLeftColor: isDone
                            ? 'success.main'
                            : item.appointmentCompleted
                              ? 'success.main'
                              : 'warning.main',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.07) },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: 'primary.main',
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {initials(item.patientName)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography fontWeight={800} fontSize={14} noWrap>
                              {item.patientName}
                            </Typography>
                            <Chip
                              size="small"
                              icon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                              label={`#${String(item.tokenNumber).padStart(3, '0')}`}
                              sx={{ ...chipSx, height: 22, fontWeight: 800 }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Dr. {item.doctorName}
                            {item.patientMrNumber ? ` · MR# ${item.patientMrNumber}` : ''}
                          </Typography>
                          <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                            {item.appointmentCompleted && (
                              <Chip size="small" color="success" label="Visit complete" sx={{ ...chipSx, height: 22, fontWeight: 700 }} />
                            )}
                            <Chip
                              size="small"
                              color={isDone ? 'success' : 'warning'}
                              label={isDone ? 'Dispensed' : 'Pending'}
                              sx={{ ...chipSx, height: 22, fontWeight: 700 }}
                            />
                            {item.medicines.length > 0 && (
                              <Chip size="small" variant="outlined" label={`${item.medicines.length} meds`} sx={{ ...chipSx, height: 22 }} />
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Paper>
        </Stack>

        {/* Sidebar */}
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 2, ...softCard }}>
            <Typography fontWeight={800} sx={{ mb: 1.5 }}>Quick actions</Typography>
            <Stack spacing={1}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PaymentsOutlinedIcon />}
                onClick={() => setBlankInvoiceOpen(true)}
                sx={{ borderRadius: 2, fontWeight: 700, justifyContent: 'flex-start' }}
              >
                New invoice
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<LocalPharmacyOutlinedIcon />}
                onClick={() => navigate('/pharmacy')}
                sx={{ borderRadius: 2, fontWeight: 700, justifyContent: 'flex-start' }}
              >
                Open inventory
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PaymentsOutlinedIcon />}
                onClick={() => navigate('/billing')}
                sx={{ borderRadius: 2, fontWeight: 700, justifyContent: 'flex-start' }}
              >
                All invoices
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2, ...softCard }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography fontWeight={800}>Low stock</Typography>
            </Stack>
            {lowStockRaw.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Stock looks healthy.</Typography>
            ) : (
              <Stack spacing={0.75}>
                {lowStockRaw.slice(0, 5).map((m) => (
                  <Typography key={m.id} variant="body2" fontWeight={600}>
                    {m.name}
                  </Typography>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper elevation={0} sx={{ p: 2, ...softCard }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 18, color: 'info.main' }} />
              <Typography fontWeight={800}>Expiring soon</Typography>
            </Stack>
            {expiring.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No batches expiring in 60 days.</Typography>
            ) : (
              <Stack spacing={0.75}>
                {expiring.slice(0, 5).map((b) => (
                  <Typography key={b.id} variant="body2" fontWeight={600}>
                    {b.medicine?.name ?? 'Medicine'} · {b.batchNumber}
                  </Typography>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>

      {/* Rx detail dialog */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={dialogPaperProps}
      >
        {selected && (
          <>
            <FormDialogTitle
              title={selected.patientName}
              subtitle={`Token #${String(selected.tokenNumber).padStart(3, '0')} · Dr. ${selected.doctorName}`}
            />
            <DialogContent sx={dialogContentSx}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {selected.appointmentCompleted && (
                    <Chip size="small" color="success" label="Visit complete" sx={{ fontWeight: 700 }} />
                  )}
                  <Chip
                    size="small"
                    color={selected.pharmacyStatus === 'DISPENSED' ? 'success' : 'warning'}
                    label={selected.pharmacyStatus === 'DISPENSED' ? 'Dispensed' : 'Pending'}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
                {selected.diagnosis && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Diagnosis</Typography>
                    <Typography fontWeight={600}>{selected.diagnosis}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>Medicines</Typography>
                  {selected.medicines.length === 0 ? (
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                      No structured medicine lines — check advice / pad text.
                    </Typography>
                  ) : (
                    <Stack spacing={1} sx={{ mt: 0.75 }}>
                      {selected.medicines.map((m, i) => (
                        <Paper key={`${m.name}-${i}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Typography fontWeight={800} fontSize={14}>{m.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[m.dosage, m.duration, m.instructions].filter(Boolean).join(' · ') || '—'}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Box>
                {selected.advice?.trim() && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Advice</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      {formatAdvicePreview(selected.advice)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
              <Button onClick={() => setSelected(null)} sx={dialogCancelBtnSx}>Close</Button>
              {selected.pharmacyStatus !== 'DISPENSED' && (
                <>
                  <Button
                    variant="outlined"
                    disabled={dispenseMutation.isPending}
                    onClick={() => dispenseMutation.mutate(selected.tokenId)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Mark dispensed
                  </Button>
                  <SubmitButton
                    onClick={() => {
                      setInvoiceOpen(true);
                    }}
                  >
                    Create invoice
                  </SubmitButton>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <InvoiceDialog
        open={invoiceOpen}
        tokenId={selected?.tokenId}
        initialValues={invoicePrefill}
        onClose={() => setInvoiceOpen(false)}
        onCreated={async () => {
          setInvoiceOpen(false);
          setSelected(null);
          await qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
          await qc.invalidateQueries({ queryKey: ['inventory-medicines'] });
        }}
      />

      <InvoiceDialog
        open={blankInvoiceOpen}
        onClose={() => setBlankInvoiceOpen(false)}
        onCreated={async () => {
          setBlankInvoiceOpen(false);
          await qc.invalidateQueries({ queryKey: ['invoices'] });
        }}
      />
    </>
  );
}
