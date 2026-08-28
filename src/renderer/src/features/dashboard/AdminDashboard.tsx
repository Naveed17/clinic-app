import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, Paper, Stack, Typography, Chip, Avatar, LinearProgress, CircularProgress, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import { appointmentsService } from '@/services/appointments.service';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import type { Token, TokenStatus } from '@/types/token';
import type { Appointment } from '@/types/appointment';
import doctorImg from '@/assets/doctor_banner.png';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { LiveClock } from '@/components/LiveClock';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;


export function AdminDashboard(): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const { can } = useLicense();
  const showReports = can('reports');
  const showBilling = can('billing');
  const showTokens = can('tokens');

  const summary = useQuery({ queryKey: ['reports:summary'], queryFn: reportsService.summary, staleTime: 30_000, enabled: showReports });
  const patients = useQuery({ queryKey: ['patients', { page: 1, pageSize: 1, search: '' }], queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }), staleTime: 30_000 });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, staleTime: 30_000, enabled: showBilling });
  const appointments = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsService.list, staleTime: 30_000 });

  const totalRevenue = (invoices.data ?? []).reduce((s, inv) => s + inv.total, 0);
  const paidInvoices = (invoices.data ?? []).filter((i) => i.status === 'PAID').length;
  const totalInvoices = invoices.data?.length ?? 0;
  const completedAppts = (appointments.data ?? []).filter((a) => a.status === 'COMPLETED').length;
  const totalAppts = appointments.data?.length ?? 0;

  // Doctor load calculation
  const doctorMap = new Map<string, { name: string; avatar: string | null; count: number }>();
  (appointments.data ?? []).forEach((a) => {
    if (a.status === 'CANCELLED') return;
    const key = a.provider.id;
    if (!doctorMap.has(key)) {
      doctorMap.set(key, {
        name: `Dr. ${a.provider.firstName} ${a.provider.lastName}`,
        avatar: a.provider.avatar ?? null,
        count: 0,
      });
    }
    doctorMap.get(key)!.count += 1;
  });
  const doctors = Array.from(doctorMap.values()).sort((a, b) => b.count - a.count);

  const todaysPatientsCount = showReports
    ? (summary.data?.todaysPatients ?? 0)
    : (appointments.data ?? []).filter((a) => {
        if (a.status === 'CANCELLED' || !a.startsAt) return false;
        const d = new Date(a.startsAt);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }).length;
  const paidPercentage = totalInvoices ? Math.round((paidInvoices / totalInvoices) * 100) : 0;
  const apptPercentage = totalAppts ? Math.round((completedAppts / totalAppts) * 100) : 0;

  const statCards = [
    {
      label: 'Total Patients',
      value: patients.data?.total ?? 0,
      subtext: 'Registered patients',
      percent: patients.data?.total ? 85 : 0,
      color: theme.palette.info.main,
    },
    {
      label: 'Today Appointments',
      value: todaysPatientsCount,
      subtext: 'Scheduled for today',
      percent: apptPercentage,
      color: theme.palette.secondary.main,
    },
    showReports && {
      label: 'Monthly Revenue',
      value: money(summary.data?.monthlyRevenue ?? 0),
      subtext: 'Current month total',
      percent: summary.data?.monthlyRevenue ? 92 : 0,
      color: theme.palette.success.main,
    },
    showBilling && {
      label: 'Total Invoices',
      value: totalInvoices,
      subtext: `${paidInvoices} paid invoices`,
      percent: paidPercentage,
      color: theme.palette.warning.main,
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string | number;
    subtext: string;
    percent: number;
    color: string;
  }>;

  return (
    <Stack spacing={3} sx={{ pb: 3 }}>
      {/* Top Welcome Title */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Hi {user?.name || 'Admin'},
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
            Welcome Back!
          </Typography>
        </Box>
        <LiveClock />
      </Stack>

      {/* Top Section: Banner + Right Mini Calendar */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' } }}>
        <Box sx={{ position: 'relative', overflow: 'visible' }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 1,
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 100%)`,
              color: theme.palette.primary.contrastText,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              overflow: 'visible',
              minHeight: 350,
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            {/* Subtle Decorative Concentric Circles */}
            <Box sx={{ position: 'absolute', right: 45, bottom: 14, width: 280, height: 280, borderRadius: '50%', border: `2px solid ${alpha(theme.palette.common.white, 0.18)}`, pointerEvents: 'none', overflow: 'hidden' }} />
            <Box sx={{ position: 'absolute', right: 120, bottom: 7, width: 340, height: 340, borderRadius: '50%', border: `2px solid ${alpha(theme.palette.common.white, 0.12)}`, pointerEvents: 'none', overflow: 'hidden' }} />

            <Box sx={{ zIndex: 1, maxWidth: { xs: '100%', sm: '58%' } }}>
              <Typography variant="body2" sx={{ opacity: 0.88, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                CareFlow Clinic Operations
              </Typography>
              <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 0.75, mb: 1, lineHeight: 1.3, textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}` }}>
                Real-time Patient Queue & Live Performance Summary
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                Seamlessly monitor staff load, appointments, and OPD workflow.
              </Typography>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                right: 24,
                top: -150,
                bottom: 0,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <Box
                component="img"
                src={doctorImg}
                alt="Doctor"
                sx={{
                  height: 'calc(100% + 3px)',
                  width: 'auto',
                  maxWidth: 460,
                  objectFit: 'contain',
                  objectPosition: 'bottom',
                  filter: `drop-shadow(0 8px 20px ${alpha(theme.palette.common.black, 0.2)})`
                }}
              />
            </Box>
          </Paper>
        </Box>

        {/* Mini Calendar Widget */}
        <MiniCalendarWidget appointments={appointments.data ?? []} />
      </Box>

      {/* Middle Section */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' } }}>
        <Stack spacing={2.5}>
          {/* 2x2 Stat Cards */}
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
            {patients.isLoading || appointments.isLoading || (showReports && summary.isLoading) || (showBilling && invoices.isLoading) ? (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <StatCardsSkeleton count={statCards.length || 4} />
              </Box>
            ) : (
            statCards.map((c) => (
              <Paper
                key={c.label}
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '24px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'light' ? `0 4px 20px ${alpha(theme.palette.common.black, 0.03)}` : 'none',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'light' ? `0 8px 24px ${alpha(theme.palette.common.black, 0.06)}` : 'none'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {c.value}
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 0.75, fontSize: '0.9rem' }}>
                      {c.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontWeight: 500 }}>
                      {c.subtext}
                    </Typography>
                  </Box>

                  <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    <CircularProgress
                      variant="determinate"
                      value={c.percent}
                      size={58}
                      thickness={4.5}
                      sx={{ color: c.color, bgcolor: alpha(c.color, 0.12), borderRadius: '50%' }}
                    />
                    <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" component="div" fontWeight={800} sx={{ fontSize: '0.72rem', color: c.color }}>
                        {`${c.percent}%`}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Paper>
            ))
            )}
          </Box>

          {/* Billing & Appointment Health Card */}
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: theme.palette.mode === 'light' ? `0 4px 20px ${alpha(theme.palette.common.black, 0.03)}` : 'none'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
              <Box>
                <Typography variant="h6" fontWeight={800} fontSize="1.1rem">
                  Billing & Appointment Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Revenue collection and appointment completion rate
                </Typography>
              </Box>
              <Chip
                label="Realtime"
                size="small"
                color="primary"
                sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '10px' }}
              />
            </Stack>

            <Stack spacing={2.5}>
              {showBilling && (
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '24px',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      Paid Invoices
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Revenue collected from issued bills
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={800} color="primary.main">
                    {paidPercentage}%
                  </Typography>
                </Stack>

                <Box sx={{ width: '100%', height: 14, borderRadius: 99, bgcolor: alpha(theme.palette.primary.main, 0.18), overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${paidPercentage}%`,
                      height: '100%',
                      bgcolor: theme.palette.primary.main,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </Box>

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    {paidInvoices} of {totalInvoices} invoices
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totalInvoices ? `${Math.round((paidInvoices / totalInvoices) * 100)}% settled` : 'No invoices'}
                  </Typography>
                </Stack>
              </Box>
              )}

              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '24px',
                  bgcolor: alpha(theme.palette.secondary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      Completed Appointments
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Appointments successfully closed
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={800} color="secondary.main">
                    {apptPercentage}%
                  </Typography>
                </Stack>

                <Box sx={{ width: '100%', height: 14, borderRadius: 99, bgcolor: alpha(theme.palette.secondary.main, 0.18), overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${apptPercentage}%`,
                      height: '100%',
                      bgcolor: theme.palette.secondary.main,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </Box>

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    {completedAppts} of {totalAppts} appointments
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totalAppts ? `${Math.round((completedAppts / totalAppts) * 100)}% complete` : 'No appointments'}
                  </Typography>
                </Stack>
              </Box>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  pt: 1.5,
                  px: 1,
                  borderTop: '1px dashed',
                  borderColor: 'divider'
                }}
              >
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Total Accumulated Revenue
                </Typography>
                <Typography fontWeight={900} color="primary.main" fontSize="1.3rem">
                  {money(totalRevenue)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Stack>

        {/* Doctor Performance */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '24px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: theme.palette.mode === 'light' ? `0 4px 20px ${alpha(theme.palette.common.black, 0.03)}` : 'none'
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
            <Typography variant="h6" fontWeight={800} fontSize="1.05rem">
              Doctor Performance
            </Typography>
            <Button size="small" sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'none', color: 'primary.main' }}>
              View all
            </Button>
          </Stack>

          {doctors.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', my: 'auto' }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>No doctor appointments today.</Typography>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ flex: 1 }}>
              {doctors.map((doc, idx) => (
                <Paper
                  key={doc.name}
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: '18px',
                    bgcolor: alpha(theme.palette.background.default, 0.7),
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) }
                  }}
                >
                  <Chip
                    label={`#${idx + 1}`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      bgcolor: idx === 0 ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.text.primary, 0.08),
                      color: idx === 0 ? 'primary.main' : 'text.secondary',
                      borderRadius: '8px'
                    }}
                  />
                  <DoctorAvatar src={doc.avatar} name={doc.name} size={38} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800} noWrap fontSize="0.9rem">
                      {doc.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      Consultant Doctor
                    </Typography>
                  </Box>
                  <Chip
                    label={`${doc.count} patients`}
                    size="small"
                    color="primary"
                    sx={{
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                    }}
                  />
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Live Token Queue Panel */}
      {showTokens && <TokenQueuePanel />}
    </Stack>
  );
}

