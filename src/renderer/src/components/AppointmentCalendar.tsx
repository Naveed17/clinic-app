import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import CalendarViewMonthOutlinedIcon from '@mui/icons-material/CalendarViewMonthOutlined';
import CalendarViewWeekOutlinedIcon from '@mui/icons-material/CalendarViewWeekOutlined';
import ViewDayOutlinedIcon from '@mui/icons-material/ViewDayOutlined';
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
  alpha, Avatar, Box, Button, ButtonGroup, Chip, Dialog, Divider, Fade, IconButton,
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

type CalView = 'month' | 'week' | 'day';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
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

const HOUR_PX = 96;
const TIME_GUTTER_PX = 72;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 20;

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function formatHourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 || hour === 24 ? 'AM' : 'PM';
  if (hour === 0 || hour === 24) return `12 AM`;
  if (hour === 12) return `12 PM`;
  return `${h} ${suffix}`;
}

function formatEventTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Visible hour window for week/day grids from appointments (falls back to 7–20). */
function visibleHourRange(appts: Appointment[]): { startHour: number; endHour: number } {
  let startMin = DEFAULT_START_HOUR * 60;
  let endMin = DEFAULT_END_HOUR * 60;
  for (const a of appts) {
    if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') continue;
    const s = minutesOfDay(new Date(a.startsAt));
    const e = minutesOfDay(new Date(a.endsAt));
    startMin = Math.min(startMin, Math.floor(s / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(e / 60) * 60);
  }
  const startHour = Math.max(0, Math.min(DEFAULT_START_HOUR, Math.floor(startMin / 60)));
  const endHour = Math.min(24, Math.max(DEFAULT_END_HOUR, Math.ceil(endMin / 60)));
  return { startHour, endHour: Math.max(startHour + 1, endHour) };
}

type LaidOutAppt = {
  appt: Appointment;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
};

/** Pack overlapping events into columns (Google Calendar style). */
function layoutDayEvents(
  dayAppts: Appointment[],
  startHour: number,
  endHour: number,
): LaidOutAppt[] {
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const items = dayAppts
    .map((appt) => {
      const start = minutesOfDay(new Date(appt.startsAt));
      const end = Math.max(start + 15, minutesOfDay(new Date(appt.endsAt)));
      const clampedStart = Math.max(dayStart, Math.min(dayEnd, start));
      const clampedEnd = Math.max(clampedStart + 15, Math.min(dayEnd, end));
      return {
        appt,
        start: clampedStart,
        end: clampedEnd,
        top: ((clampedStart - dayStart) / 60) * HOUR_PX,
        height: Math.max(44, ((clampedEnd - clampedStart) / 60) * HOUR_PX - 4),
      };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  type ClusterItem = (typeof items)[number] & { col: number; cols: number };
  const placed: ClusterItem[] = [];
  let cluster: ClusterItem[] = [];
  let clusterEnd = -1;

  function flushCluster(): void {
    if (cluster.length === 0) return;
    const colCount = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) {
      c.cols = colCount;
      placed.push(c);
    }
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flushCluster();
    const used = new Set(cluster.filter((c) => c.end > item.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col += 1;
    const next = { ...item, col, cols: 1 };
    cluster.push(next);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();

  return placed.map((p) => ({
    appt: p.appt,
    top: p.top,
    height: p.height,
    leftPct: (p.col / p.cols) * 100,
    widthPct: (1 / p.cols) * 100,
  }));
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
  const [calView, setCalView] = useState<CalView>('month');
  const [dayListOpen, setDayListOpen] = useState(false);
  const [hoveredAppt, setHoveredAppt] = useState<Appointment | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDays = useMemo(() => getWeekDays(selected), [selected]);
  const calDays = getCalendarDays(cursor.getFullYear(), cursor.getMonth());
  const selectedDateKey = selected.toLocaleDateString('en-CA');

  const timedScopeAppts = useMemo(() => {
    if (calView === 'day') {
      return appointments.filter((a) => isSameDay(new Date(a.startsAt), selected));
    }
    if (calView === 'week') {
      const keys = new Set(weekDays.map((d) => d.toLocaleDateString('en-CA')));
      return appointments.filter((a) => keys.has(new Date(a.startsAt).toLocaleDateString('en-CA')));
    }
    return [];
  }, [appointments, calView, selected, weekDays]);

  const { startHour, endHour } = useMemo(
    () => visibleHourRange(timedScopeAppts),
    [timedScopeAppts],
  );
  const hourCount = endHour - startHour;
  const hours = useMemo(
    () => Array.from({ length: hourCount }, (_, i) => startHour + i),
    [hourCount, startHour],
  );

  const headerTitle = useMemo(() => {
    if (calView === 'month') {
      return { primary: MONTHS[cursor.getMonth()], secondary: String(cursor.getFullYear()) };
    }
    if (calView === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      const sameMonth = start.getMonth() === end.getMonth();
      const range = sameMonth
        ? `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${end.getDate()}`
        : `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
      return { primary: range, secondary: String(end.getFullYear()) };
    }
    return {
      primary: selected.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
      secondary: String(selected.getFullYear()),
    };
  }, [calView, cursor, selected, weekDays]);

  const { data: dayTokens = [] } = useQuery({
    queryKey: ['tokens', selectedDateKey],
    queryFn: () => window.clinic.tokens.list(selectedDateKey) as Promise<Token[]>,
  });

  const [dayLimit, setDayLimit] = useState(20);

  useEffect(() => {
    if (loading) setDayListOpen(false);
  }, [loading]);

  useEffect(() => {
    setDayLimit(20);
  }, [selectedDateKey, dayListOpen]);

  const selectedAppts = useMemo(
    () =>
      dedupeSameDayVisits(
        appointments
          .filter((a) => isSameDay(new Date(a.startsAt), selected))
          .map((a) => withDayToken(a, dayTokens)),
      ).sort(sortByTokenDesc),
    [appointments, selected, dayTokens],
  );

  const displayedDayAppts = useMemo(
    () => selectedAppts.slice(0, dayLimit),
    [selectedAppts, dayLimit],
  );

  const handleDayScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setDayLimit((prev) => (prev < selectedAppts.length ? Math.min(selectedAppts.length, prev + 20) : prev));
    }
  };

  function apptsByDay(d: Date) {
    return dedupeSameDayVisits(
      appointments
        .filter((a) => isSameDay(new Date(a.startsAt), d))
        .map((a) => (isSameDay(d, selected) ? withDayToken(a, dayTokens) : a)),
    ).sort(sortByTokenDesc);
  }

  function goPrev(): void {
    if (calView === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
      return;
    }
    if (calView === 'week') {
      const next = addDays(selected, -7);
      setSelected(next);
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
      return;
    }
    const next = addDays(selected, -1);
    setSelected(next);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function goNext(): void {
    if (calView === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
      return;
    }
    if (calView === 'week') {
      const next = addDays(selected, 7);
      setSelected(next);
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
      return;
    }
    const next = addDays(selected, 1);
    setSelected(next);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function handleViewChange(next: CalView): void {
    setCalView(next);
    if (next === 'month') {
      setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    if (next === 'day') setDayListOpen(false);
  }

  function renderDayCell(day: Date, opts?: { tall?: boolean; showWeekday?: boolean }): React.JSX.Element {
    const isCurrentMonth = day.getMonth() === cursor.getMonth();
    const isToday = isSameDay(day, today);
    const isSelected = isSameDay(day, selected);
    const dayAppts = apptsByDay(day);
    const maxShown = opts?.tall ? 8 : 3;

    return (
      <Box
        onClick={() => {
          setSelected(day);
          setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
          if (calView === 'day') return;
          if (calView === 'week') {
            setDayListOpen(true);
            return;
          }
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
          opacity: calView === 'month' && !isCurrentMonth ? 0.4 : 1,
          transition: 'all 0.15s',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            borderColor: alpha(theme.palette.primary.main, 0.3),
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
          <Typography
            variant="body2"
            fontWeight={isToday ? 800 : 500}
            sx={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              bgcolor: isToday ? 'primary.main' : 'transparent',
              color: isToday ? '#fff' : 'text.primary',
              fontSize: '0.8rem',
            }}
          >
            {day.getDate()}
          </Typography>
          {opts?.showWeekday && (
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {DAYS[day.getDay()]}
            </Typography>
          )}
        </Stack>
        <Stack spacing={0.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {dayAppts.slice(0, maxShown).map((a) => (
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
                {opts?.tall
                  ? `${new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${a.patient.firstName}`
                  : a.patient.firstName}
              </Typography>
            </Box>
          ))}
          {dayAppts.length > maxShown && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              +{dayAppts.length - maxShown} more
            </Typography>
          )}
        </Stack>
      </Box>
    );
  }

  function renderTimedEventCard(laid: LaidOutAppt): React.JSX.Element {
    const a = laid.appt;
    const start = new Date(a.startsAt);
    const color = STATUS_COLOR[a.status] ?? theme.palette.primary.main;
    const initials = `${a.patient.firstName[0] ?? ''}${a.patient.lastName?.[0] ?? ''}`.toUpperCase();
    const tall = laid.height >= 78;
    const tok = tokenNum(a.tokenNumber);

    return (
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
        onClick={(e) => {
          e.stopPropagation();
          onAppointmentClick?.(a);
        }}
        onContextMenu={(e) => {
          if (!onAppointmentContextMenu) return;
          e.preventDefault();
          e.stopPropagation();
          setHoveredAppt(null);
          setAnchorEl(null);
          onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
        }}
        sx={{
          position: 'absolute',
          top: laid.top,
          left: `calc(${laid.leftPct}% + 4px)`,
          width: `calc(${laid.widthPct}% - 8px)`,
          height: laid.height,
          borderRadius: '12px',
          bgcolor: (t) => t.palette.background.paper,
          backgroundImage: `linear-gradient(${alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.16)}, ${alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.16)})`,
          border: `1px solid ${alpha(color, 0.28)}`,
          borderLeft: `4px solid ${color}`,
          px: 1.25,
          py: 0.85,
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.35,
          zIndex: 2,
          boxShadow: (t) =>
            t.palette.mode === 'dark'
              ? `0 1px 0 ${alpha('#000', 0.35)}`
              : `0 1px 2px ${alpha('#000', 0.06)}`,
          transition: 'box-shadow 0.15s, transform 0.15s',
          '&:hover': {
            boxShadow: `0 8px 20px ${alpha(color, 0.22)}`,
            transform: 'translateY(-1px)',
            zIndex: 3,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            color,
            lineHeight: 1.25,
            opacity: 0.95,
            letterSpacing: '0.01em',
          }}
          noWrap
        >
          {formatEventTime(start)}
          {tok > 0 ? ` · #${String(tok).padStart(3, '0')}` : ''}
        </Typography>
        <Typography
          sx={{
            fontSize: tall ? 14 : 13,
            fontWeight: 800,
            color: 'text.primary',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
          noWrap
        >
          {a.patient.firstName} {a.patient.lastName}
        </Typography>
        {tall && (
          <Stack direction="row" alignItems="center" spacing={0.4} sx={{ minWidth: 0, mt: 0.15 }}>
            <MedicalServicesOutlinedIcon sx={{ fontSize: 13, color, opacity: 0.85, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color, opacity: 0.9 }} noWrap>
              Dr. {a.provider.firstName} {a.provider.lastName}
            </Typography>
          </Stack>
        )}
        {laid.height >= 110 && (
          <Avatar
            src={a.patient.avatar ?? undefined}
            sx={{
              width: 24,
              height: 24,
              fontSize: 10,
              fontWeight: 800,
              mt: 'auto',
              bgcolor: alpha(color, 0.28),
              color,
            }}
          >
            {initials}
          </Avatar>
        )}
      </Box>
    );
  }

  function renderTimeGrid(days: Date[]): React.JSX.Element {
    const gridHeight = hourCount * HOUR_PX;
    const colTemplate = `${TIME_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`;

    return (
      <Box sx={{ minWidth: days.length === 1 ? 0 : 720, width: '100%', height: '100%' }}>
        {/* Day headers */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: colTemplate,
            position: 'sticky',
            top: 0,
            zIndex: 4,
            bgcolor: (t) => alpha(t.palette.background.default, 0.92),
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 1,
          }}
        >
          <Box />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selected);
            return (
              <Box
                key={day.toISOString()}
                onClick={() => {
                  setSelected(day);
                  setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
                }}
                sx={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  py: 0.5,
                  borderRadius: 1,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color={isToday ? 'primary.main' : 'text.disabled'}
                  sx={{ letterSpacing: '0.06em', display: 'block' }}
                >
                  {DAYS[day.getDay()].toUpperCase()}
                </Typography>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    mx: 'auto',
                    mt: 0.35,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                    bgcolor: isToday ? 'primary.main' : isSelected ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
                    color: isToday ? '#fff' : 'text.primary',
                  }}
                >
                  {day.getDate()}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Body: time gutter + day columns */}
        <Box sx={{ display: 'grid', gridTemplateColumns: colTemplate, position: 'relative' }}>
          {/* Hour labels */}
          <Box sx={{ position: 'relative', height: gridHeight }}>
            {hours.map((h) => (
              <Typography
                key={h}
                variant="caption"
                color="text.disabled"
                fontWeight={600}
                sx={{
                  position: 'absolute',
                  top: (h - startHour) * HOUR_PX,
                  right: 10,
                  transform: 'translateY(-50%)',
                  fontSize: 11,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatHourLabel(h)}
              </Typography>
            ))}
          </Box>

          {days.map((day) => {
            const dayAppts = apptsByDay(day);
            const laid = layoutDayEvents(dayAppts, startHour, endHour);
            return (
              <Box
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                onContextMenu={(e) => {
                  if (!onDayContextMenu) return;
                  e.preventDefault();
                  setSelected(day);
                  onDayContextMenu(day.toLocaleDateString('en-CA'), { mouseX: e.clientX, mouseY: e.clientY });
                }}
                sx={{
                  position: 'relative',
                  isolation: 'isolate',
                  height: gridHeight,
                  borderLeft: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.8),
                  bgcolor: isSameDay(day, today)
                    ? alpha(theme.palette.primary.main, 0.03)
                    : 'transparent',
                }}
              >
                {/* Grid lines stay behind event cards */}
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                >
                  {hours.map((h) => (
                    <Box
                      key={h}
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: (h - startHour) * HOUR_PX,
                        height: HOUR_PX,
                        borderTop: '1px solid',
                        borderColor: alpha(theme.palette.divider, 0.7),
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: '50%',
                          borderTop: '1px dashed',
                          borderColor: alpha(theme.palette.divider, 0.35),
                        },
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                  {laid.map((item) => renderTimedEventCard(item))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
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
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="h6" fontWeight={700}>{headerTitle.primary}</Typography>
            <Typography variant="h6" fontWeight={700} color="text.secondary">{headerTitle.secondary}</Typography>
            <Box sx={{ flex: 1 }} />
            <ButtonGroup
              variant="text"
              size="small"
              aria-label="Calendar view"
              sx={{
                p: 0.4,
                borderRadius: 999,
                bgcolor: (t) =>
                  t.palette.mode === 'dark'
                    ? alpha('#000', 0.45)
                    : alpha(t.palette.text.primary, 0.06),
                border: '1px solid',
                borderColor: (t) =>
                  t.palette.mode === 'dark'
                    ? alpha('#fff', 0.08)
                    : alpha(t.palette.text.primary, 0.08),
                '& .MuiButtonGroup-grouped': {
                  border: 'none !important',
                  borderRadius: '999px !important',
                  minWidth: 0,
                  px: 1.5,
                  py: 0.65,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  gap: 0.6,
                  color: 'text.secondary',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.06 : 0.4),
                  },
                },
              }}
            >
              {([
                { value: 'month' as const, label: 'Month', Icon: CalendarViewMonthOutlinedIcon },
                { value: 'week' as const, label: 'Week', Icon: CalendarViewWeekOutlinedIcon },
                { value: 'day' as const, label: 'Day', Icon: ViewDayOutlinedIcon },
              ]).map(({ value, label, Icon }) => {
                const active = calView === value;
                return (
                  <Button
                    key={value}
                    startIcon={<Icon sx={{ fontSize: '16px !important' }} />}
                    onClick={() => handleViewChange(value)}
                    sx={
                      active
                        ? {
                            bgcolor: `${theme.palette.primary.main} !important`,
                            color: '#fff !important',
                            '&:hover': { bgcolor: `${theme.palette.primary.dark} !important` },
                            '& .MuiButton-startIcon': { color: '#fff' },
                          }
                        : undefined
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </ButtonGroup>
            <IconButton size="small" onClick={goPrev}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton size="small" onClick={goNext}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          {calView === 'month' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {DAYS.map((d) => (
                <Typography key={d} variant="caption" color="text.disabled" fontWeight={700}
                  sx={{ textAlign: 'center', py: 0.75, letterSpacing: '0.04em' }}>{d}</Typography>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {calView === 'month' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 100, gap: 0.5 }}>
              {calDays.map((day, i) => (
                <Box key={i} sx={{ minHeight: 0 }}>
                  {renderDayCell(day)}
                </Box>
              ))}
            </Box>
          )}

          {calView === 'week' && renderTimeGrid(weekDays)}

          {calView === 'day' && renderTimeGrid([selected])}
        </Box>

        {/* Hover Popper — day cards are full-width: open below and keep inside viewport */}
        <Popper
          open={Boolean(hoveredAppt && anchorEl)}
          anchorEl={anchorEl}
          placement={calView === 'day' ? 'bottom-start' : 'right-start'}
          transition
          modifiers={[
            { name: 'offset', options: { offset: [0, 10] } },
            {
              name: 'flip',
              enabled: true,
              options: {
                fallbackPlacements:
                  calView === 'day'
                    ? ['top-start', 'bottom-end', 'top-end', 'left-start']
                    : ['left-start', 'bottom-start', 'top-start'],
              },
            },
            {
              name: 'preventOverflow',
              enabled: true,
              options: { padding: 12, altAxis: true, boundary: 'viewport' },
            },
          ]}
          sx={{ zIndex: 1400 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={150}>
              <Paper
                elevation={12}
                onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
                onMouseLeave={() => { setHoveredAppt(null); setAnchorEl(null); }}
                sx={{
                  width: 300,
                  maxWidth: 'calc(100vw - 24px)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  backdropFilter: 'blur(16px)',
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.94),
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: theme.shadows[12],
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
          onScroll={handleDayScroll}
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
              {displayedDayAppts.map((a, index) => {
                const start = new Date(a.startsAt);
                const end = new Date(a.endsAt);
                const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                const next = NEXT_STATUS[a.status];
                const initials = `${a.patient.firstName[0] ?? ''}${a.patient.lastName?.[0] ?? ''}`.toUpperCase();
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
                      {index < displayedDayAppts.length - 1 && (
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
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                          <Avatar
                            src={a.patient.avatar ?? undefined}
                            sx={{
                              width: 38,
                              height: 38,
                              fontSize: 13,
                              fontWeight: 800,
                              bgcolor: alpha(color, 0.18),
                              color,
                              flexShrink: 0,
                            }}
                          >
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
              {displayedDayAppts.length < selectedAppts.length && (
                <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ display: 'block', py: 1.5, fontStyle: 'italic' }}>
                  Scroll down to load more ({displayedDayAppts.length} of {selectedAppts.length} visits loaded)...
                </Typography>
              )}
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
