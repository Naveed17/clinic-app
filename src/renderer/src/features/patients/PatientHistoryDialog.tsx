import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions,
  DialogContent, IconButton, Paper, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Prescription } from '@/types/token';
import { ListCardsSkeleton } from '@/components/LoadingUI';
import { chipSx } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import type { Patient } from '@/types/patient';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { formatAdvicePreview } from '@/features/tokens/PrescriptionPadPdf';
import { PatientDocumentsPanel } from './PatientDocumentsPanel';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import { AppointmentVisitList } from '@/features/appointments/AppointmentVisitList';
import { usePrintAppointmentToken } from '@/features/appointments/printAppointmentToken';
import { TokenPrintPreview } from '@/features/tokens/TokensPage';
import type { LabOrder } from '@/types/lab';

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '18px',
          mx: 'auto',
          mb: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>Nothing here yet</Typography>
      <Typography fontSize={13} color="text.secondary">{text}</Typography>
    </Box>
  );
}

function PrescriptionsTab({ patientId, patient }: { patientId: string; patient?: Patient }): React.JSX.Element {
  const theme = useTheme();
  const { can } = useLicense();
  type PrintItem = {
    prescription: Prescription;
    doctor: { firstName: string; lastName: string };
  };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: async () => {
      const today = new Date();
      const results: Array<{
        prescription: Prescription;
        doctor: { firstName: string; lastName: string };
        tokenNumber?: number;
        date?: string;
      }> = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayTokens = await window.clinic.tokens.list(dateStr);
        for (const t of dayTokens) {
          if (t.patientId === patientId && t.prescription) {
            results.push({
              prescription: t.prescription,
              doctor: t.doctor ?? { firstName: '', lastName: '' },
              tokenNumber: t.tokenNumber,
              date: t.date,
            });
          }
        }
      }
      return results;
    },
  });

  async function handleSummarize(): Promise<void> {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary('');
    try {
      const visits = items.slice(0, 12).map((item) => ({
        date: new Date(item.prescription.createdAt).toLocaleDateString(),
        diagnosis: item.prescription.diagnosis || item.prescription.thumbName || '',
        advice: formatAdvicePreview(item.prescription.advice || ''),
      }));
      let streamed = '';
      const result = await window.clinic.ai.summarizePatient(
        {
          patientName: patient
            ? `${patient.firstName} ${patient.lastName}`.trim()
            : undefined,
          visits,
        },
        (delta) => {
          streamed += delta;
          setSummary(streamed);
        },
      );
      if (!result?.ok || !result.summary) {
        setSummaryError(result?.error || 'Summary failed');
        setSummary(null);
        return;
      }
      setSummary(result.summary);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Summary failed');
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  if (isLoading) return <Box sx={{ p: 2 }}><ListCardsSkeleton count={5} /></Box>;
  if (items.length === 0) return <EmptyState icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 40 }} />} text="No prescriptions found." />;

  return (
    <>
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {items.length} prescription{items.length === 1 ? '' : 's'}
        </Typography>
        {can('ai') && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeOutlinedIcon />}
            loading={summaryLoading}
            onClick={() => void handleSummarize()}
            sx={{ borderRadius: 1 }}
          >
            AI Summarize
          </Button>
        )}
      </Stack>
      {can('ai') && summaryError && <Alert severity="error" onClose={() => setSummaryError(null)}>{summaryError}</Alert>}
      {can('ai') && summary !== null && (
        <Alert
          severity="info"
          icon={<AutoAwesomeOutlinedIcon fontSize="inherit" />}
          onClose={() => setSummary(null)}
          sx={{ whiteSpace: 'pre-wrap', alignItems: 'flex-start' }}
        >
          <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
            AI visit summary — verify clinically
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {summary || (summaryLoading ? '…' : '')}
          </Typography>
        </Alert>
      )}
      {items.map((item) => {
        const pr = item.prescription;
        const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
        const title = pr.thumbName?.trim() || pr.diagnosis || 'Prescription Entry';
        const thumbSrc = pr.thumbnail ? `data:image/png;base64,${pr.thumbnail}` : null;
        return (
        <Box
          key={pr.id}
          onClick={() => setPrintItem({
            prescription: pr,
            doctor: item.doctor ?? { firstName: '', lastName: '' },
          })}
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 72,
              flexShrink: 0,
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {thumbSrc ? (
              <Box
                component="img"
                src={thumbSrc}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <MedicalServicesOutlinedIcon sx={{ fontSize: 22, color: 'primary.main' }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} fontSize={14} noWrap>{title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
              {new Date(pr.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              {doctorLabel ? ` · Dr. ${doctorLabel.replace(/^dr\.?\s*/i, '')}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Print Prescription">
              <IconButton
                size="small"
                onClick={() => setPrintItem({
                  prescription: pr,
                  doctor: item.doctor ?? { firstName: '', lastName: '' },
                })}
                sx={{ borderRadius: 1 }}
              >
                <PrintOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Chip label="Rx" size="small" color="primary" sx={{ fontSize: 10, height: 20, borderRadius: 1, fontWeight: 700 }} />
          </Stack>
        </Box>
        );
      })}
    </Box>
    {printItem && (
      <PrescriptionPrintPreview
        prescription={printItem.prescription}
        patient={patient}
        doctor={printItem.doctor}
        onClose={() => setPrintItem(null)}
      />
    )}
    </>
  );
}

export function PatientHistoryDialog({ patient, onClose }: { patient: Patient; onClose: () => void }): React.JSX.Element | null {
  const theme = useTheme();
  const { can } = useLicense();
  const [tab, setTab] = useState(0);
  const tokenPrint = usePrintAppointmentToken();
  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
  const showLab = can('labDashboard');

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list, enabled: can('managePatients') });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, enabled: can('managePatients') });
  const labOrders = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<LabOrder[]>,
    enabled: can('managePatients') && showLab,
  });
  if (!can('managePatients')) return null;
  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
  const completedAppointments = patientAppointments.filter((a) => a.status === 'COMPLETED').length;
  const medicalTab = showLab ? 3 : 2;
  const documentsTab = showLab ? 4 : 3;
  const prescriptionsTab = showLab ? 5 : 4;
  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  return (
    <Dialog
      open
      fullWidth
      maxWidth="lg"
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '28px',
          overflow: 'hidden',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 650,
          maxHeight: '90vh',
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: 'background.default', flexShrink: 0 }}>
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2.75,
              borderRadius: '24px',
              background: `linear-gradient(145deg, ${darken(theme.palette.primary.main, 0.12)} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.primary.light} 100%)`,
              color: theme.palette.primary.contrastText,
              boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.28)}`,
              border: 'none',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ width: 58, height: 58, bgcolor: alpha('#fff', 0.2), color: '#fff', fontSize: 20, fontWeight: 900, border: `2px solid ${alpha('#fff', 0.35)}` }}>
                  {initials}
                </Avatar>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6" fontWeight={900}>{patient.firstName} {patient.lastName}</Typography>
                    {patient.mrNumber && (
                      <Chip label={`MR# ${patient.mrNumber}`} size="small" sx={{ height: 22, fontWeight: 700, bgcolor: alpha('#fff', 0.18), color: '#fff', borderRadius: 1 }} />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.88, mt: 0.35 }}>Medical & treatment history</Typography>
                </Box>
              </Stack>
              <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2, fontWeight: 700, bgcolor: alpha('#fff', 0.16), color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: alpha('#fff', 0.24), boxShadow: 'none' } }}>
                Close
              </Button>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: showLab ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' } }}>
            {[
              { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon />, bg: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main },
              { label: 'Completed', value: completedAppointments, icon: <MonitorHeartOutlinedIcon />, bg: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.dark },
              ...(showLab
                ? [{ label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon />, bg: alpha(theme.palette.info.main, 0.12), color: theme.palette.info.dark }]
                : []),
              { label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon />, bg: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.dark },
              { label: 'Paid', value: money(totalPaid), icon: <ReceiptOutlinedIcon />, bg: alpha(theme.palette.info.main, 0.12), color: theme.palette.info.dark },
            ].map((card) => (
              <Paper key={card.label} elevation={0} sx={{ p: 2.1, ...softCard, bgcolor: card.bg, border: 'none' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography sx={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</Typography>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>
                      {card.label}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(card.color, 0.15), color: card.color }}>
                    {card.icon}
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2.5, borderBottom: 1, borderColor: 'divider', minHeight: 48, flexShrink: 0,
          '& .MuiTab-root': { minHeight: 48, fontSize: 13, fontWeight: 700, textTransform: 'none', gap: 0.75 },
        }}
      >
        <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Appointments" />
        <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Billing" />
        {showLab && (
          <Tab icon={<BiotechOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Lab (${patientLab.length})`} />
        )}
        <Tab icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Medical Info" />
        <Tab icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Documents" />
        <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Prescriptions" />
      </Tabs>

      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {tab === 0 && (
          patientAppointments.length === 0
            ? <EmptyState icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 40 }} />} text="No appointments found." />
            : <AppointmentVisitList
                appointments={[...patientAppointments].sort(
                  (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
                )}
                onPrint={tokenPrint.printFor}
                printingId={tokenPrint.printingId}
                showNotes
              />
        )}

        {tab === 1 && (
          patientInvoices.length === 0
            ? <EmptyState icon={<ReceiptOutlinedIcon sx={{ fontSize: 40 }} />} text="No invoices found." />
            : <Stack spacing={1} sx={{ p: 2 }}>
                {[...patientInvoices]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((inv) => (
                    <Box
                      key={inv.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: alpha(theme.palette.warning.main, 0.03),
                        border: '1px solid',
                        borderColor: 'divider',
                        borderLeft: '4px solid',
                        borderLeftColor:
                          inv.status === 'PAID'
                            ? 'success.main'
                            : inv.status === 'PARTIALLY_PAID'
                              ? 'warning.main'
                              : inv.status === 'VOID' || inv.status === 'REFUNDED'
                                ? 'error.main'
                                : 'info.main',
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark', fontSize: 11, fontWeight: 800 }}>
                        {inv.invoiceNumber.slice(-4)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize={14} color="primary.main">{inv.invoiceNumber}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(inv.createdAt).toLocaleDateString()} · Paid {money(Number(inv.amountPaid ?? 0))}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography fontWeight={800} fontSize={14}>{money(Number(inv.total))}</Typography>
                        <Chip
                          label={inv.status.replace('_', ' ')}
                          size="small"
                          color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                          sx={{ ...chipSx, borderRadius: 1, fontWeight: 700, mt: 0.25 }}
                        />
                      </Box>
                    </Box>
                  ))}
              </Stack>
        )}

        {showLab && tab === 2 && (
          patientLab.length === 0
            ? <EmptyState icon={<BiotechOutlinedIcon sx={{ fontSize: 40 }} />} text="Lab test orders for this patient will show here." />
            : <Stack spacing={1} sx={{ p: 2 }}>
                {[...patientLab]
                  .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
                  .map((o) => <LabOrderHistoryCard key={o.id} order={o} />)}
              </Stack>
        )}

        {tab === medicalTab && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              {[
                { label: 'Blood Group',        value: patient.bloodGroup },
                { label: 'Allergies',           value: patient.allergies },
                { label: 'Chronic Conditions',  value: patient.chronicConditions },
              ].map(({ label, value }) => (
                <Paper key={label} elevation={0} sx={{ p: 2, ...softCard, borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
                  <Typography sx={{ mt: 0.5, fontWeight: value ? 700 : 400, color: value ? 'text.primary' : 'text.disabled' }}>
                    {value || '—'}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {tab === documentsTab && <PatientDocumentsPanel patient={patient} />}
        {tab === prescriptionsTab && <PrescriptionsTab patientId={patient.id} patient={patient} />}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default', flexShrink: 0, gap: 1 }}>
        <PatientWhatsAppButton patient={patient} />
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>Close</Button>
      </DialogActions>
      {tokenPrint.printToken && (
        <TokenPrintPreview token={tokenPrint.printToken} onClose={tokenPrint.closePrint} />
      )}
    </Dialog>
  );
}
