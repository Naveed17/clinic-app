import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  alpha, Avatar, Box, Button, Chip, Divider, Fade, IconButton,
  Paper, Popper, Stack, Typography, useTheme,
} from '@mui/material';
import { useRef, useState } from 'react';
import type { Appointment } from '@/types/appointment';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let i = 0; i < first.getDay(); i++)
    days.push(new Date(year, month, -first.getDay() + i + 1));
  for (let i = 1; i <= last.getDate(); i++)
    days.push(new Date(year, month, i));
  while (days.length % 7 !== 0)
    days.push(new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1));
  return days;
}

interface Props {
  appointments: Appointment[];
  onStatusChange: (id: string, status: string) => void;
  onDateClick?: (date: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onDayContextMenu?: (date: string, anchor: { mouseX: number; mouseY: number }) => void;
  onAppointmentContextMenu?: (appointment: Appointment, anchor: { mouseX: number; mouseY: number }) => void;
}

export function AppointmentCalendar({ appointments, onStatusChange, onDateClick, onAppointmentClick, onDayContextMenu, onAppointmentContextMenu }: Props): React.JSX.Element {
  const theme = useTheme();
  const today = new Date();

  const STATUS_COLOR: Record<string, string> = {
    SCHEDULED: theme.palette.primary.main,
    CHECKED_IN: theme.palette.warning.main,
    COMPLETED: theme.palette.success.main,
    CANCELLED: theme.palette.text.disabled,
    NO_SHOW: theme.palette.error.main,
  };

  const NEXT_STATUS: Partial<Record<string, string>> = {
    SCHEDULED: 'CHECKED_IN',
    CHECKED_IN: 'COMPLETED',
  };

  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [hoveredAppt, setHoveredAppt] = useState<Appointment | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calDays = getCalendarDays(cursor.getFullYear(), cursor.getMonth());

  const selectedAppts = appointments
    .filter((a) => isSameDay(new Date(a.startsAt), selected))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  function apptsByDay(d: Date) {
    return appointments.filter((a) => isSameDay(new Date(a.startsAt), d));
  }

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        backdropFilter: 'blur(12px)',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.72),
        backgroundImage: 'none',
      }}
    >
      {/* ── Left: Calendar grid ── */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto', minWidth: 0 }}>
        {/* Month nav */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2.5 }}>
          <Typography variant="h6" fontWeight={700}>{MONTHS[cursor.getMonth()]}</Typography>
          <Typography variant="h6" fontWeight={700} color="text.secondary">{cursor.getFullYear()}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        {/* Day headers */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', mb: 1 }}>
          {DAYS.map((d) => (
            <Typography key={d} variant="caption" color="text.disabled" fontWeight={600}
              sx={{ textAlign: 'center', py: 0.5 }}>{d}</Typography>
          ))}
        </Box>

        {/* Calendar grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5 }}>
          {calDays.map((day, i) => {
            const isCurrentMonth = day.getMonth() === cursor.getMonth();
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selected);
            const dayAppts = apptsByDay(day);

            return (
              <Box
                key={i}
                onClick={() => {
                  setSelected(day);
                  onDateClick?.(day.toLocaleDateString('en-CA'));
                }}
                onContextMenu={(e) => {
                  if (!onDayContextMenu) return;
                  e.preventDefault();
                  setSelected(day);
                  onDayContextMenu(day.toLocaleDateString('en-CA'), { mouseX: e.clientX, mouseY: e.clientY });
                }}
                sx={{
                  minHeight: 72,
                  p: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, 0.22)
                    : isToday
                      ? alpha(theme.palette.primary.main, 0.1)
                      : alpha(theme.palette.common.white, 0.04),
                  border: '1px solid',
                  borderColor: isSelected
                    ? alpha(theme.palette.primary.main, 0.6)
                    : 'divider',
                  opacity: isCurrentMonth ? 1 : 0.4,
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                  },
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={isToday ? 800 : 500}
                  sx={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    bgcolor: isToday ? 'primary.main' : 'transparent',
                    color: isToday ? '#fff' : 'text.primary',
                    fontSize: '0.8rem', mb: 0.5,
                  }}
                >
                  {day.getDate()}
                </Typography>
                <Stack spacing={0.25}>
                  {dayAppts.slice(0, 2).map((a) => (
                    <Box
                      key={a.id}
                      onMouseEnter={(e) => {
                        if (hoverTimer.current) clearTimeout(hoverTimer.current);
                        setAnchorEl(e.currentTarget);
                        setHoveredAppt(a);
                      }}
                      onMouseLeave={() => {
                        hoverTimer.current = setTimeout(() => {
                          setHoveredAppt(null);
                          setAnchorEl(null);
                        }, 200);
                      }}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(a); }}
                      onContextMenu={(e) => {
                        if (!onAppointmentContextMenu) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setHoveredAppt(null);
                        setAnchorEl(null);
                        onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
                      }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}
                    >
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: STATUS_COLOR[a.status], flexShrink: 0 }} />
                      <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                        {a.patient.firstName}
                      </Typography>
                    </Box>
                  ))}
                  {dayAppts.length > 2 && (
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                      +{dayAppts.length - 2} more
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>

        {/* Hover Popper */}
        <Popper open={Boolean(hoveredAppt && anchorEl)} anchorEl={anchorEl} placement="right-start" transition sx={{ zIndex: 1400 }}>
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={150}>
              <Paper
                elevation={12}
                onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
                onMouseLeave={() => { setHoveredAppt(null); setAnchorEl(null); }}
                sx={{
                  width: 300, borderRadius: 1, overflow: 'hidden',
                  backdropFilter: 'blur(16px)',
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.88),
                  border: '1px solid', borderColor: 'divider',
                }}
              >
                {hoveredAppt && (() => {
                  const start = new Date(hoveredAppt.startsAt);
                  const end = new Date(hoveredAppt.endsAt);
                  const color = STATUS_COLOR[hoveredAppt.status];
                  return (
                    <>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 2, pb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {hoveredAppt.patient.firstName} {hoveredAppt.patient.lastName}
                        </Typography>
                        <IconButton size="small" onClick={() => { setHoveredAppt(null); setAnchorEl(null); }}
                          sx={{ width: 22, height: 22, bgcolor: alpha(theme.palette.text.primary, 0.08) }}>
                          <CloseIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Stack>
                      <Divider />
                      <Stack spacing={0} sx={{ px: 2, py: 1.5 }}>
                        <Stack direction="row" alignItems="center" sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 90 }}>
                            <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" fontWeight={500}>Date</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {start.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Typography>
                        </Stack>
                        <Divider sx={{ opacity: 0.4 }} />
                        <Stack direction="row" alignItems="center" sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 90 }}>
                            <LabelOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" fontWeight={500}>Type</Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                              {hoveredAppt.status.replace('_', ' ')}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Divider sx={{ opacity: 0.4 }} />
                        <Stack direction="row" alignItems="center" sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 90 }}>
                            <AccessTimeOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" fontWeight={500}>Hour</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Stack>
                        <Divider sx={{ opacity: 0.4 }} />
                        <Stack direction="row" alignItems="center" sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 90 }}>
                            <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" fontWeight={500}>Note</Typography>
                          </Stack>
                          <Typography variant="caption"
                            color={hoveredAppt.reason ? 'text.secondary' : 'text.disabled'}
                            sx={{ fontStyle: hoveredAppt.reason ? 'normal' : 'italic' }}>
                            {hoveredAppt.reason || 'No note'}
                          </Typography>
                        </Stack>
                        <Divider sx={{ opacity: 0.4 }} />
                        <Stack direction="row" alignItems="center" sx={{ py: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 90 }}>
                            <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" fontWeight={500}>Doctor</Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: alpha(color, 0.25), color }}>
                              {hoveredAppt.provider.firstName[0]}{hoveredAppt.provider.lastName[0]}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              Dr. {hoveredAppt.provider.firstName} {hoveredAppt.provider.lastName}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Stack>
                    </>
                  );
                })()}
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* ── Right: Day schedule ── */}
      <Box sx={{ width: 340, flexShrink: 0, p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', maxHeight: '75vh' }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Scheduled</Typography>
          <Typography variant="caption" color="text.secondary">
            {selected.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
        </Box>

        {selectedAppts.length === 0 ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.disabled">No appointments.</Typography>
          </Box>
        ) : (
          <Stack spacing={0} sx={{
            overflowY: 'auto', flex: 1, pr: 0.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
          }}>
            {selectedAppts.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const mins = Math.round((end.getTime() - start.getTime()) / 60000);
              const next = NEXT_STATUS[a.status];
              const initials = `${a.patient.firstName[0]}${a.patient.lastName[0]}`.toUpperCase();
              const color = STATUS_COLOR[a.status];

              return (
                <Box key={a.id} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.disabled" fontWeight={600}>
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5, p: 2, borderRadius: 1,
                      bgcolor: alpha(color, 0.08),
                      borderLeft: `4px solid ${color}`,
                      transition: 'bgcolor 0.15s',
                    }}
                  >
                    <Box sx={{ height: 4, borderRadius: 2, bgcolor: color, mb: 1.5 }} />
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {a.patient.firstName} {a.patient.lastName}
                        </Typography>
                        {a.reason && (
                          <Typography variant="caption" color="text.secondary">{a.reason}</Typography>
                        )}
                      </Box>
                      <Avatar sx={{ width: 26, height: 26, fontSize: 11, fontWeight: 700, bgcolor: alpha(color, 0.3), color }}>
                        {initials}
                      </Avatar>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
                      <AccessTimeOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography variant="caption" color="text.disabled">{mins} min</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                      <Chip size="small" label={a.status.replace('_', ' ')}
                        sx={{ bgcolor: alpha(color, 0.15), color, fontWeight: 600, borderRadius: 1, fontSize: '0.65rem' }} />
                      <Stack direction="row" gap={0.5}>
                        {onAppointmentClick && (
                          <IconButton size="small" onClick={() => onAppointmentClick(a)}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 0.4 }}>
                            <EditOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                        {next && (
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={next === 'COMPLETED' ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              onStatusChange(a.id, next);
                            }}
                            sx={{
                              fontSize: '0.7rem', py: 0.3, px: 1, borderRadius: 1.5,
                              borderColor: STATUS_COLOR[next],
                              color: STATUS_COLOR[next],
                              '&:hover': { bgcolor: alpha(STATUS_COLOR[next], 0.1), borderColor: STATUS_COLOR[next] },
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
  );
}