{/* Interactive Mini Calendar Component */ }
function MiniCalendarWidget({ appointments }: { appointments: Appointment[] }): React.JSX.Element {
  const theme = useTheme();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();

  const daysHeader = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const apptDateMap = new Map<number, string[]>();
  (appointments ?? []).forEach((a) => {
    if (!a.startsAt) return;
    const d = new Date(a.startsAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!apptDateMap.has(day)) apptDateMap.set(day, []);
      const color = a.status === 'COMPLETED' ? theme.palette.primary.main : a.status === 'CANCELLED' ? theme.palette.error.main : theme.palette.info.main;
      const list = apptDateMap.get(day)!;
      if (list.length < 3) list.push(color);
    }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: '24px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} fontSize="0.95rem">
          {monthName}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Box sx={{ p: 0.5, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
            <ChevronLeftIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </Box>
          <Box sx={{ p: 0.5, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
            <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </Box>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, textAlign: 'center' }}>
        {daysHeader.map((d) => (
          <Typography key={d} variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.62rem', py: 0.5 }}>
            {d}
          </Typography>
        ))}
        {cells.map((day, idx) => {
          const dots = day ? apptDateMap.get(day) : undefined;
          const isToday = day === todayDate;

          return (
            <Box key={idx} sx={{ height: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {day ? (
                <>
                  <Box
                    sx={{
                      width: 25,
                      height: 25,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isToday ? theme.palette.primary.main : 'transparent',
                      color: isToday ? theme.palette.primary.contrastText : 'text.primary',
                      fontWeight: isToday ? 800 : 500,
                      fontSize: '0.78rem',
                      boxShadow: isToday ? `0 4px 10px ${alpha(theme.palette.primary.main, 0.35)}` : 'none'
                    }}
                  >
                    {day}
                  </Box>
                  <Stack direction="row" spacing={0.4} sx={{ height: 4, mt: 0.25 }}>
                    {dots && dots.length > 0 ? (
                      dots.map((dotColor, dIdx) => (
                        <Box
                          key={dIdx}
                          sx={{
                            width: 3.5,
                            height: 3.5,
                            borderRadius: '50%',
                            bgcolor: isToday ? theme.palette.primary.contrastText : dotColor,
                          }}
                        />
                      ))
                    ) : (
                      <Box sx={{ height: 3.5 }} />
                    )}
                  </Stack>
                </>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

const statusConfig: Record<TokenStatus, { label: string; color: 'warning' | 'success' | 'default' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  DONE: { label: 'Completed', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

{/* Token Queue Panel */ }
function TokenQueuePanel(): React.JSX.Element {
  const theme = useTheme();
  const { data: tokens = [], isLoading } = useQuery<Token[]>({
    queryKey: ['tokens', todayStr()],
    queryFn: () => window.clinic.tokens.list(todayStr()),
    staleTime: 30_000,
  });

  const [displayLimit, setDisplayLimit] = useState(20);

  const displayedTokens = useMemo(
    () => tokens.slice(0, displayLimit),
    [tokens, displayLimit],
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setDisplayLimit((prev) => (prev < tokens.length ? Math.min(tokens.length, prev + 20) : prev));
    }
  };

  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const done = tokens.filter((t) => t.status === 'DONE').length;
  const current = tokens.find((t) => t.status === 'WAITING');

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3.5,
        borderRadius: '24px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'light' ? `0 4px 20px ${alpha(theme.palette.common.black, 0.03)}` : 'none'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} fontSize="1.1rem">
            Live Token Queue
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Today's OPD token tracking
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip
            label={`${waiting} Waiting`}
            color="warning"
            size="small"
            variant="outlined"
            sx={{ borderRadius: '12px', fontWeight: 700, px: 0.5 }}
          />
          <Chip
            label={`${done} Completed`}
            color="success"
            size="small"
            variant="outlined"
            sx={{ borderRadius: '12px', fontWeight: 700, px: 0.5 }}
          />
        </Stack>
      </Stack>

      {/* Featured NOW SERVING Card */}
      {current && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.04)} 100%)`,
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.35),
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2.5}>
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                color: theme.palette.primary.contrastText,
                textAlign: 'center',
                minWidth: 105,
                boxShadow: `0 6px 18px ${alpha(theme.palette.primary.main, 0.35)}`
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.9, letterSpacing: '0.05em', fontWeight: 800 }}>
                NOW SERVING
              </Typography>
              <Typography sx={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1, mt: 0.2 }}>
                #{String(current.tokenNumber).padStart(3, '0')}
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={800}>
                  {current.patient.firstName} {current.patient.lastName}
                </Typography>
                <Chip label="Active" color="success" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, borderRadius: '6px' }} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Assigned Doctor: <strong>Dr. {current.doctor.firstName} {current.doctor.lastName}</strong>
                {current.reason ? ` • ${current.reason}` : ''}
              </Typography>
            </Box>

            <Chip
              label={statusConfig[current.status].label}
              color={statusConfig[current.status].color}
              sx={{ fontWeight: 800, px: 1, borderRadius: '12px' }}
            />
          </Stack>
        </Paper>
      )}

      {/* Token List */}
      {isLoading ? (
        <ListCardsSkeleton count={5} />
      ) : tokens.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" fontWeight={500}>No OPD tokens generated for today.</Typography>
        </Box>
      ) : (
        <Box onScroll={handleScroll} sx={{ maxHeight: 460, overflowY: 'auto', pr: 0.5 }}>
          <Stack spacing={1.2}>
            {displayedTokens.map((token: Token) => {
              const cfg = statusConfig[token.status];
              const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
              const chipColorKey = cfg.color === 'default' ? 'action' : cfg.color;
              const mainColor = cfg.color === 'default' ? theme.palette.action.active : theme.palette[cfg.color].main;

              return (
                <Paper
                  key={token.id}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.75,
                    borderRadius: '18px',
                    border: '1px solid',
                    borderColor: token.status === 'WAITING' ? alpha(theme.palette.warning.main, 0.4) : 'divider',
                    bgcolor: token.status === 'WAITING' ? alpha(theme.palette.warning.main, 0.02) : 'transparent',
                    opacity: isDone ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.action.hover, 0.05)
                    }
                  }}
                >
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      fontWeight: 900,
                      fontSize: 13,
                      bgcolor: alpha(mainColor, 0.12),
                      color: cfg.color === 'default' ? 'text.secondary' : `${cfg.color}.main`,
                      border: '1px solid',
                      borderColor: alpha(mainColor, 0.25)
                    }}
                  >
                    #{String(token.tokenNumber).padStart(3, '0')}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontSize="0.92rem" fontWeight={700} noWrap>
                      {token.patient.firstName} {token.patient.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      Dr. {token.doctor.firstName} {token.doctor.lastName}{token.reason ? ` • ${token.reason}` : ''}
                    </Typography>
                  </Box>
                  <Chip
                    label={cfg.label}
                    color={cfg.color}
                    size="small"
                    sx={{ fontWeight: 700, minWidth: 90, borderRadius: '12px' }}
                  />
                </Paper>
              );
            })}
            {displayedTokens.length < tokens.length && (
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ display: 'block', py: 1.5, fontStyle: 'italic' }}>
                Scroll down to load more ({displayedTokens.length} of {tokens.length} tokens loaded)...
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}