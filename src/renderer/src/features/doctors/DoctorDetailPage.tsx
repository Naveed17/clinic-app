import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider,
  IconButton, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Doctor } from '@/types/doctor';
import { DoctorEditDialog } from './DoctorEditDialog';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface AttendanceRecord { date: string; checkInAt: string; checkOutAt: string | null }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function diffHours(checkIn: string, checkOut: string | null) {
  if (!checkOut) return null;
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000;
  return diff.toFixed(1);
}

export function DoctorDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const doctorQuery = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => window.clinic.doctors.getOne(id!),
    enabled: Boolean(id),
  });

  const attendanceQuery = useQuery<AttendanceRecord[]>({
    queryKey: ['doctor-attendance', id, year, month],
    queryFn: () => window.clinic.doctors.attendance(id!, year, month),
    enabled: Boolean(id),
  });

  const doctor = doctorQuery.data as (Doctor & { schedules: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]; totalAppointments: number; todayTokens: number }) | undefined;
  const attendance = attendanceQuery.data ?? [];
  const presentDays = attendance.length;
  const lastDay = new Date(year, month, 0).getDate();

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const n = new Date(); 
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  if (doctorQuery.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }
  if (!doctor) {
    return <Alert severity="error">Doctor not found.</Alert>;
  }

  const initials = `${doctor.firstName[0]}${doctor.lastName[0]}`.toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/doctors')} size="small"><ArrowBackOutlinedIcon /></IconButton>
        <Typography variant="body2" color="text.secondary">Back to Doctors</Typography>
      </Box>

      {/* Header card */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" gap={2.5} flexWrap="wrap">
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 22, fontWeight: 800 }}>{initials}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight={700}>Dr. {doctor.firstName} {doctor.lastName}</Typography>
              <Chip
                size="small"
                label={doctor.isActive ? 'Active' : 'Inactive'}
                color={doctor.isActive ? 'success' : 'default'}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
              {doctor.doctorProfile?.specialization ?? '—'}
            </Typography>
          </Box>
          <Tooltip title="Edit">
            <Button startIcon={<EditOutlinedIcon />} variant="outlined" onClick={() => setEditOpen(true)}>Edit</Button>
          </Tooltip>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {/* Account Info */}
        <Paper sx={{ p: 3 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Account Info</Typography>
          <Stack spacing={1.5} divider={<Divider />}>
            <InfoRow label="Email" value={doctor.email} />
            <InfoRow label="Joined" value={new Date(doctor.createdAt).toLocaleDateString()} />
            <InfoRow label="Status" value={doctor.isActive ? 'Active' : 'Inactive'} />
          </Stack>
        </Paper>

        {/* Professional info */}
        <Paper sx={{ p: 3 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Professional Info</Typography>
          <Stack spacing={1.5} divider={<Divider />}>
            <InfoRow label="Specialization" value={doctor.doctorProfile?.specialization ?? '—'} />
            <InfoRow label="Qualification" value={doctor.doctorProfile?.qualification ?? '—'} />
            <InfoRow label="Experience" value={doctor.doctorProfile?.experienceYears != null ? `${doctor.doctorProfile.experienceYears} years` : '—'} />
            <InfoRow label="Phone" value={doctor.doctorProfile?.phone ?? '—'} />
            {doctor.doctorProfile?.bio && <InfoRow label="Bio" value={doctor.doctorProfile.bio} />}
          </Stack>
        </Paper>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>Total Appointments</Typography>
          <Typography sx={{ fontSize: 36, fontWeight: 800, mt: 0.5 }}>{doctor.totalAppointments}</Typography>
          <Typography variant="caption" color="text.secondary">All time</Typography>
        </Paper>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>Today's Tokens</Typography>
          <Typography sx={{ fontSize: 36, fontWeight: 800, mt: 0.5 }}>{doctor.todayTokens}</Typography>
          <Typography variant="caption" color="text.secondary">{new Date().toLocaleDateString()}</Typography>
        </Paper>
      </Box>

      {/* Weekly schedule */}
      <Paper sx={{ p: 3 }}>
        <Typography fontWeight={700} sx={{ mb: 2 }}>Weekly Schedule</Typography>
        <Stack spacing={1}>
          {DAYS.map((day, i) => {
            const slot = doctor.schedules.find(s => s.dayOfWeek === i);
            const active = slot?.isActive ?? false;
            return (
              <Box key={day} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: active ? 1 : 0.45 }}>
                <Typography fontSize={13} fontWeight={600} sx={{ width: 36 }}>{day}</Typography>
                <Box sx={{ flex: 1 }}>
                  {active && slot ? (
                    <Typography fontSize={12.5} color="text.secondary">{slot.startTime} – {slot.endTime}</Typography>
                  ) : (
                    <Typography fontSize={12.5} color="text.disabled">Off</Typography>
                  )}
                </Box>
                <Chip label={active ? 'On' : 'Off'} size="small" color={active ? 'success' : 'default'} sx={{ fontSize: 11, fontWeight: 700, minWidth: 40 }} />
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {/* Monthly Attendance */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
          <Box>
            <Typography fontWeight={700}>Monthly Attendance</Typography>
            <Typography variant="body2" color="text.secondary">
              {presentDays} day{presentDays !== 1 ? 's' : ''} present out of {lastDay} in {MONTHS[month - 1]} {year}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Button size="small" onClick={prevMonth} sx={{ minWidth: 32 }}>‹</Button>
            <Typography fontWeight={600} fontSize={14}>{MONTHS[month - 1]} {year}</Typography>
            <Button size="small" onClick={nextMonth} sx={{ minWidth: 32 }}>›</Button>
          </Stack>
        </Stack>

        {attendanceQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : attendance.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No attendance records for this month.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
            {attendance.map((rec) => {
              const d = new Date(rec.date + 'T00:00:00');
              const hours = diffHours(rec.checkInAt, rec.checkOutAt);
              return (
                <Box key={rec.date} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Typography fontSize={12} fontWeight={700} color="text.secondary">
                    {DAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}
                  </Typography>
                  <Stack direction="row" gap={1} sx={{ mt: 0.75 }} flexWrap="wrap">
                    <Chip label={`In: ${formatTime(rec.checkInAt)}`} size="small" color="success" variant="outlined" sx={{ fontSize: 11, fontWeight: 600 }} />
                    {rec.checkOutAt
                      ? <Chip label={`Out: ${formatTime(rec.checkOutAt)}`} size="small" color="primary" variant="outlined" sx={{ fontSize: 11, fontWeight: 600 }} />
                      : <Chip label="Still in" size="small" color="warning" variant="outlined" sx={{ fontSize: 11, fontWeight: 600 }} />
                    }
                  </Stack>
                  {hours && (
                    <Typography fontSize={11.5} color="text.secondary" sx={{ mt: 0.5 }}>{hours} hrs</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <DoctorEditDialog open={editOpen} doctorId={id!} onClose={() => setEditOpen(false)} />
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}
