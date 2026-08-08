import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { useQuery } from '@tanstack/react-query';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import type { Appointment } from '@/types/appointment';
import type { Invoice } from '@/types/invoice';

type OverviewRange = 'weekly' | 'monthly' | 'yearly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function money(v: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(v)}`;
}

function dayOrdinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

type ReasonTrendPoint = {
  label: string;
  fullLabel: string;
  total: number;
  topReason: string;
  topCount: number;
};

function topReasonFromList(list: Appointment[]): { topReason: string; topCount: number } {
  const counts: Record<string, number> = {};
  list.forEach((a) => {
    const raw = (a.reason && a.reason.trim()) || 'Unspecified';
    counts[raw] = (counts[raw] ?? 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { topReason: '—', topCount: 0 };
  return { topReason: entries[0][0], topCount: entries[0][1] };
}

/** Rounded vertical highlight band for Overview (ReferenceLine can't round corners). */
function OverviewActiveBand(props: {
  activeIndex: number;
  activeLabel?: string;
  bandFill?: string;
  xAxisMap?: Record<
    string,
    {
      scale?: ((v: string | number) => number) & { bandwidth?: () => number };
      bandwidth?: () => number;
    }
  >;
  offset?: { top: number; height: number };
}) {
  const { activeIndex, activeLabel, bandFill = 'rgba(255,255,255,0.14)', xAxisMap, offset } = props;
  if (!xAxisMap || !offset || activeIndex < 0 || !activeLabel) return null;
  const xAxis = Object.values(xAxisMap)[0];
  if (!xAxis?.scale) return null;

  let x = xAxis.scale(activeLabel);
  const bw =
    (typeof xAxis.bandwidth === 'function' ? xAxis.bandwidth() : undefined) ??
    (typeof xAxis.scale.bandwidth === 'function' ? xAxis.scale.bandwidth() : 0) ??
    0;
  if (bw > 0) x += bw / 2;

  const width = 46;
  const radius = 23;
  const padY = 6;

  return (
    <rect
      x={x - width / 2}
      y={offset.top + padY}
      width={width}
      height={Math.max(0, offset.height - padY * 2)}
      rx={radius}
      ry={radius}
      fill={bandFill}
      style={{ pointerEvents: 'none' }}
    />
  );
}

function buildOverview(
  range: OverviewRange,
  appointments: Appointment[],
  invoices: Invoice[],
): { label: string; appointments: number; revenue: number }[] {
  const now = new Date();

  if (range === 'weekly') {
    return Array.from({ length: 7 }, (_, i) => {
      const day = startOfDay(now);
      day.setDate(day.getDate() - (6 - i));
      const appts = appointments.filter((a) => sameDay(new Date(a.startsAt), day)).length;
      const revenue = invoices
        .filter((inv) => sameDay(new Date(inv.createdAt), day))
        .reduce((s, inv) => s + Number(inv.total || 0), 0);
      return {
        label: `${WEEKDAYS[day.getDay()]} ${day.getDate()}`,
        appointments: appts,
        revenue,
      };
    });
  }

  if (range === 'monthly') {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const appts = appointments.filter((a) => {
        const t = new Date(a.startsAt);
        return t.getFullYear() === y && t.getMonth() === m;
      }).length;
      const revenue = invoices
        .filter((inv) => {
          const t = new Date(inv.createdAt);
          return t.getFullYear() === y && t.getMonth() === m;
        })
        .reduce((s, inv) => s + Number(inv.total || 0), 0);
      return {
        label: `${MONTHS[m]} ${String(y).slice(2)}`,
        appointments: appts,
        revenue,
      };
    });
  }

  // yearly — last 5 calendar years including current
  return Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - (4 - i);
    const appts = appointments.filter((a) => new Date(a.startsAt).getFullYear() === y).length;
    const revenue = invoices
      .filter((inv) => new Date(inv.createdAt).getFullYear() === y)
      .reduce((s, inv) => s + Number(inv.total || 0), 0);
    return { label: String(y), appointments: appts, revenue };
  });
}

function StatCard({
  label,
  value,
  note,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  color: string;
  icon: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          bottom: -14,
          right: -14,
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(color, 0.1),
        }}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '12px',
            bgcolor: alpha(color, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography sx={{ mt: 2, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        {note}
      </Typography>
    </Paper>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
  height = 240,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          mb: 2.5,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography fontWeight={800} letterSpacing="-0.01em">
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            {subtitle}
          </Typography>
        </Box>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight: height }}>{children}</Box>
    </Paper>
  );
}

