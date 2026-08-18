import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
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
import { useNavigate, useParams } from 'react-router-dom';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import type { Doctor } from '@/types/doctor';
import { DoctorEditDialog } from './DoctorEditDialog';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface AttendanceRecord {
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function diffHours(checkIn: string, checkOut: string | null) {
  if (!checkOut) return null;
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000;
  return diff.toFixed(1);
}

export function DoctorDetailPage(): React.JSX.Element {
  const theme = useTheme();
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

  const softCard = {
    borderRadius: '20px',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
  } as const;

  const doctor = doctorQuery.data as
    | (Doctor & {
      schedules: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[];
      totalAppointments: number;
      todayTokens: number;
    })
    | undefined;

  const attendance = attendanceQuery.data ?? [];
  const presentDays = attendance.length;
  const lastDay = new Date(year, month, 0).getDate();
  const activeDays = doctor?.schedules.filter((s) => s.isActive).length ?? 0;

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const n = new Date();
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  if (doctorQuery.isLoading) {
    return (
      <Stack spacing={2} sx={{ p: 1 }}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (!doctor) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Doctor not found.
        </Alert>
        <Button
          sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/doctors')}
        >
          Back to Doctors
        </Button>
      </Box>
    );
  }

  const initials = `${doctor.firstName[0]}${doctor.lastName[0]}`.toUpperCase();
  const green = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const warning = theme.palette.warning.main;
  const info = theme.palette.info.main;

  const summaryCards = [
    {
      label: 'Appointments',
      value: doctor.totalAppointments,
      note: 'All time',
      icon: <CalendarMonthOutlinedIcon fontSize="small" />,
      color: green,
    },
    {
      label: "Today's Tokens",
      value: doctor.todayTokens,
      note: new Date().toLocaleDateString(),
      icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
      color: warning,
    },
    {
      label: 'Active Days',
      value: activeDays,
      note: 'Per week',
      icon: <EventAvailableOutlinedIcon fontSize="small" />,
      color: success,
    },
    {
      label: 'Present Days',
      value: presentDays,
      note: `${MONTHS[month - 1].slice(0, 3)} ${year}`,
      icon: <WorkOutlineOutlinedIcon fontSize="small" />,
      color: info,
    },
  ];

  const infoRows = [
    { icon: <EmailOutlinedIcon sx={{ fontSize: 18 }} />, label: 'Email', value: doctor.email },
    {
      icon: <MedicalServicesOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Specialization',
      value: doctor.doctorProfile?.specialization ?? '—',
    },
    {
      icon: <SchoolOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Qualification',
      value: doctor.doctorProfile?.qualification ?? '—',
    },
    {
      icon: <WorkOutlineOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Experience',
      value:
        doctor.doctorProfile?.experienceYears != null
          ? `${doctor.doctorProfile.experienceYears} year${doctor.doctorProfile.experienceYears !== 1 ? 's' : ''}`
          : '—',
    },
    {
      icon: <LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />,
      label: 'Phone',
      value: doctor.doctorProfile?.phone ?? '—',
    },
  ];

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 2 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: { sm: 'flex-end' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Tooltip title="Back to doctors">
              <IconButton
                onClick={() => navigate('/doctors')}
                size="small"
                sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <ArrowBackOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Doctor profile
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  Dr. {doctor.firstName} {doctor.lastName}
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.1,
                    py: 0.35,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: doctor.isActive ? alpha(success, 0.25) : 'divider',
                    bgcolor: doctor.isActive ? alpha(success, 0.1) : alpha(theme.palette.text.primary, 0.04),
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: doctor.isActive ? success : 'text.disabled',
                    }}
                  />
                  <Typography
                    fontSize={12}
                    fontWeight={700}
                    color={doctor.isActive ? 'success.dark' : 'text.secondary'}
                  >
                    {doctor.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
                {doctor.doctorProfile?.specialization ?? 'General practice'}
                {' · '}
                Joined {new Date(doctor.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              startIcon={<CalendarMonthOutlinedIcon />}
              variant="outlined"
              sx={{ borderRadius: 2, fontWeight: 700, px: 2, textTransform: 'none' }}
              onClick={() => navigate(`/schedule?doctorId=${doctor.id}`)}
            >
              Edit schedule
            </Button>
            <Button
              startIcon={<EditOutlinedIcon />}
              variant="contained"
              sx={{ borderRadius: 2, fontWeight: 700, px: 2.25, py: 1, textTransform: 'none' }}
              onClick={() => setEditOpen(true)}
            >
              Edit profile
            </Button>
          </Stack>
        </Box>

        {/* Summary metrics */}
        <Box
          sx={{
            display: 'grid',
            gap: 1.75,
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          }}
        >
          {summaryCards.map((c) => (
            <Paper
              key={c.label}
              elevation={0}
              sx={{
                p: 2.25,
                ...softCard,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -14,
                  right: -14,
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: alpha(c.color, 0.1),
                }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    {c.label}
                  </Typography>
                  <Typography sx={{ mt: 1.25, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mt: 0.75, display: 'block' }}>
                    {c.note}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '12px',
                    bgcolor: alpha(c.color, 0.12),
                    color: c.color,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {c.icon}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>

        {/* Main + sidebar */}
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            {/* Weekly schedule */}
            <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography fontWeight={800} letterSpacing="-0.01em">
                    Weekly Schedule
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Availability used when booking appointments & tokens
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                  onClick={() => navigate(`/schedule?doctorId=${doctor.id}`)}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                >
                  Edit
                </Button>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
              >
                {DAY_FULL.map((day, i) => {
                  const slot = doctor.schedules.find((s) => s.dayOfWeek === i);
                  const active = slot?.isActive ?? false;
                  return (
                    <Box
                      key={day}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.35,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: active ? alpha(green, 0.2) : 'divider',
                        bgcolor: active ? alpha(green, 0.05) : alpha(theme.palette.text.primary, 0.02),
                        opacity: active ? 1 : 0.72,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          fontSize: 12,
                          fontWeight: 800,
                          bgcolor: active ? alpha(green, 0.14) : alpha(theme.palette.text.primary, 0.06),
                          color: active ? green : 'text.secondary',
                        }}
                      >
                        {DAYS[i]}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={13} fontWeight={700} noWrap>
                          {day}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {active && slot ? `${slot.startTime} – ${slot.endTime}` : 'Off'}
                        </Typography>
                      </Box>
                      <Chip
                        label={active ? 'On' : 'Off'}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 1.5,
                          height: 24,
                          bgcolor: active ? alpha(success, 0.12) : alpha(theme.palette.text.primary, 0.06),
                          color: active ? 'success.dark' : 'text.secondary',
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Paper>

            {/* Monthly attendance */}
            <Paper elevation={0} sx={{ p: 2.5, ...softCard }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
                flexWrap="wrap"
                gap={1.5}
              >
                <Box>
                  <Typography fontWeight={800} letterSpacing="-0.01em">
                    Monthly Attendance
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {presentDays} day{presentDays !== 1 ? 's' : ''} present out of {lastDay} in{' '}
                    {MONTHS[month - 1]} {year}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 0.5,
                    py: 0.25,
                    bgcolor: alpha(theme.palette.common.black, 0.02),
                  }}
                >
                  <IconButton size="small" onClick={prevMonth} sx={{ borderRadius: 1.5 }}>
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <Typography fontWeight={700} fontSize={13} sx={{ minWidth: 110, textAlign: 'center' }}>
                    {MONTHS[month - 1].slice(0, 3)} {year}
                  </Typography>
                  <IconButton size="small" onClick={nextMonth} sx={{ borderRadius: 1.5 }}>
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              {attendanceQuery.isLoading ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                  {Array.from({ length: 35 }, (_, i) => (
                    <Skeleton key={i} variant="rounded" height={36} />
                  ))}
                </Box>
              ) : attendance.length === 0 ? (
                <Box
                  sx={{
                    py: 5,
                    textAlign: 'center',
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.text.primary, 0.02),
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <EventAvailableOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                  <Typography fontWeight={700} color="text.secondary">
                    No attendance this month
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Check-in records will appear here once the doctor starts seeing patients.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 1.25,
                  }}
                >
                  {attendance.map((rec) => {
                    const d = new Date(`${rec.date}T00:00:00`);
                    const hours = diffHours(rec.checkInAt, rec.checkOutAt);
                    return (
                      <Box
                        key={rec.date}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: alpha(green, 0.03),
                          borderLeft: '4px solid',
                          borderLeftColor: rec.checkOutAt ? success : warning,
                        }}
                      >
                        <Typography fontSize={12} fontWeight={700} color="text.secondary">
                          {DAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}
                        </Typography>
                        <Stack direction="row" gap={0.75} sx={{ mt: 1 }} flexWrap="wrap">
                          <Chip
                            label={`In ${formatTime(rec.checkInAt)}`}
                            size="small"
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              height: 24,
                              borderRadius: 1.5,
                              bgcolor: alpha(success, 0.12),
                              color: 'success.dark',
                            }}
                          />
                          {rec.checkOutAt ? (
                            <Chip
                              label={`Out ${formatTime(rec.checkOutAt)}`}
                              size="small"
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 24,
                                borderRadius: 1.5,
                                bgcolor: alpha(green, 0.12),
                                color: 'primary.dark',
                              }}
                            />
                          ) : (
                            <Chip
                              label="Still in"
                              size="small"
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 24,
                                borderRadius: 1.5,
                                bgcolor: alpha(warning, 0.14),
                                color: 'warning.dark',
                              }}
                            />
                          )}
                        </Stack>
                        {hours && (
                          <Typography fontSize={11.5} color="text.secondary" fontWeight={600} sx={{ mt: 0.75 }}>
                            {hours} hrs
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </Stack>

          {/* Sidebar profile card */}
          <Stack spacing={2.5}>
            <Paper elevation={0} sx={{ ...softCard, overflow: 'hidden' }}>
              <Box
                sx={{
                  px: 2.5,
                  pt: 2.5,
                  pb: 2,
                  background: `linear-gradient(145deg, ${alpha(green, 0.14)} 0%, ${alpha(green, 0.04)} 100%)`,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" spacing={1.75} alignItems="center">
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      fontSize: 22,
                      fontWeight: 800,
                      bgcolor: green,
                      boxShadow: `0 8px 20px ${alpha(green, 0.35)}`,
                    }}
                  >
                    {initials}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800} fontSize={16} noWrap letterSpacing="-0.01em">
                      Dr. {doctor.firstName} {doctor.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap sx={{ display: 'block' }}>
                      {doctor.doctorProfile?.specialization ?? 'Doctor'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Stack spacing={0} sx={{ p: 1.25 }}>
                {infoRows.map((row) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      px: 1.25,
                      py: 1.15,
                      borderRadius: 1,
                      '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: alpha(green, 0.1),
                        color: green,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        mt: 0.15,
                      }}
                    >
                      {row.icon}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {row.label}
                      </Typography>
                      <Typography fontSize={13.5} fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                        {row.value}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>

              {doctor.doctorProfile?.bio ? (
                <Box sx={{ px: 2.5, pb: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
                    Bio
                  </Typography>
                  <Typography
                    fontSize={13}
                    color="text.secondary"
                    fontWeight={500}
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.03),
                      border: '1px solid',
                      borderColor: 'divider',
                      lineHeight: 1.55,
                    }}
                  >
                    {doctor.doctorProfile.bio}
                  </Typography>
                </Box>
              ) : null}
            </Paper>
          </Stack>
        </Box>
      </Stack>

      <DoctorEditDialog open={editOpen} doctorId={id!} onClose={() => setEditOpen(false)} />
    </>
  );
}
