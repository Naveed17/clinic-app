import {
  Avatar,
  Badge,
  Button,
  ProgressBar,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
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
import { ChevronLeftIcon, ChevronRightIcon, ConfirmationNumberOutlinedIcon } from '@/icons/fluent';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

const COLORS = {
  teal: '#0D9488',
  emerald: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  slate: '#64748B',
  info: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  brand: '#0D9488',
  brandFg: '#ffffff',
  error: '#EF4444',
};

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    paddingBottom: '24px',
    maxWidth: '1280px',
  },
  headerRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalM,
  },
  greeting: {
    color: '#0D9488',
    fontSize: '15px',
    fontWeight: tokens.fontWeightSemibold,
  },
  welcome: {
    letterSpacing: '-0.03em',
    marginTop: '2px',
    fontWeight: '800' as unknown as number,
    fontSize: '28px',
    color: tokens.colorNeutralForeground1,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightRegular,
  },
  topGrid: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: '1fr',
  },
  /* ── Premium Glass Cards (CoachPro Glassmorphism) ── */
  card: {
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  /* ── Banner (frosted glass card) ── */
  bannerWrap: { position: 'relative', overflow: 'visible' },
  banner: {
    padding: '28px 32px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '160px',
  },
  bannerText: { position: 'relative', zIndex: 1, maxWidth: '65%' },
  bannerEyebrow: {
    color: '#0D9488',
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontSize: '12px',
  },
  bannerTitle: {
    letterSpacing: '-0.02em',
    marginTop: '8px',
    marginBottom: '8px',
    lineHeight: 1.35,
    fontWeight: '700' as unknown as number,
    fontSize: '22px',
    color: tokens.colorNeutralForeground1,
  },
  bannerImg: {
    display: 'none',
    position: 'absolute',
    right: '24px',
    top: '-60px',
    bottom: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  bannerImgEl: {
    height: 'calc(100% + 60px)',
    width: 'auto',
    maxWidth: '280px',
    objectFit: 'contain',
    objectPosition: 'bottom',
    opacity: 0.15,
  },
  /* ── Metric cards grid (Frosted Glass Info Cards) ── */
  midGrid: { display: 'grid', gap: '20px', gridTemplateColumns: '1fr' },
  col: { display: 'flex', flexDirection: 'column', gap: '20px' },
  statsGrid: { display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' },
  statCard: {
    padding: '20px 24px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 200ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
  },
  /* Colored icon circle — soft pastel glass circle */
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '22px',
    backdropFilter: 'blur(8px)',
  },
  statValue: {
    fontSize: '26px',
    fontWeight: '800' as unknown as number,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    color: tokens.colorNeutralForeground1,
  },
  statRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ringWrap: {
    position: 'relative',
    display: 'inline-flex',
    flexShrink: 0,
    width: '56px',
    height: '56px',
  },
  ringLabel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: tokens.fontWeightBold,
  },
  sectionHead: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  progressBlock: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  progressBlockAlt: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  track: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  fill: {
    height: '100%',
    borderRadius: '4px',
    transitionProperty: 'width',
    transitionDuration: tokens.durationNormal,
  },
  revenueRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px dashed rgba(226, 232, 240, 0.8)',
  },
  doctorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  doctorRow: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    transition: 'all 120ms ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
  },
  empty: {
    paddingTop: '32px',
    paddingBottom: '32px',
    textAlign: 'center',
  },
  /* ── Calendar ── */
  calHead: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  calNav: {
    display: 'flex',
    flexDirection: 'row',
    gap: '2px',
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    textAlign: 'center',
  },
  calDayHead: {
    fontSize: '0.65rem',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground3,
    padding: '4px 0',
    textTransform: 'uppercase',
  },
  calCell: {
    height: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNum: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
  },
  dots: {
    display: 'flex',
    flexDirection: 'row',
    gap: '3px',
    height: '4px',
    marginTop: '2px',
  },
  dot: { width: '3.5px', height: '3.5px', borderRadius: '50%' },
  /* ── Token queue ── */
  tokenHead: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  chipRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
  },
  nowCard: {
    marginBottom: '16px',
    padding: '20px',
    borderRadius: '14px',
    border: '1px solid rgba(13, 148, 136, 0.3)',
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    backdropFilter: 'blur(12px)',
  },
  nowInner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  nowBadge: {
    padding: '12px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
    boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
    color: '#ffffff',
    textAlign: 'center',
    minWidth: '100px',
  },
  tokenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});

