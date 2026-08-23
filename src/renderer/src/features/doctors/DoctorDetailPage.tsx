import {
  Avatar,
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import type { Doctor } from '@/types/doctor';
import { DoctorEditDialog } from './DoctorEditDialog';
import {
  ArrowBackOutlinedIcon,
  CalendarMonthOutlinedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ConfirmationNumberOutlinedIcon,
  EditOutlinedIcon,
  EmailOutlinedIcon,
  EventAvailableOutlinedIcon,
  LocalPhoneOutlinedIcon,
  MedicalServicesOutlinedIcon,
  PaymentsOutlinedIcon,
  SchoolOutlinedIcon,
  WorkOutlineOutlinedIcon,
} from '@/icons/fluent';

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

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalS,
  },
  notFound: {
    padding: tokens.spacingVerticalXXL,
  },
  backBtn: {
    marginTop: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  backIconBtn: {
    marginTop: tokens.spacingVerticalXXS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  eyebrow: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  titleRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXXS,
  },
  title: {
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: '9px',
    paddingRight: '9px',
    paddingTop: '3px',
    paddingBottom: '3px',
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightMedium,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  statsGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    position: 'relative',
    overflow: 'hidden',
  },
  statBlob: {
    position: 'absolute',
    bottom: '-14px',
    right: '-14px',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
  },
  statInner: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  caption: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  statValue: {
    marginTop: tokens.spacingVerticalM,
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  mainGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    alignItems: 'start',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    minWidth: 0,
  },
  cardPad: {
    padding: tokens.spacingVerticalXL,
  },
  sectionHead: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalL,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightBold,
    letterSpacing: '-0.01em',
  },
  dayGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  dayRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  monthNav: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    paddingLeft: tokens.spacingHorizontalXXS,
    paddingRight: tokens.spacingHorizontalXXS,
    paddingTop: '2px',
    paddingBottom: '2px',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  monthLabel: {
    minWidth: '110px',
    textAlign: 'center',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  calHead: {
    textAlign: 'center',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForegroundDisabled,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  calCell: {
    minHeight: '52px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  emptyCal: {
    display: 'block',
    textAlign: 'center',
    marginTop: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
  },
  legend: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalL,
    justifyContent: 'center',
    marginTop: tokens.spacingVerticalL,
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  legendSwatch: {
    width: '10px',
    height: '10px',
    borderRadius: '4px',
  },
  profileHead: {
    paddingTop: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    background: `linear-gradient(145deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 100%)`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  profileHeadRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  profileName: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  infoList: {
    padding: tokens.spacingVerticalS,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  infoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  bioWrap: {
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingBottom: tokens.spacingVerticalXL,
  },
  bioBox: {
    marginTop: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    lineHeight: 1.55,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightMedium,
    fontSize: tokens.fontSizeBase300,
  },
});

export function DoctorDetailPage(): React.JSX.Element {
  const styles = useStyles();
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
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 88, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 280, borderRadius: 12 }} />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Doctor not found.</MessageBarBody>
        </MessageBar>
        <Button
          className={styles.backBtn}
          appearance="secondary"
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/doctors')}
        >
          Back to Doctors
        </Button>
      </div>
    );
  }

  const green = tokens.colorBrandForeground1;
  const success = tokens.colorPaletteGreenForeground1;
  const warning = tokens.colorPaletteDarkOrangeForeground1;
  const info = tokens.colorPaletteBlueForeground2;

  const summaryCards = [
    {
      label: 'Appointments',
      value: doctor.totalAppointments,
      note: 'All time',
      icon: <CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />,
      color: green,
    },
    {
      label: "Today's Tokens",
      value: doctor.todayTokens,
      note: new Date().toLocaleDateString(),
      icon: <ConfirmationNumberOutlinedIcon style={{ fontSize: 18 }} />,
      color: warning,
    },
    {
      label: 'Active Days',
      value: activeDays,
      note: 'Per week',
      icon: <EventAvailableOutlinedIcon style={{ fontSize: 18 }} />,
      color: success,
    },
    {
      label: 'Present Days',
      value: presentDays,
      note: `${MONTHS[month - 1].slice(0, 3)} ${year}`,
      icon: <WorkOutlineOutlinedIcon style={{ fontSize: 18 }} />,
      color: info,
    },
  ];

  const infoRows = [
    { icon: <EmailOutlinedIcon style={{ fontSize: 18 }} />, label: 'Email', value: doctor.email },
    {
      icon: <MedicalServicesOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Specialization',
      value: doctor.doctorProfile?.specialization ?? '—',
    },
    {
      icon: <SchoolOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Qualification',
      value: doctor.doctorProfile?.qualification ?? '—',
    },
    {
      icon: <WorkOutlineOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Experience',
      value:
        doctor.doctorProfile?.experienceYears != null
          ? `${doctor.doctorProfile.experienceYears} year${doctor.doctorProfile.experienceYears !== 1 ? 's' : ''}`
          : '—',
    },
    {
      icon: <PaymentsOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Consultation fee',
      value: `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(doctor.doctorProfile?.consultationFee ?? 0))}`,
    },
    {
      icon: <LocalPhoneOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Phone',
      value: doctor.doctorProfile?.phone ?? '—',
    },
  ];

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tooltip content="Back to doctors" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => navigate('/doctors')}
                className={styles.backIconBtn}
              />
            </Tooltip>
            <div>
              <Text className={styles.eyebrow}>Doctor profile</Text>
              <div className={styles.titleRow}>
                <Title3 className={styles.title}>
                  Dr. {doctor.firstName} {doctor.lastName}
                </Title3>
                <div
                  className={styles.statusPill}
                  style={{
                    borderColor: doctor.isActive ? `${success}40` : tokens.colorNeutralStroke1,
                    backgroundColor: doctor.isActive ? `${success}1a` : tokens.colorNeutralBackground3,
                  }}
                >
                  <div
                    className={styles.statusDot}
                    style={{ backgroundColor: doctor.isActive ? success : tokens.colorNeutralForegroundDisabled }}
                  />
                  <Text
                    size={200}
                    weight="semibold"
                    style={{ color: doctor.isActive ? success : tokens.colorNeutralForeground2 }}
                  >
                    {doctor.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </div>
              </div>
              <Text className={styles.subtitle}>
                {doctor.doctorProfile?.specialization ?? 'General practice'}
                {' · '}
                Joined {new Date(doctor.createdAt).toLocaleDateString()}
              </Text>
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              appearance="secondary"
              icon={<CalendarMonthOutlinedIcon />}
              onClick={() => navigate(`/schedule?doctorId=${doctor.id}`)}
            >
              Edit schedule
            </Button>
            <Button
              appearance="primary"
              icon={<EditOutlinedIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit profile
            </Button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          {summaryCards.map((c) => (
            <div key={c.label} className={`${styles.softCard} ${styles.statCard}`}>
              <div className={styles.statBlob} style={{ backgroundColor: `${c.color}1a` }} />
              <div className={styles.statInner}>
                <div>
                  <Text className={styles.caption}>{c.label}</Text>
                  <Text className={styles.statValue} block>
                    {c.value}
                  </Text>
                  <Text className={styles.caption} style={{ marginTop: 6, display: 'block' }}>
                    {c.note}
                  </Text>
                </div>
                <div
                  className={styles.iconBox}
                  style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                >
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mainGrid}>
          <div className={styles.col}>
            <div className={`${styles.softCard} ${styles.cardPad}`}>
              <div className={styles.sectionHead}>
                <div>
                  <Text className={styles.sectionTitle} block>
                    Weekly Schedule
                  </Text>
                  <Text className={styles.caption}>
                    Availability used when booking appointments & tokens
                  </Text>
                </div>
                <Button
                  appearance="secondary"
                  size="small"
                  icon={<EditOutlinedIcon style={{ fontSize: 16 }} />}
                  onClick={() => navigate(`/schedule?doctorId=${doctor.id}`)}
                >
                  Edit
                </Button>
              </div>

              <div className={styles.dayGrid}>
                {DAY_FULL.map((day, i) => {
                  const slot = doctor.schedules.find((s) => s.dayOfWeek === i);
                  const active = slot?.isActive ?? false;
                  return (
                    <div
                      key={day}
                      className={styles.dayRow}
                      style={{
                        borderColor: active ? `${green}33` : tokens.colorNeutralStroke2,
                        backgroundColor: active ? `${green}0d` : tokens.colorNeutralBackground3,
                        opacity: active ? 1 : 0.72,
                      }}
                    >
                      <Avatar
                        name={DAYS[i]}
                        initials={DAYS[i]}
                        color="neutral"
                        size={36}
                        style={{
                          borderRadius: tokens.borderRadiusMedium,
                          backgroundColor: active ? `${green}24` : tokens.colorNeutralBackground4,
                          color: active ? green : tokens.colorNeutralForeground2,
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text weight="semibold" size={300} block style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {day}
                        </Text>
                        <Text className={styles.caption}>
                          {active && slot ? `${slot.startTime} – ${slot.endTime}` : 'Off'}
                        </Text>
                      </div>
                      <Badge appearance="tint" color={active ? 'success' : 'subtle'} size="small">
                        {active ? 'On' : 'Off'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`${styles.softCard} ${styles.cardPad}`}>
              <div className={styles.sectionHead}>
                <div>
                  <Text className={styles.sectionTitle} block>
                    Monthly Attendance
                  </Text>
                  <Text className={styles.caption}>
                    {presentDays} day{presentDays !== 1 ? 's' : ''} present out of {lastDay} in{' '}
                    {MONTHS[month - 1]} {year}
                  </Text>
                </div>
                <div className={styles.monthNav}>
                  <Button appearance="subtle" size="small" icon={<ChevronLeftIcon style={{ fontSize: 18 }} />} onClick={prevMonth} />
                  <Text className={styles.monthLabel}>
                    {MONTHS[month - 1].slice(0, 3)} {year}
                  </Text>
                  <Button appearance="subtle" size="small" icon={<ChevronRightIcon style={{ fontSize: 18 }} />} onClick={nextMonth} />
                </div>
              </div>

              {attendanceQuery.isLoading ? (
                <div className={styles.calGrid}>
                  {Array.from({ length: 35 }, (_, i) => (
                    <Skeleton key={i} appearance="opaque" style={{ height: 52, borderRadius: 8 }} />
                  ))}
                </div>
              ) : (
                <div>
                  <div className={styles.calGrid} style={{ marginBottom: 6 }}>
                    {DAYS.map((d) => (
                      <Text key={d} className={styles.calHead}>
                        {d}
                      </Text>
                    ))}
                  </div>
                  <div className={styles.calGrid}>
                    {(() => {
                      const firstDow = new Date(year, month - 1, 1).getDay();
                      const byDate = new Map(attendance.map((r) => [r.date, r]));
                      const cells: React.ReactNode[] = [];
                      for (let i = 0; i < firstDow; i++) {
                        cells.push(<div key={`pad-${i}`} style={{ minHeight: 52 }} />);
                      }
                      for (let day = 1; day <= lastDay; day++) {
                        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const rec = byDate.get(dateKey);
                        const isToday =
                          now.getFullYear() === year &&
                          now.getMonth() + 1 === month &&
                          now.getDate() === day;
                        const hours = rec ? diffHours(rec.checkInAt, rec.checkOutAt) : null;
                        const tip = rec
                          ? [
                              `In ${formatTime(rec.checkInAt)}`,
                              rec.checkOutAt ? `Out ${formatTime(rec.checkOutAt)}` : 'Still in',
                              hours ? `${hours} hrs` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : 'No attendance';
                        const tone = rec ? (rec.checkOutAt ? success : warning) : null;
                        cells.push(
                          <Tooltip key={dateKey} content={tip} relationship="label">
                            <div
                              className={styles.calCell}
                              style={{
                                borderColor: tone ? `${tone}73` : tokens.colorNeutralStroke2,
                                backgroundColor: tone ? `${tone}1f` : tokens.colorNeutralBackground3,
                                outline: isToday ? `2px solid ${green}` : 'none',
                                outlineOffset: -1,
                              }}
                            >
                              <Text
                                size={300}
                                weight={isToday || rec ? 'bold' : 'semibold'}
                                style={{ color: tone ?? tokens.colorNeutralForeground2 }}
                              >
                                {day}
                              </Text>
                              {rec && (
                                <Text
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: tone ?? undefined,
                                    opacity: 0.9,
                                    lineHeight: 1,
                                  }}
                                >
                                  {formatTime(rec.checkInAt)}
                                </Text>
                              )}
                            </div>
                          </Tooltip>,
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  {attendance.length === 0 && (
                    <Text className={styles.emptyCal} size={200}>
                      No check-ins this month yet. Present days will highlight on the calendar.
                    </Text>
                  )}
                  <div className={styles.legend}>
                    <div className={styles.legendItem}>
                      <div className={styles.legendSwatch} style={{ backgroundColor: `${success}b3` }} />
                      <Text className={styles.caption}>Present</Text>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendSwatch} style={{ backgroundColor: `${warning}b3` }} />
                      <Text className={styles.caption}>Still in</Text>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendSwatch} style={{ backgroundColor: tokens.colorNeutralStroke1 }} />
                      <Text className={styles.caption}>Absent</Text>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.col}>
            <div className={`${styles.softCard}`} style={{ overflow: 'hidden' }}>
              <div className={styles.profileHead}>
                <div className={styles.profileHeadRow}>
                  <DoctorAvatar
                    src={doctor.doctorProfile?.avatar}
                    name={`Dr. ${doctor.firstName} ${doctor.lastName}`}
                    size={64}
                    style={{ boxShadow: `0 8px 20px ${green}59` }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Text className={styles.profileName} block>
                      Dr. {doctor.firstName} {doctor.lastName}
                    </Text>
                    <Text className={styles.caption} block style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doctor.doctorProfile?.specialization ?? 'Doctor'}
                    </Text>
                  </div>
                </div>
              </div>

              <div className={styles.infoList}>
                {infoRows.map((row) => (
                  <div key={row.label} className={styles.infoRow}>
                    <div className={styles.infoIcon}>{row.icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text className={styles.caption}>{row.label}</Text>
                      <Text weight="semibold" size={300} style={{ wordBreak: 'break-word' }}>
                        {row.value}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>

              {doctor.doctorProfile?.bio ? (
                <div className={styles.bioWrap}>
                  <Text className={styles.caption} weight="bold" block>
                    Bio
                  </Text>
                  <div className={styles.bioBox}>{doctor.doctorProfile.bio}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <DoctorEditDialog open={editOpen} doctorId={id!} onClose={() => setEditOpen(false)} />
    </>
  );
}