export function StatisticsPage(): React.JSX.Element {
  const theme = useTheme();
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('monthly');
  const [rangeMenuEl, setRangeMenuEl] = useState<null | HTMLElement>(null);
  const [activeOverviewIdx, setActiveOverviewIdx] = useState(0);
  const [reasonView, setReasonView] = useState<'year' | 'month'>('year');
  const [reasonYear, setReasonYear] = useState(() => new Date().getFullYear());
  const [reasonYearMenuEl, setReasonYearMenuEl] = useState<null | HTMLElement>(null);
  const [activeReasonIdx, setActiveReasonIdx] = useState(0);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.list,
  });
  const { data: patientsData } = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, search: '' }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }),
  });

  const year = new Date().getFullYear();

  const overviewData = useMemo(
    () => buildOverview(overviewRange, appointments as Appointment[], invoices as Invoice[]),
    [overviewRange, appointments, invoices],
  );

  useEffect(() => {
    if (!overviewData.length) {
      setActiveOverviewIdx(0);
      return;
    }
    const peak = overviewData.reduce(
      (best, row, idx, arr) => (row.appointments > arr[best].appointments ? idx : best),
      0,
    );
    setActiveOverviewIdx(peak);
  }, [overviewData, overviewRange]);

  const activeOverview = overviewData[activeOverviewIdx] ?? overviewData[0];
  const overviewAvg =
    overviewData.length > 0
      ? Math.round(overviewData.reduce((s, r) => s + r.appointments, 0) / overviewData.length)
      : 0;

  const monthlyAppts = useMemo(
    () =>
      MONTHS.map((month, i) => ({
        month,
        appointments: (appointments as Appointment[]).filter((a) => {
          const d = new Date(a.startsAt);
          return d.getFullYear() === year && d.getMonth() === i;
        }).length,
      })),
    [appointments, year],
  );

  const monthlyRevenue = useMemo(
    () =>
      MONTHS.map((month, i) => ({
        month,
        revenue: (invoices as Invoice[])
          .filter((inv) => {
            const d = new Date(inv.createdAt);
            return d.getFullYear() === year && d.getMonth() === i;
          })
          .reduce((sum, inv) => sum + Number(inv.total || 0), 0),
      })),
    [invoices, year],
  );

  const statusCounts: Record<string, number> = {};
  (appointments as Appointment[]).forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  const reasonYears = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    (appointments as Appointment[]).forEach((a) => {
      set.add(new Date(a.startsAt).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [appointments]);

  const reasonTrendData = useMemo((): ReasonTrendPoint[] => {
    const list = appointments as Appointment[];
    if (reasonView === 'year') {
      return MONTHS.map((month, i) => {
        const inMonth = list.filter((a) => {
          const d = new Date(a.startsAt);
          return d.getFullYear() === reasonYear && d.getMonth() === i;
        });
        const top = topReasonFromList(inMonth);
        return {
          label: month,
          fullLabel: new Date(reasonYear, i, 1).toLocaleString('en', { month: 'long' }),
          total: inMonth.length,
          ...top,
        };
      });
    }

    const now = new Date();
    const monthIdx = reasonYear === now.getFullYear() ? now.getMonth() : 11;
    const daysInMonth = new Date(reasonYear, monthIdx + 1, 0).getDate();
    const monthName = new Date(reasonYear, monthIdx, 1).toLocaleString('en', { month: 'long' });

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const inDay = list.filter((a) => {
        const d = new Date(a.startsAt);
        return d.getFullYear() === reasonYear && d.getMonth() === monthIdx && d.getDate() === day;
      });
      const top = topReasonFromList(inDay);
      return {
        label: String(day),
        fullLabel: `${dayOrdinal(day)} of ${monthName}`,
        total: inDay.length,
        ...top,
      };
    });
  }, [appointments, reasonView, reasonYear]);

  useEffect(() => {
    if (!reasonTrendData.length) {
      setActiveReasonIdx(0);
      return;
    }
    const peak = reasonTrendData.reduce(
      (best, row, idx, arr) => (row.total > arr[best].total ? idx : best),
      0,
    );
    setActiveReasonIdx(peak);
  }, [reasonTrendData]);

  const activeReasonPoint = reasonTrendData[activeReasonIdx] ?? reasonTrendData[0];

  const totalRevenue = (invoices as Invoice[]).reduce((s, inv) => s + Number(inv.total || 0), 0);
  const completedAppts = (appointments as Appointment[]).filter((a) => a.status === 'COMPLETED').length;
  const completionPct = appointments.length
    ? Math.round((completedAppts / appointments.length) * 100)
    : 0;
  const green = theme.palette.primary.main;
  const greenDeep = theme.palette.primary.dark || '#15803d';
  const blue = theme.palette.secondary.main;
  const success = theme.palette.success.main;

  // Soft modern palette anchored to theme greens/blues
  const PIE_COLORS = [
    green,
    alpha(green, 0.72),
    blue,
    theme.palette.warning.main,
    alpha(blue, 0.65),
  ];

  const axisTick = {
    fontSize: 11,
    fill: alpha(theme.palette.text.secondary, 0.85),
    fontFamily: theme.typography.fontFamily,
    fontWeight: 600,
  };

  const peakMonthIdx = monthlyAppts.reduce(
    (mi, m, idx, arr) => (m.appointments > arr[mi].appointments ? idx : mi),
    0,
  );

  return (
    <Stack spacing={2.5} sx={{ pb: 2 }}>
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          Clinic analytics
        </Typography>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
          Statistics
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }} fontWeight={500}>
          Theme-aligned overview of appointments, revenue and visit trends.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label="Total Appointments"
          value={appointments.length}
          note="All time"
          color={theme.palette.primary.main}
          icon={<CalendarMonthOutlinedIcon fontSize="small" />}
        />
        <StatCard
          label="Completed"
          value={completedAppts}
          note={`${appointments.length ? Math.round((completedAppts / appointments.length) * 100) : 0}% completion rate`}
          color={theme.palette.success.main}
          icon={<TrendingUpOutlinedIcon fontSize="small" />}
        />
        <StatCard
          label="Total Revenue"
          value={money(totalRevenue)}
          note="From all invoices"
          color={theme.palette.secondary.main}
          icon={<PaymentsOutlinedIcon fontSize="small" />}
        />
        <StatCard
          label="Total Patients"
          value={patientsData?.total ?? 0}
          note="Registered patients"
          color={theme.palette.warning.main}
          icon={<GroupOutlinedIcon fontSize="small" />}
        />
      </Box>

      {/* Overview — theme-aware soft green card */}
      {(() => {
        const isLight = theme.palette.mode === 'light';
        // Soft / muted greens — avoid heavy neon forest wash
        const line = isLight ? '#4ade80' : '#6ee7b7';
        const lineDeep = isLight ? '#22c55e' : '#34d399';
        const ink = isLight ? theme.palette.text.primary : '#fff';
        const muted = isLight ? alpha(theme.palette.text.primary, 0.55) : alpha('#fff', 0.5);
        const softMuted = isLight ? alpha(theme.palette.text.primary, 0.4) : alpha('#fff', 0.38);
        const bandFill = isLight ? alpha('#86efac', 0.2) : alpha('#fff', 0.1);
        const shoulderBg = isLight ? alpha('#16a34a', 0.04) : alpha('#000', 0.35);
        const tipBg = isLight ? '#fff' : 'rgba(18,18,20,0.94)';
        const tipFg = isLight ? theme.palette.text.primary : '#fff';
        const pillFill = isLight ? green : '#fff';
        const pillText = isLight ? '#fff' : '#111';
        const tickMuted = isLight ? alpha(theme.palette.text.primary, 0.4) : alpha('#fff', 0.42);

        return (
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '28px',
          border: '1px solid',
          borderColor: isLight ? alpha(green, 0.1) : alpha('#fff', 0.08),
          color: ink,
          // Light: near-white mint whisper · Dark: neutral charcoal (not forest green)
          background: isLight
            ? 'linear-gradient(165deg, #ffffff 0%, #fbfefc 55%, #f5fbf7 100%)'
            : 'linear-gradient(165deg, #121416 0%, #161a1c 40%, #1a1f22 100%)',
          boxShadow: isLight
            ? `0 8px 28px ${alpha(theme.palette.common.black, 0.05)}`
            : `0 20px 48px ${alpha('#000', 0.4)}`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              borderRadius: '50%',
              filter: 'blur(40px)',
            },
            '&::before': {
              width: '70%',
              height: '55%',
              top: '8%',
              left: '-10%',
              background: alpha(line, isLight ? 0.06 : 0.06),
            },
            '&::after': {
              width: '65%',
              height: '50%',
              top: '18%',
              right: '-15%',
              background: alpha(lineDeep, isLight ? 0.04 : 0.04),
            },
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1, pt: { xs: 2.5, md: 3 }, px: { xs: 2.25, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography fontWeight={800} fontSize={22} letterSpacing="-0.02em" color={ink}>
              Overview
            </Typography>

            <Button
              size="small"
              endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
              onClick={(e) => setRangeMenuEl(e.currentTarget)}
              sx={{
                textTransform: 'none',
                color: ink,
                fontWeight: 600,
                fontSize: 13,
                px: 1.85,
                py: 0.7,
                borderRadius: 99,
                border: `1px solid ${isLight ? alpha(green, 0.28) : alpha('#fff', 0.2)}`,
                bgcolor: isLight ? alpha('#fff', 0.7) : alpha('#fff', 0.05),
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: isLight ? alpha(green, 0.08) : alpha('#fff', 0.1),
                },
              }}
            >
              {overviewRange === 'weekly' ? 'Weekly' : overviewRange === 'yearly' ? 'Yearly' : 'Monthly'}
            </Button>
            <Menu
              anchorEl={rangeMenuEl}
              open={Boolean(rangeMenuEl)}
              onClose={() => setRangeMenuEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: { mt: 1, borderRadius: 2.5, minWidth: 140, boxShadow: '0 12px 32px rgba(0,0,0,0.14)' },
              }}
            >
              {(
                [
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                  ['yearly', 'Yearly'],
                ] as const
              ).map(([value, label]) => (
                <MenuItem
                  key={value}
                  selected={overviewRange === value}
                  onClick={() => {
                    setOverviewRange(value);
                    setRangeMenuEl(null);
                  }}
                >
                  {label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>

          <Box sx={{ position: 'relative', mt: 0.5 }}>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={overviewData}
                  margin={{ top: 40, right: 12, left: 6, bottom: 8 }}
                  onMouseMove={(state) => {
                    const idx = state?.activeTooltipIndex;
                    if (typeof idx === 'number' && idx >= 0 && idx !== activeOverviewIdx) {
                      setActiveOverviewIdx(idx);
                    }
                  }}
                  onClick={(state) => {
                    const idx = state?.activeTooltipIndex;
                    if (typeof idx === 'number' && idx >= 0) setActiveOverviewIdx(idx);
                  }}
                >
                  <defs>
                    <linearGradient id="overviewAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={isLight ? '#bbf7d0' : '#6ee7b7'}
                        stopOpacity={isLight ? 0.32 : 0.22}
                      />
                      <stop
                        offset="45%"
                        stopColor={isLight ? '#dcfce7' : '#34d399'}
                        stopOpacity={isLight ? 0.12 : 0.08}
                      />
                      <stop
                        offset="100%"
                        stopColor={isLight ? '#f0fdf4' : '#166534'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <filter id="overviewStrokeGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation={isLight ? 2.2 : 2} result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 6"
                    stroke={isLight ? alpha('#14532d', 0.1) : alpha('#fff', 0.1)}
                    vertical={false}
                  />

                  <Customized
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    component={(chartProps: any) => (
                      <OverviewActiveBand
                        xAxisMap={chartProps.xAxisMap}
                        offset={chartProps.offset}
                        activeIndex={activeOverviewIdx}
                        activeLabel={activeOverview?.label}
                        bandFill={bandFill}
                      />
                    )}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={56}
                    tick={(tickProps) => {
                      const { x, y, payload, index } = tickProps as {
                        x: number;
                        y: number;
                        payload: { value: string };
                        index: number;
                      };
                      const active = index === activeOverviewIdx;
                      const text = String(payload?.value ?? '');
                      const pillH = 26;
                      const pillW = Math.max(pillH, text.length * 7.4 + 20);
                      if (active) {
                        return (
                          <g
                            transform={`translate(${x},${y})`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setActiveOverviewIdx(index)}
                          >
                            <rect
                              x={-pillW / 2}
                              y={8}
                              width={pillW}
                              height={pillH}
                              rx={pillH / 2}
                              ry={pillH / 2}
                              fill={pillFill}
                            />
                            <text
                              x={0}
                              y={8 + pillH / 2 + 4}
                              textAnchor="middle"
                              fill={pillText}
                              fontSize={11}
                              fontWeight={800}
                              fontFamily={theme.typography.fontFamily as string}
                            >
                              {text}
                            </text>
                          </g>
                        );
                      }
                      return (
                        <text
                          x={x}
                          y={y + 24}
                          textAnchor="middle"
                          fill={tickMuted}
                          fontSize={11}
                          fontWeight={600}
                          fontFamily={theme.typography.fontFamily as string}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setActiveOverviewIdx(index)}
                        >
                          {text}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    hide
                    domain={[
                      (min: number) => Math.max(0, min - 1),
                      (max: number) => Math.max(max + 2, 3),
                    ]}
                  />
                  <Tooltip cursor={false} content={() => null} />
                  <Area
                    type="monotone"
                    dataKey="appointments"
                    stroke="none"
                    fill="url(#overviewAreaFill)"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke={line}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    filter="url(#overviewStrokeGlow)"
                    isAnimationActive={false}
                    legendType="none"
                    dot={(props: {
                      cx?: number;
                      cy?: number;
                      index?: number;
                      payload?: { appointments: number };
                    }) => {
                      const { cx, cy, index, payload } = props;
                      if (cx == null || cy == null || index !== activeOverviewIdx) {
                        return <g key={`ov-empty-${index ?? 0}`} />;
                      }
                      const visits = payload?.appointments ?? 0;
                      const tipW = 104;
                      const tipH = 30;
                      return (
                        <g key={`ov-dot-${index}`}>
                          <foreignObject x={cx - tipW / 2} y={cy - tipH - 16} width={tipW} height={tipH}>
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: tipBg,
                                color: tipFg,
                                borderRadius: 12,
                                fontSize: 13,
                                fontWeight: 800,
                                fontFamily: theme.typography.fontFamily as string,
                                letterSpacing: '-0.01em',
                                boxShadow: isLight
                                  ? '0 8px 22px rgba(22,163,74,0.18)'
                                  : '0 10px 24px rgba(0,0,0,0.4)',
                                border: isLight ? '1px solid rgba(22,163,74,0.15)' : 'none',
                              }}
                            >
                              {visits.toLocaleString()} Visits
                            </div>
                          </foreignObject>
                          <circle cx={cx} cy={cy} r={10} fill={alpha(line, 0.28)} />
                          <circle cx={cx} cy={cy} r={6} fill={lineDeep} stroke={isLight ? '#fff' : '#fff'} strokeWidth={2.5} />
                        </g>
                      );
                    }}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>

            <Box
              sx={{
                position: 'relative',
                mt: 1,
                mx: { xs: -2.25, md: -3 },
                display: 'grid',
                gridTemplateColumns: '1fr 1.15fr 1fr',
                alignItems: 'stretch',
                minHeight: 120,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                  py: 2.75,
                  px: 1.5,
                  bgcolor: shoulderBg,
                  borderTopRightRadius: 44,
                }}
              >
                <Typography variant="caption" sx={{ color: muted, fontWeight: 600, display: 'block' }}>
                  Total Visits
                </Typography>
                <Typography fontWeight={900} fontSize={{ xs: 20, sm: 26 }} letterSpacing="-0.03em" sx={{ mt: 0.45, color: ink }}>
                  {(activeOverview?.appointments ?? 0).toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: softMuted, fontWeight: 500 }}>
                  {activeOverview?.label ?? '—'}
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'center', py: 2.75, px: 1.25, bgcolor: 'transparent' }}>
                <Typography variant="caption" sx={{ color: muted, fontWeight: 600, display: 'block' }}>
                  Revenue
                </Typography>
                <Typography fontWeight={900} fontSize={{ xs: 20, sm: 26 }} letterSpacing="-0.03em" sx={{ mt: 0.45, color: ink }}>
                  {money(activeOverview?.revenue ?? 0)}
                </Typography>
                <Typography variant="caption" sx={{ color: softMuted, fontWeight: 500 }}>
                  {activeOverview?.label ?? '—'}
                </Typography>
              </Box>

              <Box
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                  py: 2.75,
                  px: 1.5,
                  bgcolor: shoulderBg,
                  borderTopLeftRadius: 44,
                }}
              >
                <Typography variant="caption" sx={{ color: muted, fontWeight: 600, display: 'block' }}>
                  Avg Visits
                </Typography>
                <Typography fontWeight={900} fontSize={{ xs: 20, sm: 26 }} letterSpacing="-0.03em" sx={{ mt: 0.45, color: ink }}>
                  {overviewAvg.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: softMuted, fontWeight: 500 }}>
                  {activeOverview?.label ?? '—'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
        );
      })()}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <ChartCard
          title="Monthly Appointments"
          subtitle={`${year} · visit volume by month`}
          action={<Chip label={String(year)} size="small" color="primary" />}
        >
          <Box sx={{ borderRadius: 3, bgcolor: alpha(green, 0.04), px: 1, py: 1.5 }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={monthlyAppts}
                barSize={18}
                barCategoryGap="36%"
                margin={{ top: 22, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="capsuleBarGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#86efac" stopOpacity={1} />
                    <stop offset="55%" stopColor={green} stopOpacity={1} />
                    <stop offset="100%" stopColor={greenDeep} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke={alpha(green, 0.08)} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  cursor={{ fill: alpha(green, 0.06), radius: 12 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const v = Number(payload[0]?.value ?? 0);
                    return (
                      <Box
                        sx={{
                          bgcolor: green,
                          color: '#fff',
                          px: 1.75,
                          py: 1.1,
                          borderRadius: 2.5,
                          boxShadow: `0 10px 28px ${alpha(green, 0.35)}`,
                          minWidth: 120,
                        }}
                      >
                        <Typography fontWeight={800} fontSize={12} sx={{ opacity: 0.9 }}>
                          {label} {year}
                        </Typography>
                        <Typography fontWeight={900} fontSize={15}>
                          {v} visits
                        </Typography>
                      </Box>
                    );
                  }}
                />
                <Bar
                  dataKey="appointments"
                  radius={[999, 999, 999, 999]}
                  background={{ fill: alpha(green, 0.1), radius: 999 }}
                >
                  {monthlyAppts.map((row, i) => (
                    <Cell
                      key={row.month}
                      fill={row.appointments > 0 ? 'url(#capsuleBarGrad)' : alpha(green, 0.12)}
                      fillOpacity={row.appointments === 0 ? 1 : i === peakMonthIdx ? 1 : 0.7}
                    />
                  ))}
                  <LabelList
                    dataKey="appointments"
                    position="top"
                    offset={8}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fill: alpha(theme.palette.text.secondary, 0.75),
                      fontFamily: theme.typography.fontFamily as string,
                    }}
                    formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>

        <ChartCard
          title="Revenue Trend"
          subtitle={`${year} · invoice totals by month`}
          action={<Chip label="Revenue" size="small" color="success" />}
        >
          <Box sx={{ borderRadius: 3, bgcolor: alpha(success, 0.04), px: 1, py: 1.5 }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={monthlyRevenue}
                barSize={18}
                barCategoryGap="36%"
                margin={{ top: 22, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="revenueCapsuleGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#86efac" stopOpacity={1} />
                    <stop offset="50%" stopColor={success} stopOpacity={1} />
                    <stop offset="100%" stopColor="#166534" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke={alpha(success, 0.08)} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  cursor={{ fill: alpha(success, 0.06), radius: 12 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const v = Number(payload[0]?.value ?? 0);
                    return (
                      <Box
                        sx={{
                          bgcolor: success,
                          color: '#fff',
                          px: 1.75,
                          py: 1.1,
                          borderRadius: 2.5,
                          boxShadow: `0 10px 28px ${alpha(success, 0.35)}`,
                          minWidth: 130,
                        }}
                      >
                        <Typography fontWeight={800} fontSize={12} sx={{ opacity: 0.9 }}>
                          {label} {year}
                        </Typography>
                        <Typography fontWeight={900} fontSize={15}>
                          {money(v)}
                        </Typography>
                      </Box>
                    );
                  }}
                />
                <Bar
                  dataKey="revenue"
                  radius={[999, 999, 999, 999]}
                  background={{ fill: alpha(success, 0.1), radius: 999 }}
                  fill="url(#revenueCapsuleGrad)"
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 0.6fr' } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: `0 8px 28px ${alpha(theme.palette.common.black, 0.05)}`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1.5}
            sx={{ mb: 2 }}
          >
            <Typography fontWeight={800} fontSize={17} letterSpacing="-0.01em" color="text.primary">
              Appointment Reasons
            </Typography>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button
                size="small"
                endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
                onClick={(e) => setReasonYearMenuEl(e.currentTarget)}
                sx={{
                  textTransform: 'none',
                  color: green,
                  fontWeight: 700,
                  fontSize: 14,
                  px: 0.5,
                  minWidth: 0,
                  '&:hover': { bgcolor: alpha(green, 0.08) },
                }}
              >
                {reasonYear}
              </Button>
              <Menu
                anchorEl={reasonYearMenuEl}
                open={Boolean(reasonYearMenuEl)}
                onClose={() => setReasonYearMenuEl(null)}
                PaperProps={{ sx: { borderRadius: 2, minWidth: 100 } }}
              >
                {reasonYears.map((y) => (
                  <MenuItem
                    key={y}
                    selected={y === reasonYear}
                    onClick={() => {
                      setReasonYear(y);
                      setReasonYearMenuEl(null);
                    }}
                  >
                    {y}
                  </MenuItem>
                ))}
              </Menu>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: alpha(green, 0.06),
                  borderRadius: 99,
                  p: '3px',
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => setReasonView('year')}
                  sx={{
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.75,
                    py: 0.65,
                    borderRadius: 99,
                    bgcolor: reasonView === 'year' ? green : 'transparent',
                    color: reasonView === 'year' ? '#fff' : alpha(theme.palette.text.primary, 0.55),
                    boxShadow: reasonView === 'year' ? `0 4px 12px ${alpha(green, 0.35)}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Year
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setReasonView('month')}
                  sx={{
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.75,
                    py: 0.65,
                    borderRadius: 99,
                    bgcolor: reasonView === 'month' ? green : 'transparent',
                    color: reasonView === 'month' ? '#fff' : alpha(theme.palette.text.primary, 0.55),
                    boxShadow: reasonView === 'month' ? `0 4px 12px ${alpha(green, 0.35)}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Month
                </Box>
              </Box>
            </Stack>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={reasonTrendData}
                margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
                onMouseMove={(state) => {
                  const idx = state?.activeTooltipIndex;
                  if (typeof idx === 'number' && idx >= 0 && idx !== activeReasonIdx) {
                    setActiveReasonIdx(idx);
                  }
                }}
              >
                <defs>
                  <linearGradient id="reasonAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={theme.palette.mode === 'light' ? '#bbf7d0' : '#6ee7b7'}
                      stopOpacity={theme.palette.mode === 'light' ? 0.32 : 0.2}
                    />
                    <stop
                      offset="45%"
                      stopColor={theme.palette.mode === 'light' ? '#dcfce7' : '#34d399'}
                      stopOpacity={theme.palette.mode === 'light' ? 0.12 : 0.07}
                    />
                    <stop
                      offset="100%"
                      stopColor={theme.palette.mode === 'light' ? '#f0fdf4' : '#14532d'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <filter id="reasonLineGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke={alpha(theme.palette.text.primary, 0.08)} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                  interval={reasonView === 'month' ? 3 : 0}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip cursor={false} content={() => null} />
                {/* Soft mint wash under the curve (reference shade) */}
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="none"
                  fill="url(#reasonAreaFill)"
                  isAnimationActive={false}
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={theme.palette.mode === 'light' ? '#22c55e' : '#6ee7b7'}
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#reasonLineGlow)"
                  isAnimationActive={false}
                  legendType="none"
                  dot={(props: {
                    cx?: number;
                    cy?: number;
                    index?: number;
                    payload?: ReasonTrendPoint;
                  }) => {
                    const { cx, cy, index, payload } = props;
                    if (cx == null || cy == null || index !== activeReasonIdx || !payload) {
                      return <g key={`reason-dot-empty-${index ?? 0}`} />;
                    }
                    const tipW = 128;
                    const tipH = 48;
                    const accent = theme.palette.mode === 'light' ? '#22c55e' : '#6ee7b7';
                    return (
                      <g key={`reason-dot-${index}`}>
                        <foreignObject x={cx - tipW / 2} y={cy - tipH - 16} width={tipW} height={tipH}>
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              justifyContent: 'center',
                              background: alpha(theme.palette.grey[100], 0.96),
                              borderRadius: 10,
                              padding: '8px 12px',
                              boxSizing: 'border-box',
                              boxShadow: `0 8px 20px ${alpha('#000', 0.1)}`,
                              fontFamily: theme.typography.fontFamily as string,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: theme.palette.text.primary,
                                lineHeight: 1.2,
                              }}
                            >
                              {payload.fullLabel}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: accent,
                                marginTop: 2,
                                lineHeight: 1.2,
                              }}
                            >
                              {payload.topReason} {payload.topCount}{' '}
                              {payload.topCount === 1 ? 'visit' : 'visits'}
                            </div>
                          </div>
                        </foreignObject>
                        <circle cx={cx} cy={cy} r={5.5} fill={accent} stroke="#fff" strokeWidth={2} />
                      </g>
                    );
                  }}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>

          {activeReasonPoint ? (
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ mt: 1, display: 'block', textAlign: 'center' }}
            >
              Peak · {activeReasonPoint.fullLabel} · {activeReasonPoint.total} appointments
              {activeReasonPoint.topReason !== '—'
                ? ` · mostly ${activeReasonPoint.topReason}`
                : ''}
            </Typography>
          ) : null}
        </Paper>

        <ChartCard title="Completion Audit" subtitle="Radial status · all-time appointments">
          {appointments.length === 0 ? (
            <Box sx={{ display: 'grid', minHeight: 220, placeItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No data yet.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  py: 1,
                  borderRadius: 4,
                  bgcolor: alpha(green, 0.04),
                  minHeight: 230,
                }}
              >
                {(() => {
                  const size = 200;
                  const stroke = 20;
                  const cx = size / 2;
                  const cy = size / 2;
                  const r = (size - stroke) / 2 - 6;
                  const circ = 2 * Math.PI * r;
                  const pct = Math.min(100, Math.max(0, completionPct));
                  const dash = (pct / 100) * circ;
                  // Start at 9 o'clock (left), go clockwise
                  const startAngle = Math.PI; // radians
                  const markerX = cx + r * Math.cos(startAngle);
                  const markerY = cy + r * Math.sin(startAngle);
                  const remainingPct = Math.max(0, 100 - pct);

                  return (
                    <Box sx={{ position: 'relative', width: size, height: size }}>
                      <Box
                        component="svg"
                        width={size}
                        height={size}
                        viewBox={`0 0 ${size} ${size}`}
                        sx={{ display: 'block' }}
                      >
                        {/* Soft track */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill="none"
                          stroke={alpha(green, 0.12)}
                          strokeWidth={stroke}
                        />
                        {/* Progress arc */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill="none"
                          stroke={green}
                          strokeWidth={stroke}
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${circ}`}
                          transform={`rotate(180 ${cx} ${cy})`}
                          style={{
                            filter: `drop-shadow(0 6px 14px ${alpha(green, 0.35)})`,
                            transition: 'stroke-dasharray 0.4s ease',
                          }}
                        />
                        {/* White start marker */}
                        <circle
                          cx={markerX}
                          cy={markerY}
                          r={stroke / 2 - 3}
                          fill="#fff"
                          style={{
                            filter: `drop-shadow(0 2px 6px ${alpha('#000', 0.18)})`,
                          }}
                        />
                      </Box>

                      {/* Solid center core */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 108,
                          height: 108,
                          borderRadius: '50%',
                          bgcolor: green,
                          border: '5px solid #fff',
                          boxShadow: `
                            0 10px 28px ${alpha(green, 0.35)},
                            0 0 0 1px ${alpha(green, 0.08)},
                            inset 0 1px 0 ${alpha('#fff', 0.25)}
                          `,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundImage: `radial-gradient(circle at 35% 28%, ${alpha('#fff', 0.22)}, transparent 55%)`,
                        }}
                      >
                        <Typography
                          sx={{
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 28,
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                          }}
                        >
                          {pct}%
                        </Typography>
                        <Typography
                          sx={{
                            color: alpha('#fff', 0.78),
                            fontWeight: 600,
                            fontSize: 11,
                            mt: 0.35,
                          }}
                        >
                          Success
                        </Typography>
                      </Box>

                      {/* External remaining % label */}
                      <Typography
                        sx={{
                          position: 'absolute',
                          left: 2,
                          bottom: 10,
                          fontWeight: 800,
                          fontSize: 15,
                          color: greenDeep,
                        }}
                      >
                        {remainingPct}%
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>

              <Stack spacing={0.85} sx={{ mt: 1.5 }}>
                {pieData.map((entry, i) => {
                  const pct = Math.round((entry.value / appointments.length) * 100);
                  return (
                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                          boxShadow: `0 0 0 3px ${alpha(PIE_COLORS[i % PIE_COLORS.length], 0.18)}`,
                        }}
                      />
                      <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }}>
                        {entry.name}
                      </Typography>
                      <Box
                        sx={{
                          width: 64,
                          height: 6,
                          borderRadius: 99,
                          bgcolor: alpha(PIE_COLORS[i % PIE_COLORS.length], 0.12),
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: `linear-gradient(90deg, ${alpha(PIE_COLORS[i % PIE_COLORS.length], 0.7)}, ${PIE_COLORS[i % PIE_COLORS.length]})`,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" fontWeight={800} sx={{ minWidth: 28, textAlign: 'right' }}>
                        {pct}%
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </ChartCard>
      </Box>
    </Stack>
  );
}