function PercentRing({ percent, color }: { percent: number; color: string }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.ringWrap}>
      <ProgressBar value={percent / 100} thickness="large" style={{ width: 58, color }} />
      <span className={styles.ringLabel} style={{ color }}>{`${percent}%`}</span>
    </div>
  );
}

export function AdminDashboard(): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const showReports = can('reports');
  const showBilling = can('billing');
  const showTokens = can('tokens');

  const summary = useQuery({ queryKey: ['reports:summary'], queryFn: reportsService.summary, refetchInterval: 30_000, enabled: showReports });
  const patients = useQuery({ queryKey: ['patients', { page: 1, pageSize: 1, search: '' }], queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }), refetchInterval: 30_000 });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, refetchInterval: 30_000, enabled: showBilling });
  const appointments = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsService.list, refetchInterval: 30_000 });

  const totalRevenue = (invoices.data ?? []).reduce((s, inv) => s + inv.total, 0);
  const paidInvoices = (invoices.data ?? []).filter((i) => i.status === 'PAID').length;
  const totalInvoices = invoices.data?.length ?? 0;
  const completedAppts = (appointments.data ?? []).filter((a) => a.status === 'COMPLETED').length;
  const totalAppts = appointments.data?.length ?? 0;

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
    { label: 'Total Patients', value: patients.data?.total ?? 0, subtext: 'Registered patients', color: COLORS.blue, icon: '👥' },
    { label: 'Patients Today', value: todaysPatientsCount, subtext: 'Scheduled for today', color: COLORS.purple, icon: '📋' },
    showReports && { label: 'Monthly Revenue', value: money(summary.data?.monthlyRevenue ?? 0), subtext: 'Current month total', color: COLORS.teal, icon: '💰' },
    showBilling && { label: 'Total Invoices', value: totalInvoices, subtext: `${paidInvoices} paid invoices`, color: COLORS.orange, icon: '🧾' },
  ].filter(Boolean) as Array<{ label: string; value: string | number; subtext: string; color: string; icon: string }>;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <Text className={styles.greeting}>Welcome back, {user?.name || 'Admin'} 👋</Text>
          <div className={styles.welcome}>Dashboard</div>
        </div>
        <LiveClock />
      </div>

      <div className={styles.topGrid} style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <div className={styles.bannerWrap}>
          <div className={styles.banner}>
            <div className={styles.bannerText}>
              <Text className={styles.bannerEyebrow}>Clinic Update</Text>
              <div className={styles.bannerTitle}>Real-time Patient Queue & Live Performance Summary</div>
              <Text style={{ color: '#64748B', fontSize: '14px', lineHeight: 1.5 }}>Seamlessly monitor staff load, appointments, and OPD workflow.</Text>
            </div>
            <div className={styles.bannerImg} style={{ display: 'block' }}>
              <img className={styles.bannerImgEl} src={doctorImg} alt="Doctor" />
            </div>
          </div>
        </div>
        <MiniCalendarWidget appointments={appointments.data ?? []} />
      </div>

      <div className={styles.midGrid} style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <div className={styles.col}>
          <div className={styles.statsGrid}>
            {patients.isLoading || appointments.isLoading || (showReports && summary.isLoading) || (showBilling && invoices.isLoading) ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <StatCardsSkeleton count={statCards.length || 4} />
              </div>
            ) : (
              statCards.map((c) => (
                <div key={c.label} className={styles.statCard}>
                  <div className={styles.statIcon} style={{ backgroundColor: `${c.color}15`, color: c.color }}>
                    {c.icon}
                  </div>
                  <div>
                    <div className={styles.statValue}>{c.value}</div>
                    <Text weight="semibold" style={{ marginTop: 4, display: 'block', fontSize: '13px' }}>{c.label}</Text>
                    <Text size={200} className={styles.muted} style={{ display: 'block', marginTop: 2 }}>{c.subtext}</Text>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <Text weight="bold" style={{ fontSize: '18px' }}>Billing & Appointment Progress</Text>
                <Text size={200} className={styles.muted}>Revenue collection and appointment completion rate</Text>
              </div>
              <Badge appearance="filled" color="brand">Realtime</Badge>
            </div>
            <div className={styles.col}>
              {showBilling && (
                <div className={styles.progressBlock}>
                  <div className={styles.statRow} style={{ marginBottom: 12 }}>
                    <div>
                      <Text weight="semibold">Paid Invoices</Text>
                      <Text size={200} className={styles.muted} style={{ display: 'block' }}>Revenue collected from issued bills</Text>
                    </div>
                    <Text weight="bold" style={{ color: '#0D9488' }}>{paidPercentage}%</Text>
                  </div>
                  <div className={styles.track}>
                    <div className={styles.fill} style={{ width: `${paidPercentage}%`, background: 'linear-gradient(135deg, #0D9488, #10B981)' }} />
                  </div>
                  <div className={styles.statRow} style={{ marginTop: 10 }}>
                    <Text size={200} className={styles.muted}>{paidInvoices} of {totalInvoices} invoices</Text>
                    <Text size={200} className={styles.muted}>{totalInvoices ? `${Math.round((paidInvoices / totalInvoices) * 100)}% settled` : 'No invoices'}</Text>
                  </div>
                </div>
              )}
              <div className={styles.progressBlockAlt}>
                <div className={styles.statRow} style={{ marginBottom: 12 }}>
                  <div>
                    <Text weight="semibold">Completed Appointments</Text>
                    <Text size={200} className={styles.muted} style={{ display: 'block' }}>Appointments successfully closed</Text>
                  </div>
                  <Text weight="bold" style={{ color: COLORS.secondary }}>{apptPercentage}%</Text>
                </div>
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${apptPercentage}%`, backgroundColor: COLORS.secondary }} />
                </div>
                <div className={styles.statRow} style={{ marginTop: 10 }}>
                  <Text size={200} className={styles.muted}>{completedAppts} of {totalAppts} appointments</Text>
                  <Text size={200} className={styles.muted}>{totalAppts ? `${Math.round((completedAppts / totalAppts) * 100)}% complete` : 'No appointments'}</Text>
                </div>
              </div>
              <div className={styles.revenueRow}>
                <Text className={styles.muted} weight="semibold">Total Accumulated Revenue</Text>
                <Text weight="bold" style={{ color: '#0D9488', fontSize: '1.3rem' }}>{money(totalRevenue)}</Text>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.sectionHead}>
            <Text weight="bold" style={{ fontSize: '18px' }}>Doctor Performance</Text>
            <Button appearance="transparent" size="small" style={{ color: '#0D9488' }}>View all</Button>
          </div>
          {doctors.length === 0 ? (
            <div className={styles.empty}>
              <Text className={styles.muted}>No doctor appointments today.</Text>
            </div>
          ) : (
            <div className={styles.doctorList}>
              {doctors.map((doc, idx) => (
                <div key={doc.name} className={styles.doctorRow}>
                  <Badge appearance="tint" color={idx === 0 ? 'brand' : 'informative'}>#{idx + 1}</Badge>
                  <DoctorAvatar src={doc.avatar} name={doc.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="bold" truncate style={{ display: 'block' }}>{doc.name}</Text>
                    <Text size={200} className={styles.muted} truncate style={{ display: 'block' }}>Consultant Doctor</Text>
                  </div>
                  <Badge appearance="filled" color="brand">{doc.count} patients</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTokens && <TokenQueuePanel />}
    </div>
  );
}

function MiniCalendarWidget({ appointments }: { appointments: Appointment[] }): React.JSX.Element {
  const styles = useStyles();
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
      const color = a.status === 'COMPLETED' ? COLORS.teal : a.status === 'CANCELLED' ? COLORS.red : COLORS.blue;
      const list = apptDateMap.get(day)!;
      if (list.length < 3) list.push(color);
    }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className={styles.calHead}>
        <Text weight="bold">{monthName}</Text>
        <div className={styles.calNav}>
          <Button appearance="subtle" size="small" icon={<ChevronLeftIcon style={{ fontSize: 18 }} />} />
          <Button appearance="subtle" size="small" icon={<ChevronRightIcon style={{ fontSize: 18 }} />} />
        </div>
      </div>
      <div className={styles.calGrid}>
        {daysHeader.map((d) => (
          <Text key={d} className={styles.calDayHead}>{d}</Text>
        ))}
        {cells.map((day, idx) => {
          const dots = day ? apptDateMap.get(day) : undefined;
          const isToday = day === todayDate;
          return (
            <div key={idx} className={styles.calCell}>
              {day ? (
                <>
                  <div
                    className={styles.calNum}
                    style={{
                      backgroundColor: isToday ? '#0D9488' : 'transparent',
                      color: isToday ? '#ffffff' : tokens.colorNeutralForeground1,
                      fontWeight: isToday ? 800 : 500,
                    }}
                  >
                    {day}
                  </div>
                  <div className={styles.dots}>
                    {dots && dots.length > 0 ? dots.map((dotColor, dIdx) => (
                      <span key={dIdx} className={styles.dot} style={{ backgroundColor: isToday ? '#fff' : dotColor }} />
                    )) : <span style={{ height: 3.5 }} />}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const statusConfig: Record<TokenStatus, { label: string; color: 'warning' | 'success' | 'informative' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  DONE: { label: 'Completed', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'informative' },
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function TokenQueuePanel(): React.JSX.Element {
  const styles = useStyles();
  const { data: tokens = [], isLoading } = useQuery<Token[]>({
    queryKey: ['tokens', todayStr()],
    queryFn: () => window.clinic.tokens.list(todayStr()),
    refetchInterval: 10_000,
  });
  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const done = tokens.filter((t) => t.status === 'DONE').length;
  const current = tokens.find((t) => t.status === 'WAITING');

  return (
    <div className={styles.card}>
      <div className={styles.tokenHead}>
        <div>
          <Text weight="bold" style={{ fontSize: '18px' }}>Live Token Queue</Text>
          <Text size={200} className={styles.muted}>Today&apos;s OPD token tracking</Text>
        </div>
        <div className={styles.chipRow}>
          <Badge appearance="outline" color="warning">{waiting} Waiting</Badge>
          <Badge appearance="outline" color="success">{done} Completed</Badge>
        </div>
      </div>

      {current && (
        <div className={styles.nowCard}>
          <div className={styles.nowInner}>
            <div className={styles.nowBadge}>
              <Text size={200} weight="bold" style={{ opacity: 0.9, letterSpacing: '0.05em' }}>NOW SERVING</Text>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
                #{String(current.tokenNumber).padStart(3, '0')}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Title3>{current.patient.firstName} {current.patient.lastName}</Title3>
                <Badge appearance="filled" color="success">Active</Badge>
              </div>
              <Text className={styles.muted} style={{ marginTop: 4, display: 'block' }}>
                Assigned Doctor: <strong>Dr. {current.doctor.firstName} {current.doctor.lastName}</strong>
                {current.reason ? ` • ${current.reason}` : ''}
              </Text>
            </div>
            <Badge appearance="tint" color={statusConfig[current.status].color}>
              {statusConfig[current.status].label}
            </Badge>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListCardsSkeleton count={5} />
      ) : tokens.length === 0 ? (
        <div className={styles.empty}>
          <ConfirmationNumberOutlinedIcon style={{ fontSize: 44, marginBottom: 8 }} />
          <Text className={styles.muted}>No OPD tokens generated for today.</Text>
        </div>
      ) : (
        <div className={styles.tokenList}>
          {tokens.map((token) => {
            const cfg = statusConfig[token.status];
            const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
            return (
              <div
                key={token.id}
                className={styles.tokenRow}
                style={{
                  opacity: isDone ? 0.6 : 1,
                  borderColor: token.status === 'WAITING' ? 'rgba(247,99,12,0.4)' : undefined,
                  backgroundColor: token.status === 'WAITING' ? 'rgba(247,99,12,0.04)' : undefined,
                }}
              >
                <Avatar
                  name={`#${String(token.tokenNumber).padStart(3, '0')}`}
                  color="brand"
                  style={{ width: 48, height: 48, fontWeight: 900, fontSize: 13 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" truncate style={{ display: 'block' }}>
                    {token.patient.firstName} {token.patient.lastName}
                  </Text>
                  <Text size={200} className={styles.muted} truncate style={{ display: 'block' }}>
                    Dr. {token.doctor.firstName} {token.doctor.lastName}{token.reason ? ` • ${token.reason}` : ''}
                  </Text>
                </div>
                <Badge appearance="tint" color={cfg.color}>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
