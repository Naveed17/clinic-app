import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  ProgressBar,
  Spinner,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment } from '@/types/appointment';
import type { Token } from '@/types/token';
import { CalendarSkeleton } from '@/components/LoadingUI';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { AccessTimeOutlinedIcon, AddOutlinedIcon, ArrowForwardIcon, BiotechOutlinedIcon, CalendarTodayOutlinedIcon, CalendarViewMonthOutlinedIcon, CalendarViewWeekOutlinedIcon, CheckCircleOutlineIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, EditOutlinedIcon, EventBusyOutlinedIcon, HistoryOutlinedIcon, LabelOutlinedIcon, MedicalServicesOutlinedIcon, PersonOutlineIcon, ViewDayOutlinedIcon } from '@/icons/fluent';

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


const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: tokens.colorBrandForeground1,
  CHECKED_IN: tokens.colorPaletteDarkOrangeForeground1,
  COMPLETED: tokens.colorPaletteGreenForeground1,
  CANCELLED: tokens.colorNeutralForegroundDisabled,
  NO_SHOW: tokens.colorPaletteRedForeground1,
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  SCHEDULED: 'CHECKED_IN',
  CHECKED_IN: 'COMPLETED',
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  fetchBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  left: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingVerticalXL,
    paddingTop: tokens.spacingVerticalL,
    overflow: 'hidden',
    minWidth: 0,
    minHeight: 0,
  },
  toolbar: {
    flexShrink: 0,
    zIndex: 3,
    paddingBottom: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  grow: { flex: 1 },
  viewToggle: {
    display: 'flex',
    padding: '4px',
    borderRadius: '999px',
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: '2px',
  },
  dayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
  },
  dayHeader: {
    textAlign: 'center',
    paddingTop: '6px',
    paddingBottom: '6px',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForegroundDisabled,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase100,
  },
  scroll: { flex: 1, minHeight: 0, overflow: 'auto' },
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
    gridAutoRows: '100px',
    gap: '4px',
  },
  dayCell: {
    height: '100%',
    minHeight: 0,
    padding: '6px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    transitionProperty: 'background-color, border-color',
    transitionDuration: tokens.durationNormal,
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2,
      border: `1px solid ${tokens.colorBrandStroke1}`,
    },
  },
  dayNum: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
  },
  eventDot: { width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 },
  eventRow: { display: 'flex', alignItems: 'center', gap: '4px' },
  timedEvent: {
    position: 'absolute',
    borderRadius: '12px',
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    paddingLeft: '10px',
    paddingRight: '10px',
    paddingTop: '6px',
    paddingBottom: '6px',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 2,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  timeGrid: { width: '100%', height: '100%' },
  timeHead: {
    display: 'grid',
    position: 'sticky',
    top: 0,
    zIndex: 4,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: '8px',
  },
  hoverCard: {
    position: 'fixed',
    zIndex: 1400,
    width: '300px',
    maxWidth: 'calc(100vw - 24px)',
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16,
  },
  hoverHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalM,
  },
  hoverRow: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  hoverLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    width: '90px',
    color: tokens.colorNeutralForegroundDisabled,
  },
  dayDialog: {
    width: 'min(820px, 94vw)',
    maxWidth: '820px',
    height: 'min(80vh, 88vh)',
    maxHeight: '88vh',
    borderRadius: '28px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  dayHero: {
    position: 'relative',
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: '22px',
    paddingBottom: '20px',
    color: '#fff',
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 58%, ${tokens.colorBrandBackground2} 100%)`,
    overflow: 'hidden',
    flexShrink: 0,
  },
  dayBody: {
    padding: tokens.spacingVerticalXL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  dayFoot: {
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  visitRow: {
    display: 'grid',
    gridTemplateColumns: '76px 1fr',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  visitCard: {
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '16px',
    paddingRight: '12px',
    borderRadius: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
  },
  visitAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
  },
});

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

export function AppointmentCalendar({
  appointments, onStatusChange, onDateClick, onAppointmentClick, onDayContextMenu, onAppointmentContextMenu,
  onPrescriptionClick, onPatientHistoryClick, onLabOrderClick, readOnly = false, hideCheckIn = false,
  loading = false, fetching = false, statusPendingId = null,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const today = new Date();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [labLoadingId, setLabLoadingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [calView, setCalView] = useState<CalView>('month');
  const [dayListOpen, setDayListOpen] = useState(false);
  const [hoveredAppt, setHoveredAppt] = useState<Appointment | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDays = useMemo(() => getWeekDays(selected), [selected]);
  const calDays = getCalendarDays(cursor.getFullYear(), cursor.getMonth());
  const selectedDateKey = selected.toLocaleDateString('en-CA');

  const timedScopeAppts = useMemo(() => {
    if (calView === 'day') return appointments.filter((a) => isSameDay(new Date(a.startsAt), selected));
    if (calView === 'week') {
      const keys = new Set(weekDays.map((d) => d.toLocaleDateString('en-CA')));
      return appointments.filter((a) => keys.has(new Date(a.startsAt).toLocaleDateString('en-CA')));
    }
    return [];
  }, [appointments, calView, selected, weekDays]);

  const { startHour, endHour } = useMemo(() => visibleHourRange(timedScopeAppts), [timedScopeAppts]);
  const hourCount = endHour - startHour;
  const hours = useMemo(() => Array.from({ length: hourCount }, (_, i) => startHour + i), [hourCount, startHour]);

  const headerTitle = useMemo(() => {
    if (calView === 'month') return { primary: MONTHS[cursor.getMonth()], secondary: String(cursor.getFullYear()) };
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

  useEffect(() => { if (loading) setDayListOpen(false); }, [loading]);

  const selectedAppts = useMemo(
    () =>
      dedupeSameDayVisits(
        appointments.filter((a) => isSameDay(new Date(a.startsAt), selected)).map((a) => withDayToken(a, dayTokens)),
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

  function goPrev(): void {
    if (calView === 'month') { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); return; }
    if (calView === 'week') {
      const next = addDays(selected, -7);
      setSelected(next); setCursor(new Date(next.getFullYear(), next.getMonth(), 1)); return;
    }
    const next = addDays(selected, -1);
    setSelected(next); setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function goNext(): void {
    if (calView === 'month') { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); return; }
    if (calView === 'week') {
      const next = addDays(selected, 7);
      setSelected(next); setCursor(new Date(next.getFullYear(), next.getMonth(), 1)); return;
    }
    const next = addDays(selected, 1);
    setSelected(next); setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function handleViewChange(next: CalView): void {
    setCalView(next);
    if (next === 'month') setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    if (next === 'day') setDayListOpen(false);
  }

  function showHover(a: Appointment, el: HTMLElement): void {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const rect = el.getBoundingClientRect();
    setHoverPos({ x: calView === 'day' ? rect.left : rect.right + 10, y: rect.top });
    setHoveredAppt(a);
  }

  function hideHover(): void {
    hoverTimer.current = setTimeout(() => { setHoveredAppt(null); setHoverPos(null); }, 200);
  }

  function renderDayCell(day: Date, opts?: { tall?: boolean; showWeekday?: boolean }): React.JSX.Element {
    const isCurrentMonth = day.getMonth() === cursor.getMonth();
    const isToday = isSameDay(day, today);
    const isSelected = isSameDay(day, selected);
    const dayAppts = apptsByDay(day);
    const maxShown = opts?.tall ? 8 : 3;
    return (
      <div
        className={styles.dayCell}
        style={{
          backgroundColor: isSelected ? tokens.colorBrandBackground2 : isToday ? tokens.colorNeutralBackground3 : undefined,
          borderColor: isSelected ? tokens.colorBrandStroke1 : undefined,
          opacity: calView === 'month' && !isCurrentMonth ? 0.4 : 1,
        }}
        onClick={() => {
          setSelected(day);
          setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
          if (calView === 'day') return;
          setDayListOpen(true);
        }}
        onContextMenu={(e) => {
          if (!onDayContextMenu) return;
          e.preventDefault();
          setSelected(day);
          onDayContextMenu(day.toLocaleDateString('en-CA'), { mouseX: e.clientX, mouseY: e.clientY });
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text
            className={styles.dayNum}
            weight={isToday ? 'bold' : 'regular'}
            style={{
              backgroundColor: isToday ? tokens.colorBrandBackground : 'transparent',
              color: isToday ? '#fff' : tokens.colorNeutralForeground1,
              fontWeight: isToday ? 800 : 500,
            }}
          >
            {day.getDate()}
          </Text>
          {opts?.showWeekday && (
            <Text size={100} weight="bold" style={{ color: tokens.colorNeutralForeground2 }}>{DAYS[day.getDay()]}</Text>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dayAppts.slice(0, maxShown).map((a) => (
            <div
              key={a.id}
              className={styles.eventRow}
              onMouseEnter={(e) => showHover(a, e.currentTarget)}
              onMouseLeave={hideHover}
              onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(a); }}
              onContextMenu={(e) => {
                if (!onAppointmentContextMenu) return;
                e.preventDefault(); e.stopPropagation();
                setHoveredAppt(null); setHoverPos(null);
                onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
              }}
            >
              <span className={styles.eventDot} style={{ backgroundColor: STATUS_COLOR[a.status] }} />
              <Text size={100} truncate style={{ color: tokens.colorNeutralForeground2, fontSize: '0.65rem', lineHeight: 1.2 }}>
                {opts?.tall
                  ? `${new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${a.patient.firstName}`
                  : a.patient.firstName}
              </Text>
            </div>
          ))}
          {dayAppts.length > maxShown && (
            <Text size={100} style={{ fontSize: '0.6rem', color: tokens.colorNeutralForegroundDisabled }}>
              +{dayAppts.length - maxShown} more
            </Text>
          )}
        </div>
      </div>
    );
  }

  function renderTimedEventCard(laid: LaidOutAppt): React.JSX.Element {
    const a = laid.appt;
    const start = new Date(a.startsAt);
    const color = STATUS_COLOR[a.status] ?? tokens.colorBrandForeground1;
    const initials = `${a.patient.firstName[0] ?? ''}${a.patient.lastName[0] ?? ''}`.toUpperCase();
    const tall = laid.height >= 78;
    const tok = tokenNum(a.tokenNumber);
    return (
      <div
        key={a.id}
        className={styles.timedEvent}
        style={{
          top: laid.top,
          left: `calc(${laid.leftPct}% + 4px)`,
          width: `calc(${laid.widthPct}% - 8px)`,
          height: laid.height,
          borderLeftColor: color,
          backgroundImage: `linear-gradient(${color}22, ${color}22)`,
          border: `1px solid ${color}44`,
          borderLeftWidth: 4,
          borderLeftStyle: 'solid',
        }}
        onMouseEnter={(e) => showHover(a, e.currentTarget)}
        onMouseLeave={hideHover}
        onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(a); }}
        onContextMenu={(e) => {
          if (!onAppointmentContextMenu) return;
          e.preventDefault(); e.stopPropagation();
          setHoveredAppt(null); setHoverPos(null);
          onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
        }}
      >
        <Text weight="bold" style={{ fontSize: 11.5, color, lineHeight: 1.25 }} truncate>
          {formatEventTime(start)}{tok > 0 ? ` · #${String(tok).padStart(3, '0')}` : ''}
        </Text>
        <Text weight="bold" style={{ fontSize: tall ? 14 : 13, lineHeight: 1.3 }} truncate>
          {a.patient.firstName} {a.patient.lastName}
        </Text>
        {tall && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginTop: 2 }}>
            <MedicalServicesOutlinedIcon style={{ fontSize: 13, color, opacity: 0.85, flexShrink: 0 }} />
            <Text weight="semibold" style={{ fontSize: 11.5, color, opacity: 0.9 }} truncate>
              Dr. {a.provider.firstName} {a.provider.lastName}
            </Text>
          </div>
        )}
        {laid.height >= 110 && (
          <Avatar name={initials} color="brand" size={24} style={{ marginTop: 'auto', backgroundColor: `${color}44`, color }} />
        )}
      </div>
    );
  }

  function renderTimeGrid(days: Date[]): React.JSX.Element {
    const gridHeight = hourCount * HOUR_PX;
    const colTemplate = `${TIME_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`;
    return (
      <div className={styles.timeGrid} style={{ minWidth: days.length === 1 ? 0 : 720 }}>
        <div className={styles.timeHead} style={{ gridTemplateColumns: colTemplate }}>
          <div />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selected);
            return (
              <div
                key={day.toISOString()}
                style={{ textAlign: 'center', cursor: 'pointer', padding: 4, borderRadius: 8 }}
                onClick={() => { setSelected(day); setCursor(new Date(day.getFullYear(), day.getMonth(), 1)); }}
              >
                <Text size={100} weight="bold" style={{ letterSpacing: '0.06em', display: 'block', color: isToday ? tokens.colorBrandForeground1 : tokens.colorNeutralForegroundDisabled }}>
                  {DAYS[day.getDay()].toUpperCase()}
                </Text>
                <div style={{
                  width: 34, height: 34, margin: '4px auto 0', borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 15,
                  backgroundColor: isToday ? tokens.colorBrandBackground : isSelected ? tokens.colorBrandBackground2 : 'transparent',
                  color: isToday ? '#fff' : tokens.colorNeutralForeground1,
                }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, position: 'relative' }}>
          <div style={{ position: 'relative', height: gridHeight }}>
            {hours.map((h) => (
              <Text key={h} size={100} weight="semibold" style={{
                position: 'absolute', top: (h - startHour) * HOUR_PX, right: 10, transform: 'translateY(-50%)',
                fontSize: 11, color: tokens.colorNeutralForegroundDisabled, fontVariantNumeric: 'tabular-nums',
              }}>
                {formatHourLabel(h)}
              </Text>
            ))}
          </div>
          {days.map((day) => {
            const dayAppts = apptsByDay(day);
            const laid = layoutDayEvents(dayAppts, startHour, endHour);
            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                onContextMenu={(e) => {
                  if (!onDayContextMenu) return;
                  e.preventDefault();
                  setSelected(day);
                  onDayContextMenu(day.toLocaleDateString('en-CA'), { mouseX: e.clientX, mouseY: e.clientY });
                }}
                style={{
                  position: 'relative', isolation: 'isolate', height: gridHeight,
                  borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
                  backgroundColor: isSameDay(day, today) ? tokens.colorBrandBackground2 : 'transparent',
                }}
              >
                <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                  {hours.map((h) => (
                    <div key={h} style={{
                      position: 'absolute', left: 0, right: 0, top: (h - startHour) * HOUR_PX, height: HOUR_PX,
                      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                    }} />
                  ))}
                </div>
                <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                  {laid.map((item) => renderTimedEventCard(item))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {fetching && !loading ? <ProgressBar className={styles.fetchBar} thickness="medium" /> : null}
      {loading ? <CalendarSkeleton /> : (
        <div className={styles.left}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarRow}>
              <Title3>{headerTitle.primary}</Title3>
              <Title3 style={{ color: tokens.colorNeutralForeground2 }}>{headerTitle.secondary}</Title3>
              <div className={styles.grow} />
              <div className={styles.viewToggle} role="group" aria-label="Calendar view">
                {([
                  { value: 'month' as const, label: 'Month', Icon: CalendarViewMonthOutlinedIcon },
                  { value: 'week' as const, label: 'Week', Icon: CalendarViewWeekOutlinedIcon },
                  { value: 'day' as const, label: 'Day', Icon: ViewDayOutlinedIcon },
                ]).map(({ value, label, Icon }) => {
                  const active = calView === value;
                  return (
                    <Button
                      key={value}
                      size="small"
                      appearance={active ? 'primary' : 'subtle'}
                      icon={<Icon style={{ fontSize: 16 }} />}
                      onClick={() => handleViewChange(value)}
                      style={active ? undefined : { fontWeight: 700 }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <Button appearance="subtle" size="small" icon={<ChevronLeftIcon />} onClick={goPrev} aria-label="Previous" />
              <Button appearance="subtle" size="small" icon={<ChevronRightIcon />} onClick={goNext} aria-label="Next" />
            </div>
            {calView === 'month' && (
              <div className={styles.dayHeaders}>
                {DAYS.map((d) => <Text key={d} className={styles.dayHeader}>{d}</Text>)}
              </div>
            )}
          </div>

          <div className={styles.scroll}>
            {calView === 'month' && (
              <div className={styles.monthGrid}>
                {calDays.map((day, i) => <div key={i}>{renderDayCell(day)}</div>)}
              </div>
            )}
            {calView === 'week' && renderTimeGrid(weekDays)}
            {calView === 'day' && renderTimeGrid([selected])}
          </div>

          {hoveredAppt && hoverPos && (
            <div
              className={styles.hoverCard}
              style={{ left: hoverPos.x, top: hoverPos.y }}
              onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
              onMouseLeave={() => { setHoveredAppt(null); setHoverPos(null); }}
            >
              {(() => {
                const start = new Date(hoveredAppt.startsAt);
                const end = new Date(hoveredAppt.endsAt);
                const color = STATUS_COLOR[hoveredAppt.status];
                return (
                  <>
                    <div className={styles.hoverHead}>
                      <Text weight="bold" size={400}>
                        {hoveredAppt.patient.firstName} {hoveredAppt.patient.lastName}
                      </Text>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<CloseIcon style={{ fontSize: 13 }} />}
                        onClick={() => { setHoveredAppt(null); setHoverPos(null); }}
                      />
                    </div>
                    <Divider />
                    <div>
                      {[
                        { icon: <CalendarTodayOutlinedIcon style={{ fontSize: 14 }} />, label: 'Date', value: start.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) },
                        { icon: <LabelOutlinedIcon style={{ fontSize: 14 }} />, label: 'Type', value: (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                            {hoveredAppt.status.replace('_', ' ')}
                          </span>
                        ) },
                        { icon: <AccessTimeOutlinedIcon style={{ fontSize: 14 }} />, label: 'Hour', value: `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
                        { icon: <PersonOutlineIcon style={{ fontSize: 14 }} />, label: 'Note', value: hoveredAppt.reason || 'No note' },
                        { icon: <PersonOutlineIcon style={{ fontSize: 14 }} />, label: 'Doctor', value: (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <DoctorAvatar src={hoveredAppt.provider.avatar} name={`Dr. ${hoveredAppt.provider.firstName} ${hoveredAppt.provider.lastName}`} size={20} />
                            Dr. {hoveredAppt.provider.firstName} {hoveredAppt.provider.lastName}
                          </span>
                        ) },
                      ].map((row) => (
                        <div key={row.label}>
                          <div className={styles.hoverRow}>
                            <div className={styles.hoverLabel}>{row.icon}<Text size={100} weight="medium">{row.label}</Text></div>
                            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{row.value}</Text>
                          </div>
                          <Divider style={{ opacity: 0.4 }} />
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <Dialog open={dayListOpen && !loading} onOpenChange={(_, d) => { if (!d.open) setDayListOpen(false); }}>
        <DialogSurface className={styles.dayDialog}>
          <div className={styles.dayHero}>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 64, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.28)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.85 }}>
                    {selected.toLocaleDateString([], { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{selected.getDate()}</Text>
                </div>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.8 }}>Day schedule</Text>
                  <Text style={{ fontSize: 22, fontWeight: 800, display: 'block', marginTop: 2 }}>{selected.toLocaleDateString([], { weekday: 'long' })}</Text>
                  <Text style={{ marginTop: 4, fontWeight: 600, opacity: 0.88, fontSize: 13 }}>
                    {selectedAppts.length} visit{selectedAppts.length === 1 ? '' : 's'}
                    {' · '}
                    {selected.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                  </Text>
                </div>
              </div>
              <Button appearance="subtle" icon={<CloseIcon />} onClick={() => setDayListOpen(false)} style={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </div>
          </div>

          <DialogBody style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DialogContent className={styles.dayBody}>
              {selectedAppts.length === 0 ? (
                <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, display: 'grid', placeItems: 'center', marginBottom: 12,
                    backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1,
                  }}>
                    <EventBusyOutlinedIcon style={{ fontSize: 30 }} />
                  </div>
                  <Text weight="bold">No visits this day</Text>
                  <Text size={300} style={{ color: tokens.colorNeutralForeground2, marginTop: 4, maxWidth: 260 }}>
                    This date is free. Book a patient or pick another day on the calendar.
                  </Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedAppts.map((a, index) => {
                    const start = new Date(a.startsAt);
                    const end = new Date(a.endsAt);
                    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                    const next = NEXT_STATUS[a.status];
                    const initials = `${a.patient.firstName[0]}${a.patient.lastName[0]}`.toUpperCase();
                    const color = STATUS_COLOR[a.status];
                    const tok = tokenNum(a.tokenNumber);
                    return (
                      <div
                        key={a.id}
                        className={styles.visitRow}
                        onContextMenu={(e) => {
                          if (!onAppointmentContextMenu) return;
                          e.preventDefault(); e.stopPropagation();
                          onAppointmentContextMenu(a, { mouseX: e.clientX, mouseY: e.clientY });
                        }}
                      >
                        <div style={{ textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap' }}>
                          <Text weight="bold" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </Text>
                          {index < selectedAppts.length - 1 && (
                            <div style={{ marginTop: 8, marginLeft: 'auto', marginRight: 4, width: 2, height: 18, borderRadius: 4, backgroundColor: tokens.colorBrandBackground2 }} />
                          )}
                        </div>
                        <div className={styles.visitCard}>
                          <div className={styles.visitAccent} style={{ backgroundColor: color }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                              <Avatar name={initials} size={32} style={{ backgroundColor: `${color}2e`, color, fontWeight: 800, flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <Text weight="bold" size={300} truncate title={a.reason || undefined}>
                                    {a.patient.firstName} {a.patient.lastName}
                                  </Text>
                                  {tok > 0 && (
                                    <Badge appearance="tint" color="brand" size="small" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 800 }}>
                                      #{String(tok).padStart(3, '0')}
                                    </Badge>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <AccessTimeOutlinedIcon style={{ fontSize: 13 }} />
                                  <Text size={100} weight="semibold" truncate style={{ color: tokens.colorNeutralForeground2 }}>
                                    {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                    {' – '}
                                    {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                    {' · '}
                                    {mins} min
                                  </Text>
                                </div>
                              </div>
                              <Badge appearance="tint" size="small" style={{ backgroundColor: `${color}24`, color, fontWeight: 800, borderRadius: 99, textTransform: 'capitalize', flexShrink: 0 }}>
                                {a.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {!readOnly && onAppointmentClick && (
                                <Button appearance="outline" size="small" icon={<EditOutlinedIcon style={{ fontSize: 15 }} />} onClick={() => onAppointmentClick(a)} />
                              )}
                              {onPatientHistoryClick && (
                                <Tooltip content="Patient History" relationship="label">
                                  <Button
                                    appearance="outline"
                                    size="small"
                                    disabled={historyLoadingId === a.id}
                                    icon={historyLoadingId === a.id ? <Spinner size="tiny" /> : <HistoryOutlinedIcon style={{ fontSize: 15 }} />}
                                    onClick={() => {
                                      void (async () => {
                                        setHistoryLoadingId(a.id);
                                        try { await onPatientHistoryClick(a); } finally { setHistoryLoadingId(null); }
                                      })();
                                    }}
                                  />
                                </Tooltip>
                              )}
                              {onLabOrderClick && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && (
                                <Tooltip content="Order lab" relationship="label">
                                  <Button
                                    appearance="outline"
                                    size="small"
                                    disabled={labLoadingId === a.id}
                                    icon={labLoadingId === a.id ? <Spinner size="tiny" /> : <BiotechOutlinedIcon style={{ fontSize: 15 }} />}
                                    onClick={() => {
                                      void (async () => {
                                        setLabLoadingId(a.id);
                                        try { await onLabOrderClick(a); } finally { setLabLoadingId(null); }
                                      })();
                                    }}
                                  />
                                </Tooltip>
                              )}
                              {onPrescriptionClick && a.status === 'COMPLETED' && (
                                <Button
                                  appearance="outline"
                                  size="small"
                                  icon={<MedicalServicesOutlinedIcon style={{ fontSize: 15 }} />}
                                  onClick={() => onPrescriptionClick(a)}
                                  style={{ borderColor: tokens.colorPaletteGreenBorderActive, color: tokens.colorPaletteGreenForeground1 }}
                                />
                              )}
                              {!readOnly && next && !(hideCheckIn && next === 'CHECKED_IN') && (
                                <Button
                                  appearance="primary"
                                  size="small"
                                  disabled={statusPendingId === a.id}
                                  icon={statusPendingId === a.id ? <Spinner size="tiny" /> : (next === 'COMPLETED' ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />)}
                                  iconPosition="after"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    onStatusChange(a.id, next);
                                  }}
                                  style={{ backgroundColor: STATUS_COLOR[next], fontWeight: 800, borderRadius: 99 }}
                                >
                                  {next === 'CHECKED_IN' ? 'Check In' : 'Complete'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.dayFoot}>
            <Button appearance="secondary" onClick={() => setDayListOpen(false)}>Close</Button>
            {onDateClick && (
              <Button
                appearance="primary"
                icon={<AddOutlinedIcon />}
                onClick={() => {
                  setDayListOpen(false);
                  onDateClick(selected.toLocaleDateString('en-CA'));
                }}
              >
                New appointment
              </Button>
            )}
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
