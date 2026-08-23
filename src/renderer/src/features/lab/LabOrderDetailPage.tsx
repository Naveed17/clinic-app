import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Spinner,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { StatCardsSkeleton } from '@/components/LoadingUI';
import { StatusBadge } from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { LabReportBuilderDialog } from '@/features/lab/LabReportBuilderDialog';
import { LabReportPrint } from '@/features/lab/LabReportPrint';
import { ResultBody } from '@/features/lab/LabOrderResultView';
import { labReportNumber } from '@/features/lab/labReportNumber';
import type { LabOrderStatus } from '@/types/lab';
import {
  AccessTimeOutlinedIcon,
  ArrowBackOutlinedIcon,
  BadgeOutlinedIcon,
  BiotechOutlinedIcon,
  ConfirmationNumberOutlinedIcon,
  LocalPhoneOutlinedIcon,
  NotesOutlinedIcon,
  PersonOutlinedIcon,
  PrintOutlinedIcon,
  ScienceOutlinedIcon,
} from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusColor: Record<LabOrderStatus, StatusColor> = {
  PENDING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'danger',
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
    wordBreak: 'break-word',
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  mainGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'start',
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
  rowIconBox: {
    width: '34px',
    height: '34px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  personValue: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
  },
});

export function LabOrderDetailPage(): React.JSX.Element {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isLabTech = user?.role === 'lab_technician';
  const isDoctor = user?.role === 'doctor';
  const canBuild = isLabTech || isDoctor;

  const [builderOpen, setBuilderOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const query = useQuery({
    queryKey: ['lab-order', id],
    queryFn: () => window.clinic.lab.get(id!),
    enabled: Boolean(id),
  });

  const order = query.data ?? null;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['lab-order', id] });
    await qc.invalidateQueries({ queryKey: ['lab-orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => window.clinic.lab.updateStatus(id!, status),
    onSuccess: () => void invalidate(),
    meta: { toast: 'Lab status updated', errorToast: 'Could not update status.' },
  });

  if (query.isLoading) {
    return (
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 88, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 240, borderRadius: 12 }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Lab order not found.</MessageBarBody>
        </MessageBar>
        <Button
          className={styles.backBtn}
          appearance="secondary"
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/lab')}
        >
          Back to Lab Orders
        </Button>
      </div>
    );
  }

  const reportNo = labReportNumber(order.id);
  const statusLabel = order.status.replace('_', ' ');
  const canPrint = order.status === 'COMPLETED' && Boolean(order.result?.trim());
  const tokenLabel = order.tokenNumber != null ? `#${String(order.tokenNumber).padStart(3, '0')}` : '—';

  const colors = {
    primary: tokens.colorBrandForeground1,
    info: tokens.colorPaletteBlueForeground2,
    warning: tokens.colorPaletteDarkOrangeForeground1,
    success: tokens.colorPaletteGreenForeground1,
  };

  const summaryCards = [
    {
      label: 'Status',
      value: statusLabel,
      note: 'Current',
      icon: <ScienceOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.primary,
      fontSize: 22,
    },
    {
      label: 'Report no.',
      value: reportNo,
      note: 'Accession',
      icon: <BiotechOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.info,
      fontSize: 16,
      mono: true,
    },
    {
      label: 'Ordered',
      value: new Date(order.orderedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      note: new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: <AccessTimeOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.warning,
      fontSize: 22,
    },
    {
      label: 'Token',
      value: tokenLabel,
      note: 'Visit token',
      icon: <ConfirmationNumberOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.success,
      fontSize: 22,
    },
  ];

  const infoRows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <PersonOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Patient',
      value: order.patientName,
    },
    {
      icon: <BadgeOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'MR number',
      value: order.patientMrNumber || '—',
    },
    {
      icon: <LocalPhoneOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Phone',
      value: order.patientPhone?.trim() || '—',
    },
    {
      icon: <PersonOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Ordered by',
      value: (
        <div className={styles.personValue}>
          <DoctorAvatar name={order.orderedByName} size={28} />
          <Text weight="semibold">{order.orderedByName}</Text>
        </div>
      ),
    },
    {
      icon: <NotesOutlinedIcon style={{ fontSize: 18 }} />,
      label: 'Notes',
      value: order.notes?.trim() || '—',
    },
  ];

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tooltip content="Back to lab orders" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => navigate('/lab')}
                className={styles.backIconBtn}
              />
            </Tooltip>
            <div>
              <Text className={styles.eyebrow}>Lab test details</Text>
              <div className={styles.titleRow}>
                <Title3 className={styles.title}>{order.test}</Title3>
                <StatusBadge color={statusColor[order.status]}>{statusLabel}</StatusBadge>
              </div>
              <Text className={styles.subtitle}>
                {order.patientName} · {reportNo}
              </Text>
            </div>
          </div>

          <div className={styles.actions}>
            <Button appearance="secondary" onClick={() => navigate(`/patients/${order.patientId}`)}>
              Open patient
            </Button>
            {isLabTech && order.status === 'PENDING' && (
              <Button
                appearance="primary"
                icon={statusMutation.isPending ? <Spinner size="tiny" /> : undefined}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('IN_PROGRESS')}
              >
                Start
              </Button>
            )}
            {canBuild && (order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') && (
              <Button
                appearance={order.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                icon={<ScienceOutlinedIcon />}
                onClick={() => setBuilderOpen(true)}
              >
                {order.status === 'IN_PROGRESS' ? 'Build report' : 'Open report'}
              </Button>
            )}
            {canPrint && (
              <Button
                appearance="secondary"
                icon={<PrintOutlinedIcon />}
                onClick={() => setPrintOpen(true)}
              >
                Print
              </Button>
            )}
          </div>
        </div>

        <div className={styles.statsGrid}>
          {summaryCards.map((c) => (
            <div key={c.label} className={`${styles.softCard} ${styles.statCard}`}>
              <div className={styles.statBlob} style={{ backgroundColor: `${c.color}1a` }} />
              <div className={styles.statInner}>
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <Text className={styles.caption}>{c.label}</Text>
                  <Text
                    className={styles.statValue}
                    block
                    style={{
                      fontSize: c.fontSize,
                      fontFamily: c.mono ? 'ui-monospace, Consolas, monospace' : undefined,
                    }}
                  >
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

        <div className={styles.mainGrid}>
          <div className={`${styles.softCard} ${styles.cardPad}`}>
            <Text className={styles.sectionTitle} block>
              Order details
            </Text>
            <div className={styles.rows}>
              {infoRows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <div className={styles.rowIconBox}>{row.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <Text className={styles.caption}>{row.label}</Text>
                    {typeof row.value === 'string' ? (
                      <Text weight="semibold" style={{ wordBreak: 'break-word' }}>
                        {row.value}
                      </Text>
                    ) : (
                      row.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.softCard} ${styles.cardPad}`}>
            <Text className={styles.sectionTitle} block style={{ marginBottom: 12 }}>
              Result
            </Text>
            {order.result?.trim() || order.notes?.trim() ? (
              <ResultBody result={order.result} notes={order.notes} />
            ) : (
              <Text className={styles.muted}>No result recorded yet.</Text>
            )}
          </div>
        </div>
      </div>

      {builderOpen && (
        <LabReportBuilderDialog
          order={order}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => {
            void invalidate();
            setBuilderOpen(false);
          }}
        />
      )}

      {printOpen && <LabReportPrint order={order} onClose={() => setPrintOpen(false)} />}
    </>
  );
}
