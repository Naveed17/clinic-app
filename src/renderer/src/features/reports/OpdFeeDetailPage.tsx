import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { StatusBadge } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccess } from '@/app/access';
import type { Token } from '@/types/token';
import {
  AccountBalanceWalletOutlinedIcon,
  ArrowBackOutlinedIcon,
  CalendarMonthOutlinedIcon,
  ConfirmationNumberOutlinedIcon,
  LocalHospitalOutlinedIcon,
  NotesOutlinedIcon,
  PaymentsOutlinedIcon,
  PersonOutlinedIcon,
  UndoOutlinedIcon,
} from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<string, { label: string; color: StatusColor }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  IN_PROGRESS: { label: 'In progress', color: 'informative' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'subtle' },
};

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
    top: '-18px',
    right: '-18px',
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
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  statValue: {
    marginTop: tokens.spacingVerticalXXS,
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase600,
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  twoCol: {
    display: 'grid',
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
  },
  cardPad: {
    padding: tokens.spacingVerticalXL,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightBold,
    marginBottom: tokens.spacingVerticalL,
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },
  rowIcon: {
    marginTop: '2px',
    color: tokens.colorNeutralForeground2,
  },
  doctorRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  doctorName: {
    fontWeight: tokens.fontWeightBold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rxBox: {
    marginTop: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  noRx: {
    marginTop: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
});

function money(value: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function feeNet(token: Token): number {
  const fee = Number(token.consultationFee ?? 0);
  const discount = Number(token.feeDiscount ?? 0);
  const refunded = Number(token.feeRefunded ?? 0);
  return Math.max(0, fee - discount - refunded);
}

export function OpdFeeDetailPage(): React.JSX.Element {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canOpenPatient = user?.role ? canAccess(user.role, '/patients/:id') : false;

  function goBack(): void {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/opd-reports');
  }

  const query = useQuery({
    queryKey: ['token', id],
    queryFn: () => window.clinic.tokens.getById(id!) as Promise<Token | null>,
    enabled: Boolean(id),
  });

  const token = query.data ?? null;

  if (query.isLoading) {
    return (
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 88, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 220, borderRadius: 12 }} />
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Doctor fee record not found.</MessageBarBody>
        </MessageBar>
        <Button
          className={styles.backBtn}
          appearance="secondary"
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back to OPD Reports
        </Button>
      </div>
    );
  }

  const status = statusConfig[token.status] ?? { label: token.status, color: 'subtle' as const };
  const patientLabel = `${token.patient.firstName} ${token.patient.lastName}`.trim();
  const doctorLabel = `Dr. ${token.doctor.firstName} ${token.doctor.lastName}`.trim();
  const fee = Number(token.consultationFee ?? 0);
  const discount = Number(token.feeDiscount ?? 0);
  const refunded = Number(token.feeRefunded ?? 0);
  const net = feeNet(token);

  const colors = {
    primary: tokens.colorBrandForeground1,
    warning: tokens.colorPaletteDarkOrangeForeground1,
    error: tokens.colorPaletteRedForeground1,
    success: tokens.colorPaletteGreenForeground1,
  };

  const summaryCards = [
    {
      label: 'Consultation fee',
      value: money(fee),
      note: 'Charged',
      icon: <LocalHospitalOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.primary,
    },
    {
      label: 'Discount',
      value: money(discount),
      note: discount > 0 ? 'Applied' : 'None',
      icon: <PaymentsOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.warning,
    },
    {
      label: 'Refunded',
      value: money(refunded),
      note: refunded > 0 ? 'Returned' : 'None',
      icon: <UndoOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.error,
    },
    {
      label: 'Net fees',
      value: money(net),
      note: 'Collected',
      icon: <AccountBalanceWalletOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.success,
    },
  ];

  const detailRows = [
    {
      icon: <ConfirmationNumberOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Token',
      value: String(token.tokenNumber).padStart(3, '0'),
    },
    {
      icon: <CalendarMonthOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Date',
      value: new Date(`${token.date}T12:00:00`).toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    },
    {
      icon: <PersonOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Patient',
      value: patientLabel,
      hint: token.patient.mrNumber ? `MR ${token.patient.mrNumber}` : undefined,
    },
    {
      icon: <LocalHospitalOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Doctor',
      value: doctorLabel,
    },
    {
      icon: <NotesOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Reason',
      value: token.reason?.trim() || '—',
    },
    {
      icon: <NotesOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />,
      label: 'Notes',
      value: token.notes?.trim() || '—',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Tooltip content="Back" relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
              onClick={() => goBack()}
              className={styles.backIconBtn}
            />
          </Tooltip>
          <div>
            <Text className={styles.eyebrow}>Doctor fee details</Text>
            <div className={styles.titleRow}>
              <Title3 className={styles.title}>
                Token #{String(token.tokenNumber).padStart(3, '0')}
              </Title3>
              <StatusBadge color={status.color}>{status.label}</StatusBadge>
            </div>
            <Text className={styles.subtitle}>
              {patientLabel} · {doctorLabel}
            </Text>
          </div>
        </div>

        <div className={styles.actions}>
          {canOpenPatient && (
            <Button
              appearance="secondary"
              onClick={() =>
                navigate(`/patients/${token.patientId}`, { state: { from: location.pathname } })
              }
            >
              Open patient
            </Button>
          )}
          <Button appearance="primary" onClick={() => goBack()}>
            Back to reports
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
                <Text className={styles.caption}>{c.note}</Text>
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

      <div className={styles.twoCol}>
        <div className={`${styles.softCard} ${styles.cardPad}`}>
          <Text className={styles.sectionTitle} block>
            Visit details
          </Text>
          <div className={styles.rows}>
            {detailRows.map((row) => (
              <div key={row.label} className={styles.row}>
                <div className={styles.rowIcon}>{row.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <Text className={styles.caption}>{row.label}</Text>
                  <Text weight="semibold" size={300} block>
                    {row.value}
                  </Text>
                  {row.hint ? (
                    <Text className={styles.caption}>{row.hint}</Text>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.softCard} ${styles.cardPad}`}>
          <Text className={styles.sectionTitle} block>
            Doctor
          </Text>
          <div className={styles.doctorRow}>
            <DoctorAvatar src={token.doctor.avatar} name={doctorLabel} size={52} />
            <div style={{ minWidth: 0 }}>
              <Text className={styles.doctorName} block>
                {doctorLabel}
              </Text>
              <Text className={styles.muted}>Consultation {money(fee)}</Text>
            </div>
          </div>
          {token.prescription ? (
            <div className={styles.rxBox}>
              <Text className={styles.caption}>Prescription</Text>
              <Text weight="semibold" size={300} block style={{ marginTop: 2 }}>
                {token.prescription.diagnosis || 'On file'}
              </Text>
              <Text className={styles.caption}>
                {token.prescription.medicines.length} medicine
                {token.prescription.medicines.length === 1 ? '' : 's'}
                {token.prescription.pharmacyStatus
                  ? ` · ${token.prescription.pharmacyStatus.toLowerCase()}`
                  : ''}
              </Text>
            </div>
          ) : (
            <Text className={styles.noRx}>No prescription linked to this token.</Text>
          )}
        </div>
      </div>
    </div>
  );
}
