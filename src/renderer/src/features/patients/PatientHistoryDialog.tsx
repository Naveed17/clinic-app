import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, IconButton, Paper, Snackbar, Alert, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Prescription } from '@/types/token';
import { chipSx } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import type { Patient } from '@/types/patient';
import { useAuth } from '@/features/auth/AuthContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { DocViewerDialog, type DocViewerData } from './DocViewerDialog';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { ConfirmDialog } from '@/components/DialogUI';

type DocItem = { id: string; name: string; filePath: string; uploadedAt: string };

const apptStatusColor: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'default', NO_SHOW: 'error',
};

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
  type PrintItem = {
    prescription: Prescription;
    doctor: { firstName: string; lastName: string };
  };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);
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

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (items.length === 0) return <EmptyState icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 40 }} />} text="No prescriptions found." />;

  return (
    <>
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item) => {
        const pr = item.prescription;
        const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
        return (
        <Box
          key={pr.id}
          sx={{
            p: 1.75,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography fontWeight={700} fontSize={14}>{pr.diagnosis || 'Prescription Entry'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {new Date(pr.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                {doctorLabel ? ` · Dr. ${doctorLabel.replace(/^dr\.?\s*/i, '')}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
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
          {pr.medicines.length > 0 && (
            <Box sx={{ mb: 1, p: 1.25, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Medicines</Typography>
              {pr.medicines.map((m, i) => (
                <Typography key={i} variant="body2" sx={{ mt: 0.25 }}>
                  {i + 1}. <strong>{m.name}</strong> — {m.dosage} · {m.duration}{m.instructions ? ` · ${m.instructions}` : ''}
                </Typography>
              ))}
            </Box>
          )}
          {pr.tests.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lab Tests</Typography>
              <Typography variant="body2">{pr.tests.join(', ')}</Typography>
            </Box>
          )}
          {pr.advice && (
            <Box sx={{ p: 1.1, bgcolor: alpha(theme.palette.info.main, 0.06), borderRadius: 1, borderLeft: `3px solid ${theme.palette.info.main}` }}>
              <Typography variant="caption" fontWeight={700} color="info.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advice</Typography>
              <Typography variant="body2">{pr.advice}</Typography>
            </Box>
          )}
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

export function PatientHistoryDialog({ patient, onClose }: { patient: Patient; onClose: () => void }): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
  const [viewerDoc, setViewerDoc] = useState<DocViewerData | null>(null);
  const [waSnack, setWaSnack] = useState<{ open: boolean; success: boolean; msg: string }>({ open: false, success: true, msg: '' });
  const [waSending, setWaSending] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const { isOnline: isOnlineDb } = useDatabaseMode();

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list });
  const docs = useQuery<DocItem[]>({
    queryKey: ['patient-docs', patient.id],
    queryFn: () => window.clinic.docs.patient.list(patient.id),
  });
  const uploadMutation = useMutation({
    mutationFn: () => window.clinic.docs.patient.upload(patient.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.docs.patient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] });
      setDeleteDocId(null);
    },
  });

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
  const completedAppointments = patientAppointments.filter((a) => a.status === 'COMPLETED').length;
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

          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {[
              { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon />, bg: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main },
              { label: 'Completed', value: completedAppointments, icon: <MonitorHeartOutlinedIcon />, bg: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.dark },
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
        <Tab icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Medical Info" />
        <Tab icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Documents" />
        <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Prescriptions" />
      </Tabs>

      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', bgcolor: 'background.default' }}>
        {tab === 0 && (
          patientAppointments.length === 0
            ? <EmptyState icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 40 }} />} text="No appointments found." />
            : <Stack spacing={1} sx={{ p: 2 }}>
                {[...patientAppointments]
                  .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                  .map((a) => (
                    <Box
                      key={a.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        border: '1px solid',
                        borderColor: 'divider',
                        borderLeft: '4px solid',
                        borderLeftColor:
                          a.status === 'SCHEDULED'
                            ? 'primary.main'
                            : a.status === 'CHECKED_IN'
                              ? 'warning.main'
                              : a.status === 'COMPLETED'
                                ? 'success.main'
                                : a.status === 'NO_SHOW'
                                  ? 'error.main'
                                  : 'divider',
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                          <Box>
                            <Typography fontWeight={700} fontSize={14}>
                              {new Date(a.startsAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.15 }}>
                              Dr. {a.provider.firstName} {a.provider.lastName}
                              {a.reason ? ` · ${a.reason}` : ''}
                            </Typography>
                          </Box>
                          <Chip label={a.status.replace('_', ' ')} size="small" color={apptStatusColor[a.status] ?? 'default'} sx={{ ...chipSx, borderRadius: 1, fontWeight: 700 }} />
                        </Stack>
                        {a.notes && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 13 }}>
                            {a.notes}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
              </Stack>
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
                              : inv.status === 'VOID'
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

        {tab === 2 && (
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

        {tab === 3 && (
          <Box sx={{ p: 2 }}>
            {isOnlineDb ? (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                File documents are not available in online database mode yet (cloud file storage coming soon).
              </Alert>
            ) : !isAdmin ? (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <Button
                  startIcon={<AttachFileOutlinedIcon />}
                  loading={uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                  variant="contained"
                  size="small"
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  Upload file
                </Button>
              </Box>
            ) : null}
            {isOnlineDb ? (
              <EmptyState icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 40 }} />} text="Cloud file storage coming soon." />
            ) : docs.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : (docs.data ?? []).length === 0 ? (
              <EmptyState icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 40 }} />} text="No documents uploaded." />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
                {(docs.data ?? []).map((doc) => (
                  <Paper key={doc.id} elevation={0} sx={{ ...softCard, borderRadius: 1, overflow: 'hidden', '&:hover .doc-actions': { opacity: 1 } }}>
                    <Box sx={{ height: 96, bgcolor: alpha(theme.palette.primary.main, 0.05), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', opacity: 0.7 }} />
                      <Box className="doc-actions" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, opacity: 0, transition: 'opacity 0.15s' }}>
                        <Tooltip title="Open">
                          <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }} onClick={async () => {
                            const result = await window.clinic.docs.patient.open(doc.id);
                            if (result) setViewerDoc(result);
                          }}>
                            <FolderOpenOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Share on WhatsApp">
                          <IconButton
                            size="small"
                            disabled={waSending === doc.id}
                            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(37,211,102,0.8)' } }}
                            onClick={async () => {
                              setWaSending(doc.id);
                              const res = await window.clinic.docs.patient.whatsapp(doc.id, patient.phone ?? '') as { success: boolean; error?: string };
                              setWaSending(null);
                              setWaSnack({
                                open: true,
                                success: res.success,
                                msg: res.success ? 'Document sent on WhatsApp!' : (res.error as string) ?? 'Failed to send.',
                              });
                            }}
                          >
                            {waSending === doc.id
                              ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                              : <WhatsAppIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                        {!isAdmin && (
                          <Tooltip title="Delete">
                            <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(211,47,47,0.7)' } }} onClick={() => setDeleteDocId(doc.id)}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ px: 1.25, py: 1.1 }}>
                      <Typography fontSize={12} fontWeight={600} noWrap title={doc.name}>{doc.name}</Typography>
                      <Typography fontSize={11} color="text.disabled">{new Date(doc.uploadedAt).toLocaleDateString()}</Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}
        {tab === 4 && <PrescriptionsTab patientId={patient.id} patient={patient} />}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default', flexShrink: 0 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>Close</Button>
      </DialogActions>
      {viewerDoc && <DocViewerDialog doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
      <ConfirmDialog
        open={Boolean(deleteDocId)}
        title="Delete document?"
        message="Remove this document from the patient record?"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteDocId(null)}
        onConfirm={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
      />
      <Snackbar
        open={waSnack.open}
        autoHideDuration={4000}
        onClose={() => setWaSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={waSnack.success ? 'success' : 'error'} onClose={() => setWaSnack((s) => ({ ...s, open: false }))}>
          {waSnack.msg}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
