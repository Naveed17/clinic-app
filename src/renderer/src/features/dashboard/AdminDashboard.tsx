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
  info: '#0078d4',
  secondary: '#8764b8',
  success: '#107c10',
  warning: '#f7630c',
  brand: tokens.colorBrandBackground,
  brandFg: tokens.colorNeutralForegroundOnBrand,
  error: tokens.colorPaletteRedForeground1,
};

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalL },
  headerRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightSemibold },
  welcome: { letterSpacing: '-0.02em', marginTop: tokens.spacingVerticalXXS, fontWeight: tokens.fontWeightBold },
  topGrid: { display: 'grid', gap: tokens.spacingVerticalL, gridTemplateColumns: '1fr' },
  bannerWrap: { position: 'relative', overflow: 'visible' },
  banner: {
    padding: tokens.spacingVerticalXXL,
    borderRadius: tokens.borderRadiusMedium,
    background: `linear-gradient(135deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 55%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
    minHeight: '350px',
    boxShadow: tokens.shadow16,
  },
  bannerText: { position: 'relative', zIndex: 1, maxWidth: '58%' },
  bannerEyebrow: { opacity: 0.88, fontWeight: tokens.fontWeightBold, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: tokens.fontSizeBase200 },
  bannerTitle: { letterSpacing: '-0.02em', marginTop: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalS, lineHeight: 1.3, fontWeight: tokens.fontWeightBold },
  bannerImg: { display: 'none', position: 'absolute', right: '24px', top: '-150px', bottom: 0, zIndex: 2, pointerEvents: 'none' },
  bannerImgEl: { height: 'calc(100% + 3px)', width: 'auto', maxWidth: '460px', objectFit: 'contain', objectPosition: 'bottom' },
  card: {
    padding: tokens.spacingVerticalL,
    borderRadius: '24px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  midGrid: { display: 'grid', gap: tokens.spacingVerticalL, gridTemplateColumns: '1fr' },
  col: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  statsGrid: { display: 'grid', gap: tokens.spacingVerticalL, gridTemplateColumns: '1fr 1fr' },
  statRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: '30px', fontWeight: tokens.fontWeightBold, letterSpacing: '-0.02em', lineHeight: 1.1 },
  ringWrap: { position: 'relative', display: 'inline-flex', flexShrink: 0, width: '58px', height: '58px' },
  ringLabel: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: tokens.fontWeightBold },
  sectionHead: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalL },
  progressBlock: {
    padding: tokens.spacingVerticalL,
    borderRadius: '24px',
    border: `1px solid ${tokens.colorBrandStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  progressBlockAlt: {
    padding: tokens.spacingVerticalL,
    borderRadius: '24px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  track: { width: '100%', height: '14px', borderRadius: '99px', overflow: 'hidden', backgroundColor: tokens.colorNeutralBackground3 },
  fill: { height: '100%', transitionProperty: 'width', transitionDuration: tokens.durationNormal },
  revenueRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px dashed ${tokens.colorNeutralStroke2}`,
  },
  doctorList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, flex: 1 },
  doctorRow: {
    padding: tokens.spacingVerticalS,
    borderRadius: '18px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  empty: { paddingTop: tokens.spacingVerticalXXL, paddingBottom: tokens.spacingVerticalXXL, textAlign: 'center' },
  calHead: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM },
  calNav: { display: 'flex', flexDirection: 'row', gap: tokens.spacingHorizontalXXS },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' },
  calDayHead: { fontSize: '0.62rem', fontWeight: tokens.fontWeightBold, color: tokens.colorNeutralForeground2, padding: '4px 0' },
  calCell: { height: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  calNum: {
    width: '25px',
    height: '25px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
  },
  dots: { display: 'flex', flexDirection: 'row', gap: '3px', height: '4px', marginTop: '2px' },
  dot: { width: '3.5px', height: '3.5px', borderRadius: '50%' },
  tokenHead: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalL },
  chipRow: { display: 'flex', flexDirection: 'row', gap: tokens.spacingHorizontalS },
  nowCard: {
    marginBottom: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
    borderRadius: '20px',
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  nowInner: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: tokens.spacingHorizontalL, flexWrap: 'wrap' },
  nowBadge: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: '16px',
    background: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    textAlign: 'center',
    minWidth: '105px',
  },
  tokenList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    borderRadius: '18px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
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
    { label: 'Total Patients', value: patients.data?.total ?? 0, subtext: 'Registered patients', percent: patients.data?.total ? 85 : 0, color: COLORS.info },
    { label: 'Today Appointments', value: todaysPatientsCount, subtext: 'Scheduled for today', percent: apptPercentage, color: COLORS.secondary },
    showReports && { label: 'Monthly Revenue', value: money(summary.data?.monthlyRevenue ?? 0), subtext: 'Current month total', percent: summary.data?.monthlyRevenue ? 92 : 0, color: COLORS.success },
    showBilling && { label: 'Total Invoices', value: totalInvoices, subtext: `${paidInvoices} paid invoices`, percent: paidPercentage, color: COLORS.warning },
  ].filter(Boolean) as Array<{ label: string; value: string | number; subtext: string; percent: number; color: string }>;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <Text className={styles.muted}>Hi {user?.name || 'Admin'},</Text>
          <Title2 className={styles.welcome}>Welcome Back!</Title2>
        </div>
        <LiveClock />
      </div>

      <div className={styles.topGrid} style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <div className={styles.bannerWrap}>
          <div className={styles.banner}>
            <div className={styles.bannerText}>
              <Text className={styles.bannerEyebrow}>CareFlow Clinic Operations</Text>
              <Title2 className={styles.bannerTitle}>Real-time Patient Queue & Live Performance Summary</Title2>
              <Text>Seamlessly monitor staff load, appointments, and OPD workflow.</Text>
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
                <div key={c.label} className={styles.card}>
                  <div className={styles.statRow}>
                    <div>
                      <div className={styles.statValue}>{c.value}</div>
                      <Text weight="bold" style={{ marginTop: 6, display: 'block' }}>{c.label}</Text>
                      <Text size={200} className={styles.muted} style={{ display: 'block', marginTop: 2 }}>{c.subtext}</Text>
                    </div>
                    <PercentRing percent={c.percent} color={c.color} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <Title3>Billing & Appointment Progress</Title3>
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
                    <Text weight="bold" style={{ color: tokens.colorBrandForeground1 }}>{paidPercentage}%</Text>
                  </div>
                  <div className={styles.track}>
                    <div className={styles.fill} style={{ width: `${paidPercentage}%`, backgroundColor: tokens.colorBrandBackground }} />
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
                <Text weight="bold" style={{ color: tokens.colorBrandForeground1, fontSize: '1.3rem' }}>{money(totalRevenue)}</Text>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.sectionHead}>
            <Title3>Doctor Performance</Title3>
            <Button appearance="transparent" size="small">View all</Button>
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
      const color = a.status === 'COMPLETED' ? tokens.colorBrandForeground1 : a.status === 'CANCELLED' ? COLORS.error : COLORS.info;
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
                      backgroundColor: isToday ? tokens.colorBrandBackground : 'transparent',
                      color: isToday ? tokens.colorNeutralForegroundOnBrand : tokens.colorNeutralForeground1,
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
          <Title3>Live Token Queue</Title3>
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
