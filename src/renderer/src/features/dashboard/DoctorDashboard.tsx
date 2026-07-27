import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';
import {
  alpha, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Paper, Stack, Tab, Tabs, Tooltip, Typography, useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { appointmentsService } from '@/services/appointments.service';
import { AppointmentDialog } from '@/features/appointments/AppointmentsPage';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import { PrescriptionDialog, TokenPrintPreview, IssueTokenDialog } from '@/features/tokens/TokensPage';
import type { Token } from '@/types/token';
import type { Appointment } from '@/types/appointment';

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:  '#1976d2',
  CHECKED_IN: '#ed6c02',
  COMPLETED:  '#2e7d32',
  CANCELLED:  '#9e9e9e',
  NO_SHOW:    '#d32f2f',
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  SCHEDULED:  'CHECKED_IN',
  CHECKED_IN: 'COMPLETED',
};

export function DoctorDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const theme = useTheme();
  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';

  const [prescriptionToken, setPrescriptionToken] = useState<Token | null>(null);
  const [printToken, setPrintToken] = useState<Token | null>(null);
  const [noTokenPatient, setNoTokenPatient] = useState<{ patientId: string; patientName: string } | null>(null);
  const [issueTokenOpen, setIssueTokenOpen] = useState(false);
  const [issueTokenPatientId, setIssueTokenPatientId] = useState<string | undefined>();
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [contextDate, setContextDate] = useState<string | undefined>();
  const [ctxMenu, setCtxMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [apptCtxMenu, setApptCtxMenu] = useState<{ mouseX: number; mouseY: number; appointment: Appointment } | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const { data: raw = [] } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const appointments = (raw as Appointment[]).filter((a) => a.providerId === user?.id);

  async function openPrescription(appt: Appointment) {
    const apptDate = new Date(appt.startsAt).toLocaleDateString('en-CA');
    const token = await window.clinic.tokens.getForPatient(appt.patientId, apptDate);
    if (!token) {
      setNoTokenPatient({ patientId: appt.patientId, patientName: `${appt.patient.firstName} ${appt.patient.lastName}` });
      return;
    }
    setPrescriptionToken(token);
  }

  const now = new Date();
  const upcomingQueue = appointments
    .filter((a) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(a.status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const appointmentStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment['status'] }) =>
      appointmentsService.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 2 }}>
      {/* Greeting */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Good {greeting},{' '}
            <Box component="span" sx={{ color: 'primary.main' }}>{user?.name}</Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Here's your agenda for today.
          </Typography>
        </Box>
        {/* Stats pills */}
        <Stack direction="row" spacing={1}>
          {[
            { label: 'Scheduled',  value: appointments.filter((a) => a.status === 'SCHEDULED').length,  color: theme.palette.primary.main },
            { label: 'Checked In', value: appointments.filter((a) => a.status === 'CHECKED_IN').length, color: theme.palette.warning.main },
            { label: 'Completed',  value: appointments.filter((a) => a.status === 'COMPLETED').length,  color: theme.palette.success.main },
          ].map((c) => (
            <Box key={c.label} sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: alpha(c.color, 0.1), border: '1px solid', borderColor: alpha(c.color, 0.25), textAlign: 'center' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Typography>
              <Typography variant="caption" sx={{ fontSize: 10, color: c.color, opacity: 0.8 }}>{c.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Single card with tabs */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.72),
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Tab bar */}
        <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
              borderRadius: 99,
              p: '4px',
              minHeight: 0,
              '& .MuiTabs-indicator': {
                height: '100%',
                borderRadius: 99,
                bgcolor: 'background.paper',
                boxShadow: theme.shadows[2],
                zIndex: 0,
              },
            }}
          >
            <Tab
              disableRipple
              icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 15 }} />}
              iconPosition="start"
              label="Calendar & Agenda"
              sx={{
                position: 'relative', zIndex: 1, minHeight: 0,
                px: 2.2, py: 0.85, borderRadius: 99,
                fontSize: 13, fontWeight: 500, textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': { fontWeight: 700, color: 'text.primary' },
              }}
            />
            <Tab
              disableRipple
              icon={<FormatListBulletedOutlinedIcon sx={{ fontSize: 15 }} />}
              iconPosition="start"
              label={
                <Stack direction="row" alignItems="center" gap={0.75}>
                  Live Queue
                  {upcomingQueue.length > 0 && (
                    <Box sx={{ px: 0.75, py: 0.1, borderRadius: 99, bgcolor: 'warning.main', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1.6 }}>
                      {upcomingQueue.length}
                    </Box>
                  )}
                </Stack>
              }
              sx={{
                position: 'relative', zIndex: 1, minHeight: 0,
                px: 2.2, py: 0.85, borderRadius: 99,
                fontSize: 13, fontWeight: 500, textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': { fontWeight: 700, color: 'text.primary' },
              }}
            />
          </Tabs>
        </Box>

        {/* Tab 1 — Calendar */}
        <Box sx={{ flex: 1, minHeight: 0, display: activeTab === 0 ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <AppointmentCalendar
            appointments={appointments}
            onStatusChange={(id, status) =>
              appointmentStatusMutation.mutate({ id, status: status as Appointment['status'] })
            }
            onDayContextMenu={(date, anchor) => { setContextDate(date); setCtxMenu(anchor); }}
            onAppointmentContextMenu={(appt, anchor) => setApptCtxMenu({ ...anchor, appointment: appt })}
            onAppointmentClick={(appt) => { setEditAppt(appt); setApptDialogOpen(true); }}
          />
        </Box>

        {/* Tab 2 — Live Queue */}
        <Box sx={{ flex: 1, minHeight: 0, display: activeTab === 1 ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          {upcomingQueue.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <EventOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">No upcoming appointments.</Typography>
            </Box>
          ) : (
            <Stack
              spacing={0}
              sx={{
                flex: 1,
                overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
              }}
            >
              {upcomingQueue.map((appt, idx) => {
                const start = new Date(appt.startsAt);
                const end = new Date(appt.endsAt);
                const color = STATUS_COLOR[appt.status];
                const next = NEXT_STATUS[appt.status];
                const isPast = start < now;
                const isToday = start.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
                const isCheckedIn = appt.status === 'CHECKED_IN';

                return (
                  <Box key={appt.id}>
                    {idx > 0 && <Divider />}
                    <Box
                      sx={{
                        px: 3, py: 2,
                        borderLeft: '4px solid',
                        borderLeftColor: color,
                        bgcolor: isCheckedIn ? alpha(theme.palette.warning.main, 0.05) : 'transparent',
                        opacity: isPast && appt.status === 'SCHEDULED' ? 0.55 : 1,
                        transition: 'background 0.15s',
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ width: 40, height: 40, fontSize: 13, fontWeight: 700, flexShrink: 0, bgcolor: alpha(color, 0.15), color }}>
                          {appt.patient.firstName[0]}{appt.patient.lastName[0]}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} fontSize={14} noWrap>
                            {appt.patient.firstName} {appt.patient.lastName}
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTimeOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" fontSize={12}>
                              {isToday ? '' : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} · `}
                              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                            {appt.reason && (
                              <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: 160 }}>· {appt.reason}</Typography>
                            )}
                          </Stack>
                        </Box>
                        <Stack direction="row" alignItems="center" gap={0.75} flexShrink={0}>
                          <Chip
                            size="small"
                            label={appt.status.replace('_', ' ')}
                            sx={{ bgcolor: alpha(color, 0.12), color, fontWeight: 600, fontSize: '0.68rem', borderRadius: 1, height: 22 }}
                          />
                          <Tooltip title="Edit">
                            <IconButton size="small" sx={{ p: 0.4 }} onClick={() => { setEditAppt(appt); setApptDialogOpen(true); }}>
                              <EditOutlinedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          {appt.status === 'COMPLETED' && (
                            <Tooltip title="Write Prescription">
                              <IconButton size="small" sx={{ p: 0.4 }} onClick={() => openPrescription(appt)}>
                                <MedicalServicesOutlinedIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {next && (
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={next === 'COMPLETED' ? <CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} /> : <ArrowForwardIcon sx={{ fontSize: '13px !important' }} />}
                              onClick={() => appointmentStatusMutation.mutate({ id: appt.id, status: next as Appointment['status'] })}
                              sx={{
                                fontSize: '0.7rem', py: 0.3, px: 1, borderRadius: 1,
                                borderColor: STATUS_COLOR[next], color: STATUS_COLOR[next],
                                '&:hover': { bgcolor: alpha(STATUS_COLOR[next], 0.08), borderColor: STATUS_COLOR[next] },
                              }}
                            >
                              {next === 'CHECKED_IN' ? 'Check In' : 'Complete'}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Paper>

      {prescriptionToken && <PrescriptionDialog token={prescriptionToken} onClose={() => setPrescriptionToken(null)} />}
      {printToken && <TokenPrintPreview token={printToken} onClose={() => setPrintToken(null)} />}

      {/* No token warning */}
      <Dialog open={Boolean(noTokenPatient)} onClose={() => setNoTokenPatient(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberOutlinedIcon color="warning" />
          Token Not Found
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            No token has been generated for <strong>{noTokenPatient?.patientName}</strong> today. You can issue one now or ask the receptionist.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setNoTokenPatient(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setIssueTokenPatientId(noTokenPatient?.patientId); setIssueTokenOpen(true); setNoTokenPatient(null); }}>
            Issue Token
          </Button>
        </DialogActions>
      </Dialog>

      <IssueTokenDialog
        open={issueTokenOpen}
        onClose={() => setIssueTokenOpen(false)}
        date={new Date().toLocaleDateString('en-CA')}
        defaultPatientId={issueTokenPatientId}
        defaultDoctorId={user?.id}
        onSuccess={(token) => setPrescriptionToken(token)}
      />

      {/* Appointment right-click menu */}
      <Menu
        open={Boolean(apptCtxMenu)}
        onClose={() => setApptCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={apptCtxMenu ? { top: apptCtxMenu.mouseY, left: apptCtxMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { borderRadius: 1, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' } } }}
      >
        <MenuItem dense disabled sx={{ opacity: '1 !important', pb: 0 }}>
          <ListItemText
            primary={apptCtxMenu ? `${apptCtxMenu.appointment.patient.firstName} ${apptCtxMenu.appointment.patient.lastName}` : ''}
            primaryTypographyProps={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setEditAppt(apptCtxMenu!.appointment); setApptCtxMenu(null); setApptDialogOpen(true); }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Appointment</ListItemText>
        </MenuItem>
        {apptCtxMenu?.appointment.status === 'COMPLETED' && (
          <MenuItem onClick={() => { const a = apptCtxMenu!.appointment; setApptCtxMenu(null); openPrescription(a); }}>
            <ListItemIcon><MedicalServicesOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Write Prescription</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Day right-click menu */}
      <Menu
        open={Boolean(ctxMenu)}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { borderRadius: 1, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' } } }}
      >
        <MenuItem onClick={() => { setCtxMenu(null); setEditAppt(undefined); setApptDialogOpen(true); }}>
          <ListItemIcon><EventOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>New Appointment</ListItemText>
        </MenuItem>
      </Menu>

      <AppointmentDialog
        open={apptDialogOpen}
        appointment={editAppt}
        defaultDate={contextDate}
        defaultProviderId={user?.id}
        onClose={() => { setApptDialogOpen(false); setEditAppt(undefined); }}
      />
    </Box>
  );
}
