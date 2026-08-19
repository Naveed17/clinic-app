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
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import {
  alpha, Avatar, Box, Button, Chip, Dialog, Divider, Fade, IconButton,
  LinearProgress, Paper, Popper, Stack, Typography, useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment } from '@/types/appointment';
import type { Token } from '@/types/token';
import { CalendarSkeleton } from '@/components/LoadingUI';
import { DoctorAvatar } from '@/components/DoctorAvatar';

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

function tokenNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : -1;
}

/** Latest token number first; appointments without a token sink to the bottom. */
function sortByTokenDesc(a: Appointment, b: Appointment): number {
  const ta = tokenNum(a.tokenNumber);
  const tb = tokenNum(b.tokenNumber);
  if (tb !== ta) return tb - ta;
  return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
}

function withDayToken(appt: Appointment, dayTokens: Token[]): Appointment {
  const match = dayTokens.find(
    (t) => t.patientId === appt.patientId && t.doctorId === appt.providerId,
  );
  if (!match) return appt;
  return { ...appt, tokenNumber: match.tokenNumber };
}

/** One card per patient+doctor per day (token create must update, not duplicate). */
function dedupeSameDayVisits(appts: Appointment[]): Appointment[] {
  const rank = (status: string): number => {
    if (status === 'CHECKED_IN') return 4;
    if (status === 'SCHEDULED') return 3;
    if (status === 'COMPLETED') return 2;
    return 1;
  };
  const best = new Map<string, Appointment>();
  for (const a of appts) {
    if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') continue;
    const key = `${a.patientId}:${a.providerId}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, a);
      continue;
    }
    const betterRank = rank(a.status) > rank(prev.status);
    const newer =
      rank(a.status) === rank(prev.status) &&
      new Date(a.startsAt).getTime() >= new Date(prev.startsAt).getTime();
    if (betterRank || newer) best.set(key, a);
  }
  return [...best.values()];
}

interface Props {
  appointments: Appointment[];
  onStatusChange: (id: string, status: string) => void;
  onDateClick?: (date: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onDayContextMenu?: (date: string, anchor: { mouseX: number; mouseY: number }) => void;
  onAppointmentContextMenu?: (appointment: Appointment, anchor: { mouseX: number; mouseY: number }) => void;
  onPrescriptionClick?: (appointment: Appointment) => void | Promise<void>;
  onPatientHistoryClick?: (appointment: Appointment) => void | Promise<void>;
  onLabOrderClick?: (appointment: Appointment) => void | Promise<void>;
  readOnly?: boolean;
  hideCheckIn?: boolean;
  loading?: boolean;
  fetching?: boolean;
  statusPendingId?: string | null;
}

export function AppointmentCalendar({ appointments, onStatusChange, onDateClick, onAppointmentClick, onDayContextMenu, onAppointmentContextMenu, onPrescriptionClick, onPatientHistoryClick, onLabOrderClick, readOnly = false, hideCheckIn = false, loading = false, fetching = false, statusPendingId = null }: Props): React.JSX.Element {
  const theme = useTheme();
  const today = new Date();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [labLoadingId, setLabLoadingId] = useState<string | null>(null);

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
  const [dayListOpen, setDayListOpen] = useState(false);
  const [hoveredAppt, setHoveredAppt] = useState<Appointment | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calDays = getCalendarDays(cursor.getFullYear(), cursor.getMonth());
  const selectedDateKey = selected.toLocaleDateString('en-CA');

  const { data: dayTokens = [] } = useQuery({
    queryKey: ['tokens', selectedDateKey],
    queryFn: () => window.clinic.tokens.list(selectedDateKey) as Promise<Token[]>,
  });

  useEffect(() => {
    if (loading) setDayListOpen(false);
  }, [loading]);

  const selectedAppts = useMemo(
    () =>
      dedupeSameDayVisits(
        appointments
          .filter((a) => isSameDay(new Date(a.startsAt), selected))
          .map((a) => withDayToken(a, dayTokens)),
      ).sort(sortByTokenDesc),
    [appointments, selected, dayTokens],
  );

  function apptsByDay(d: Date) {
    return dedupeSameDayVisits(
      appointments
        .filter((a) => isSameDay(new Date(a.startsAt), d))
        .map((a) => (isSameDay(d, selected) ? withDayToken(a, dayTokens) : a)),
    ).sort(sortByTokenDesc);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        minHeight: 0,
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        bgcolor: 'transparent',
        backgroundImage: 'none',
        position: 'relative',
      }}
    >
      {fetching && !loading ? (
        <LinearProgress
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2, borderRadius: 0 }}
        />
      ) : null}
      {loading ? <CalendarSkeleton /> : (
      <>
      {/* ── Left: Calendar grid ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, pt: 2.5, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        <Box
          sx={{
            flexShrink: 0,
            zIndex: 3,
            bgcolor: 'transparent',
            pb: 0.75,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
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

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {DAYS.map((d) => (
              <Typography key={d} variant="caption" color="text.disabled" fontWeight={700}
                sx={{ textAlign: 'center', py: 0.75, letterSpacing: '0.04em' }}>{d}</Typography>
            ))}
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 100, gap: 0.5 }}>
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
                  setDayListOpen(true);
                }}
                onContextMenu={(e) => {
                  if (!onDayContextMenu) return;
                  e.preventDefault();
                  setSelected(day);
                  onDayContextMenu(day.toLocaleDateString('en-CA'), { mouseX: e.clientX, mouseY: e.clientY });
                }}
                sx={{
                  height: '100%',
                  minHeight: 0,
                  p: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
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
                  {dayAppts.slice(0, 3).map((a) => (
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
                  {dayAppts.length > 3 && (
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                      +{dayAppts.length - 3} more
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
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
                            <DoctorAvatar
                              src={hoveredAppt.provider.avatar}
                              name={`Dr. ${hoveredAppt.provider.firstName} ${hoveredAppt.provider.lastName}`}
                              size={20}
                            />
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
      </>
      )}

      <Dialog
        open={dayListOpen && !loading}
        onClose={() => setDayListOpen(false)}
        fullWidth
        maxWidth={false}
        slotProps={{
          backdrop: { sx: { bgcolor: alpha('#0b1f14', 0.45), backdropFilter: 'blur(6px)' } },
        }}
        PaperProps={{
          sx: {
            width: { xs: '94vw', sm: 820 },
            maxWidth: 820,
            height: { xs: '88vh', sm: '80vh' },
            maxHeight: '88vh',
            borderRadius: '28px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            boxShadow: `0 28px 80px ${alpha('#052e16', 0.28)}`,
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.12),
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            px: 3,
            pt: 2.75,
            pb: 2.5,
            color: '#fff',
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.primary.light} 100%)`,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box sx={{ position: 'absolute', right: -28, top: -48, width: 160, height: 160, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.14)}` }} />
          <Box sx={{ position: 'absolute', right: 70, bottom: -70, width: 140, height: 140, borderRadius: '50%', border: `2px solid ${alpha('#fff', 0.08)}` }} />
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 64,
                  height: 72,
                  borderRadius: '16px',
                  bgcolor: alpha('#fff', 0.16),
                  border: `1px solid ${alpha('#fff', 0.28)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.85 }}>
                  {selected.toLocaleDateString([], { month: 'short' }).toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {selected.getDate()}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.8 }}>
                  Day schedule
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.03em', mt: 0.25, lineHeight: 1.2 }}>
                  {selected.toLocaleDateString([], { weekday: 'long' })}
                </Typography>
                <Typography sx={{ mt: 0.4, fontWeight: 600, opacity: 0.88, fontSize: 13 }}>
                  {selectedAppts.length} visit{selectedAppts.length === 1 ? '' : 's'}
                  {' · '}
                  {selected.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </Typography>
              </Box>
            </Stack>
            <IconButton
              onClick={() => setDayListOpen(false)}
              sx={{
                color: '#fff',
                bgcolor: alpha('#fff', 0.12),
                '&:hover': { bgcolor: alpha('#fff', 0.22) },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        <Box
          sx={{
            px: 2.5,
            py: 2.25,
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            bgcolor: (t) => (t.palette.mode === 'light' ? '#f4f7f5' : alpha(t.palette.common.white, 0.03)),
          }}
        >
          {selectedAppts.length === 0 ? (
            <Box
              sx={{
                py: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '20px',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              >
                <EventBusyOutlinedIcon sx={{ fontSize: 30 }} />
              </Box>
              <Typography fontWeight={800}>No visits this day</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 260 }}>
                This date is free. Book a patient or pick another day on the calendar.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {selectedAppts.map((a, index) => {
                const start = new Date(a.startsAt);
                const end = new Date(a.endsAt);
                const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                const next = NEXT_STATUS[a.status];
                const initials = `${a.patient.firstName[0]}${a.patient.lastName[0]}`.toUpperCase();
                const color = STATUS_COLOR[a.status];
                const tok = tokenNum(a.tokenNumber);

                return (
                  <Box
                    key={a.id}
                    onContextMenu={(e) => {
                      if (!onAppointmentContextMenu) return;
                      e.preventDefault();
                      e.stopPropagation();
                      onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
                    }}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '76px 1fr',
                      gap: 1.5,
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ textAlign: 'right', pr: 0.5, whiteSpace: 'nowrap' }}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: 'text.primary',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Typography>
                      {index < selectedAppts.length - 1 && (
                        <Box sx={{ mt: 1, mr: 0.5, ml: 'auto', width: 2, height: 18, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.18) }} />
                      )}
                    </Box>
                    <Paper
                      elevation={0}
                      sx={{
                        py: 1.1,
                        px: 1.5,
                        pl: 2,
                        borderRadius: '16px',
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: alpha(color, 0.22),
                        boxShadow: `0 8px 24px ${alpha('#052e16', 0.06)}`,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          bgcolor: color,
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1.25}
                          sx={{ minWidth: 0, flex: 1 }}
                        >
                          <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800, bgcolor: alpha(color, 0.18), color, flexShrink: 0 }}>
                            {initials}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Typography fontWeight={800} fontSize={14} noWrap title={a.reason || undefined}>
                                {a.patient.firstName} {a.patient.lastName}
                              </Typography>
                              {tok > 0 && (
                                <Chip
                                  size="small"
                                  label={`#${String(tok).padStart(3, '0')}`}
                                  sx={{
                                    height: 20,
                                    fontWeight: 800,
                                    fontFamily: 'ui-monospace, Consolas, monospace',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: 'primary.dark',
                                  }}
                                />
                              )}
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <AccessTimeOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                              <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>
                                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                {' – '}
                                {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                {' · '}
                                {mins} min
                              </Typography>
                            </Stack>
                          </Box>
                          <Chip
                            size="small"
                            label={a.status.replace('_', ' ')}
                            sx={{
                              bgcolor: alpha(color, 0.14),
                              color,
                              fontWeight: 800,
                              borderRadius: 99,
                              fontSize: '0.68rem',
                              textTransform: 'capitalize',
                              flexShrink: 0,
                            }}
                          />
                        </Stack>

                        <Stack direction="row" alignItems="center" gap={0.5} flexShrink={0}>
                          {!readOnly && onAppointmentClick && (
                            <IconButton size="small" onClick={() => onAppointmentClick(a)}
                              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.45 }}>
                              <EditOutlinedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          )}
                          {onPatientHistoryClick && (
                            <IconButton
                              size="small"
                              title="Patient History"
                              loading={historyLoadingId === a.id}
                              disabled={historyLoadingId === a.id}
                              onClick={() => {
                                void (async () => {
                                  setHistoryLoadingId(a.id);
                                  try {
                                    await onPatientHistoryClick(a);
                                  } finally {
                                    setHistoryLoadingId(null);
                                  }
                                })();
                              }}
                              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.45 }}
                            >
                              <HistoryOutlinedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          )}
                          {onLabOrderClick && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && (
                            <IconButton
                              size="small"
                              title="Order lab"
                              loading={labLoadingId === a.id}
                              disabled={labLoadingId === a.id}
                              onClick={() => {
                                void (async () => {
                                  setLabLoadingId(a.id);
                                  try {
                                    await onLabOrderClick(a);
                                  } finally {
                                    setLabLoadingId(null);
                                  }
                                })();
                              }}
                              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.45 }}
                            >
                              <BiotechOutlinedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          )}
                          {onPrescriptionClick && a.status === 'COMPLETED' && (
                            <IconButton size="small" onClick={() => onPrescriptionClick(a)}
                              sx={{ border: '1px solid', borderColor: 'success.main', borderRadius: 2, p: 0.45, color: 'success.main' }}>
                              <MedicalServicesOutlinedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          )}
                          {!readOnly && next && !(hideCheckIn && next === 'CHECKED_IN') && (
                            <Button
                              size="small"
                              variant="contained"
                              loading={statusPendingId === a.id}
                              endIcon={next === 'COMPLETED' ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />}
                              onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                onStatusChange(a.id, next);
                              }}
                              sx={{
                                fontSize: '0.72rem',
                                py: 0.4,
                                px: 1.2,
                                borderRadius: 99,
                                fontWeight: 800,
                                textTransform: 'none',
                                bgcolor: STATUS_COLOR[next],
                                boxShadow: 'none',
                                '&:hover': { bgcolor: STATUS_COLOR[next], filter: 'brightness(0.94)', boxShadow: 'none' },
                              }}
                            >
                              {next === 'CHECKED_IN' ? 'Check In' : 'Complete'}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            flexShrink: 0,
            bgcolor: 'background.paper',
          }}
        >
          <Button
            onClick={() => setDayListOpen(false)}
            sx={{ borderRadius: 99, fontWeight: 700, textTransform: 'none', px: 2 }}
          >
            Close
          </Button>
          {onDateClick && (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => {
                setDayListOpen(false);
                onDateClick(selected.toLocaleDateString('en-CA'));
              }}
              sx={{ borderRadius: 99, fontWeight: 800, textTransform: 'none', px: 2.25, boxShadow: 'none' }}
            >
              New appointment
            </Button>
          )}
        </Box>
      </Dialog>
    </Paper>
  );
}
