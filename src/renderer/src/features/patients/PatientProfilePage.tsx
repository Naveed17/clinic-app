import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider,
  IconButton, Paper, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { PatientDialog } from './PatientDialog';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

const apptStatusColor: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'primary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'default', NO_SHOW: 'error',
};

export function PatientProfilePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, id }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
  });
  const patient = (patientsQuery.data?.data ?? []).find((p) => p.id === id);

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list });
  const labOrders = useQuery<{ id: string; test: string; status: string; result: string | null; orderedAt: string; patientId: string }[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<{ id: string; test: string; status: string; result: string | null; orderedAt: string; patientId: string }[]>,
  });

  if (patientsQuery.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }
  if (!patient) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Patient not found.</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/patients')}>Back</Button>
      </Box>
    );
  }

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((s, i) => s + Number(i.total), 0);

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Back to patients">
            <IconButton onClick={() => navigate('/patients')} size="small">
              <ArrowBackOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" fontWeight={700}>Patient Profile</Typography>
        </Box>

        {/* Profile card */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 26, fontWeight: 700 }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h6" fontWeight={700}>{patient.firstName} {patient.lastName}</Typography>
                {patient.bloodGroup && (
                  <Chip label={patient.bloodGroup} size="small" color="error" variant="outlined" sx={{ fontWeight: 700, fontSize: 11 }} />
                )}
              </Box>
              <Stack direction="row" gap={3} sx={{ mt: 1, flexWrap: 'wrap' }}>
                {[
                  { label: 'Phone', value: patient.phone },
                  { label: 'Email', value: patient.email },
                  { label: 'DOB', value: patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : null },
                  { label: 'Address', value: patient.address },
                ].map(({ label, value }) => value ? (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                    <Typography fontSize={13.5}>{value}</Typography>
                  </Box>
                ) : null)}
              </Stack>
            </Box>
            <Button startIcon={<EditOutlinedIcon />} variant="outlined" size="small" sx={{ borderRadius: 2 }} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </Box>

          {/* Stats row */}
          <Divider sx={{ my: 2.5 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2 }}>
            {[
              { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} /> },
              { label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon sx={{ fontSize: 20, color: 'secondary.main' }} /> },
              { label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon sx={{ fontSize: 20, color: 'warning.main' }} /> },
              { label: 'Total Paid', value: money(totalPaid), icon: <ReceiptOutlinedIcon sx={{ fontSize: 20, color: 'success.main' }} /> },
            ].map(({ label, value, icon }) => (
              <Paper key={label} variant="outlined" sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {icon}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>{label}</Typography>
                  <Typography fontWeight={700} fontSize={15}>{value}</Typography>
                </Box>
              </Paper>
            ))}
          </Box>

          {/* Medical info */}
          {(patient.allergies || patient.chronicConditions) && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {patient.allergies && (
                  <Box>
                    <Typography variant="caption" color="error" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allergies</Typography>
                    <Typography fontSize={13.5}>{patient.allergies}</Typography>
                  </Box>
                )}
                {patient.chronicConditions && (
                  <Box>
                    <Typography variant="caption" color="warning.main" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chronic Conditions</Typography>
                    <Typography fontSize={13.5}>{patient.chronicConditions}</Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Paper>

        {/* Tabs */}
        <Paper sx={{ overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: 1, borderColor: 'divider', minHeight: 44,
              '& .MuiTab-root': { minHeight: 44, fontSize: 13, fontWeight: 600, textTransform: 'none', gap: 0.75 },
            }}
          >
            <Tab icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Appointments (${patientAppointments.length})`} />
            <Tab icon={<ReceiptOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Billing (${patientInvoices.length})`} />
            <Tab icon={<BiotechOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Lab (${patientLab.length})`} />
          </Tabs>

          <Box sx={{ minHeight: 200 }}>
            {tab === 0 && (
              patientAppointments.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No appointments found.</Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Date & Time', 'Doctor', 'Reason', 'Status'].map((h) => (
                        <TableCell key={h} sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25, px: 2.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientAppointments.map((a) => (
                      <TableRow key={a.id} sx={{ '& td': { px: 2.5, py: 1.5, fontSize: 13.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(a.startsAt).toLocaleString()}</TableCell>
                        <TableCell>Dr. {a.provider.firstName} {a.provider.lastName}</TableCell>
                        <TableCell>{a.reason ?? '—'}</TableCell>
                        <TableCell>
                          <Chip label={a.status.replace('_', ' ')} size="small" color={apptStatusColor[a.status] ?? 'default'}
                            sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 22 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}

            {tab === 1 && (
              patientInvoices.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No invoices found.</Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Invoice #', 'Date', 'Status', 'Total', 'Paid'].map((h, i) => (
                        <TableCell key={h} align={i >= 3 ? 'right' : 'left'} sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25, px: 2.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientInvoices.map((inv) => (
                      <TableRow key={inv.id} sx={{ '& td': { px: 2.5, py: 1.5, fontSize: 13.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                        <TableCell><Typography fontSize={13.5} fontWeight={600}>{inv.invoiceNumber}</Typography></TableCell>
                        <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip label={inv.status.replace('_', ' ')} size="small"
                            color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'default'}
                            sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 22 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{money(Number(inv.total))}</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>{money(Number(inv.amountPaid ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}

            {tab === 2 && (
              patientLab.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No lab orders found.</Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Test', 'Date', 'Status', 'Result'].map((h) => (
                        <TableCell key={h} sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25, px: 2.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientLab.map((o) => (
                      <TableRow key={o.id} sx={{ '& td': { px: 2.5, py: 1.5, fontSize: 13.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                        <TableCell sx={{ fontWeight: 600 }}>{o.test}</TableCell>
                        <TableCell>{new Date(o.orderedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip label={o.status.replace('_', ' ')} size="small"
                            color={o.status === 'COMPLETED' ? 'success' : o.status === 'IN_PROGRESS' ? 'primary' : o.status === 'CANCELLED' ? 'error' : 'warning'}
                            sx={{ borderRadius: '6px', fontWeight: 600, fontSize: 11.5, height: 22 }} />
                        </TableCell>
                        <TableCell sx={{ color: o.result ? 'text.primary' : 'text.disabled', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.result ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </Box>
        </Paper>
      </Box>

      {editOpen && patient && (
        <PatientDialog open={editOpen} patient={patient} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
