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
  DialogContent, Divider, IconButton, Paper, Snackbar, Alert, Stack, Tab, Tabs, TableContainer, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Prescription } from '@/types/token';
import { tableSx, chipSx, Table, TableBody, TableCell, TableHead, TableRow } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import type { Patient } from '@/types/patient';
import { useAuth } from '@/features/auth/AuthContext';
import { DocViewerDialog, type DocViewerData } from './DocViewerDialog';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';

type DocItem = { id: string; name: string; filePath: string; uploadedAt: string };

const apptStatusColor: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'default', NO_SHOW: 'error',
};

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }): React.JSX.Element {
  return (
    <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'text.disabled' }}>
      <Box sx={{ fontSize: 40 }}>{icon}</Box>
      <Typography fontSize={13} color="text.secondary">{text}</Typography>
    </Box>
  );
}

function PrescriptionsTab({ patientId, patient }: { patientId: string; patient?: Patient }): React.JSX.Element {
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
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item) => {
        const pr = item.prescription;
        const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
        return (
        <Paper key={pr.id} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              {pr.diagnosis && <Typography fontWeight={700} fontSize={14}>{pr.diagnosis}</Typography>}
              <Typography variant="caption" color="text.secondary">
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
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <PrintOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Chip label="Prescription" size="small" color="primary" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
            </Stack>
          </Box>
          {pr.medicines.length > 0 && (
            <Box sx={{ mb: 1 }}>
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
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advice</Typography>
              <Typography variant="body2">{pr.advice}</Typography>
            </Box>
          )}
        </Paper>
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
  const [viewerDoc, setViewerDoc] = useState<DocViewerData | null>(null);
  const [waSnack, setWaSnack] = useState<{ open: boolean; success: boolean; msg: string }>({ open: false, success: true, msg: '' });
  const [waSending, setWaSending] = useState<string | null>(null); // doc id being sent

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] }),
  });

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={{ sx: { borderRadius: 1, overflow: 'hidden' } }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03) }}>
        <Avatar sx={{ width: 52, height: 52, bgcolor: 'primary.main', fontSize: 20, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{initials}</Avatar>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={700}>{patient.firstName} {patient.lastName}</Typography>
            {patient.mrNumber && (
              <Chip label={`MR# ${patient.mrNumber}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: 10.5, height: 20 }} />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">Medical & Treatment History</Typography>
        </Box>
      </Box>
      <Divider />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider', minHeight: 44,
          '& .MuiTab-root': { minHeight: 44, fontSize: 13, fontWeight: 600, textTransform: 'none', gap: 0.75 },
        }}
      >
        <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Appointments" />
        <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Billing" />
        <Tab icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Medical Info" />
        <Tab icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Documents" />
        <Tab icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Prescriptions" />
      </Tabs>

      <DialogContent sx={{ p: 0, minHeight: 320 }}>
        {tab === 0 && (
          patientAppointments.length === 0
            ? <EmptyState icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 40 }} />} text="No appointments found." />
            : <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
                <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
                  <TableHead sx={tableSx.head}>
                    <TableRow>
                      {['Date & Time', 'Doctor', 'Reason', 'Status', 'Notes'].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientAppointments.map((a) => (
                      <TableRow key={a.id} sx={tableSx.row}>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{new Date(a.startsAt).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Dr. {a.provider.firstName} {a.provider.lastName}</TableCell>
                        <TableCell>{a.reason ?? '—'}</TableCell>
                        <TableCell>
                          <Chip label={a.status.replace('_', ' ')} size="small" color={apptStatusColor[a.status] ?? 'default'} sx={chipSx} />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{a.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
        )}

        {tab === 1 && (
          patientInvoices.length === 0
            ? <EmptyState icon={<ReceiptOutlinedIcon sx={{ fontSize: 40 }} />} text="No invoices found." />
            : <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
                <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
                  <TableHead sx={tableSx.head}>
                    <TableRow>
                      {['Invoice', 'Date', 'Status', 'Total', 'Paid'].map((h, i) => (
                        <TableCell key={h} align={i >= 3 ? 'right' : 'left'}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientInvoices.map((inv) => (
                      <TableRow key={inv.id} sx={tableSx.row}>
                        <TableCell><Typography fontSize={12.5} fontWeight={700} color="primary.main">{inv.invoiceNumber}</Typography></TableCell>
                        <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip label={inv.status.replace('_', ' ')} size="small"
                            color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                            sx={chipSx} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{money(Number(inv.total))}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{money(Number(inv.amountPaid ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
        )}

        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              {[
                { label: 'Blood Group',        value: patient.bloodGroup },
                { label: 'Allergies',           value: patient.allergies },
                { label: 'Chronic Conditions',  value: patient.chronicConditions },
              ].map(({ label, value }) => (
                <Paper key={label} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
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
          <Box sx={{ p: 2.5 }}>
            {!isAdmin && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  startIcon={uploadMutation.isPending ? <CircularProgress size={14} /> : <AttachFileOutlinedIcon />}
                  disabled={uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                  variant="outlined"
                  size="small"
                  sx={{ borderRadius: 1 }}
                >
                  Upload file
                </Button>
              </Box>
            )}
            {docs.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : (docs.data ?? []).length === 0 ? (
              <EmptyState icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 40 }} />} text="No documents uploaded." />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 2 }}>
                {(docs.data ?? []).map((doc) => (
                  <Paper key={doc.id} variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden', '&:hover .doc-actions': { opacity: 1 } }}>
                    <Box sx={{ height: 90, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                            <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(211,47,47,0.7)' } }} onClick={() => deleteMutation.mutate(doc.id)}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ px: 1.25, py: 1 }}>
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

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1 }}>Close</Button>
      </DialogActions>
      {viewerDoc && <DocViewerDialog doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
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
