import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import {
  Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, Divider, IconButton, Paper, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import type { Patient } from '@/types/patient';
import { DocViewerDialog, type DocViewerData } from './DocViewerDialog';

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

export function PatientHistoryDialog({ patient, onClose }: { patient: Patient; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
  const [viewerDoc, setViewerDoc] = useState<DocViewerData | null>(null);

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
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={{ sx: { borderRadius: 1 } }}>
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: 18, fontWeight: 700 }}>{initials}</Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>{patient.firstName} {patient.lastName}</Typography>
          <Typography variant="body2" color="text.secondary">Medical History</Typography>
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
      </Tabs>

      <DialogContent sx={{ p: 0, minHeight: 320 }}>
        {tab === 0 && (
          patientAppointments.length === 0
            ? <EmptyState icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 40 }} />} text="No appointments found." />
            : <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Date & Time', 'Doctor', 'Reason', 'Status', 'Notes'].map((h) => (
                      <TableCell key={h} sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25, px: 2.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientAppointments.map((a) => (
                    <TableRow key={a.id} sx={{ '&:hover': { bgcolor: 'action.hover' }, '& td': { px: 2.5, py: 1.5, fontSize: 13.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(a.startsAt).toLocaleString()}</TableCell>
                      <TableCell>Dr. {a.provider.firstName} {a.provider.lastName}</TableCell>
                      <TableCell>{a.reason ?? '—'}</TableCell>
                      <TableCell>
                        <Chip label={a.status.replace('_', ' ')} size="small" color={apptStatusColor[a.status] ?? 'default'}
                          sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 22, border: '1px solid', '& .MuiChip-label': { px: 1 } }} />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{a.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
        )}

        {tab === 1 && (
          patientInvoices.length === 0
            ? <EmptyState icon={<ReceiptOutlinedIcon sx={{ fontSize: 40 }} />} text="No invoices found." />
            : <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Invoice', 'Date', 'Status', 'Total', 'Paid'].map((h, i) => (
                      <TableCell key={h} align={i >= 3 ? 'right' : 'left'} sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25, px: 2.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientInvoices.map((inv) => (
                    <TableRow key={inv.id} sx={{ '&:hover': { bgcolor: 'action.hover' }, '& td': { px: 2.5, py: 1.5, fontSize: 13.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                      <TableCell><Typography fontSize={13.5} fontWeight={600}>{inv.invoiceNumber}</Typography></TableCell>
                      <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip label={inv.status.replace('_', ' ')} size="small"
                          color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                          sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 22, border: '1px solid', '& .MuiChip-label': { px: 1 } }} />
                      </TableCell>
                      <TableCell align="right"><Typography fontSize={13.5} fontWeight={700}>{money(Number(inv.total))}</Typography></TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{money(Number(inv.amountPaid ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                startIcon={uploadMutation.isPending ? <CircularProgress size={14} /> : <AttachFileOutlinedIcon />}
                disabled={uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
                variant="outlined"
                size="small"
                sx={{ borderRadius: 2 }}
              >
                Upload file
              </Button>
            </Box>
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
                        <Tooltip title="Delete">
                          <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(211,47,47,0.7)' } }} onClick={() => deleteMutation.mutate(doc.id)}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
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
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Close</Button>
      </DialogActions>
      {viewerDoc && <DocViewerDialog doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
    </Dialog>
  );
}
