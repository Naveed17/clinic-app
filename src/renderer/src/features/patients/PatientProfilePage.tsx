import {
  Avatar,
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Tab,
  TabList,
  Text,
  Title1,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import type { Prescription } from '@/types/token';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { StatusBadge } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientDialog } from './PatientDialog';
import { PatientDocumentsPanel } from './PatientDocumentsPanel';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import type { LabOrder } from '@/types/lab';
import { ArrowBackOutlinedIcon, BadgeOutlinedIcon, BiotechOutlinedIcon, CakeOutlinedIcon, CalendarMonthOutlinedIcon, ContactPhoneOutlinedIcon, EditOutlinedIcon, EmailOutlinedIcon, HealthAndSafetyOutlinedIcon, HomeOutlinedIcon, InsertDriveFileOutlinedIcon, MedicalServicesOutlinedIcon, PhoneOutlinedIcon, PrintOutlinedIcon, ReceiptOutlinedIcon, WarningAmberOutlinedIcon } from '@/icons/fluent';

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;

type StatusColor = NonNullable<BadgeProps['color']>;

const apptStatusColor: Record<string, StatusColor> = {
  SCHEDULED: 'brand', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'subtle', NO_SHOW: 'danger',
};

const STATUS_BORDER: Record<string, string> = {
  SCHEDULED: tokens.colorBrandForeground1,
  CHECKED_IN: tokens.colorPaletteDarkOrangeForeground1,
  COMPLETED: tokens.colorPaletteGreenForeground1,
  CANCELLED: tokens.colorNeutralStroke2,
  NO_SHOW: tokens.colorPaletteRedForeground1,
};

const INVOICE_BORDER: Record<string, string> = {
  PAID: tokens.colorPaletteGreenForeground1,
  PARTIALLY_PAID: tokens.colorPaletteDarkOrangeForeground1,
  DRAFT: tokens.colorPaletteBlueForeground2,
  VOID: tokens.colorPaletteRedForeground1,
  REFUNDED: tokens.colorPaletteRedForeground1,
};

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    paddingBottom: tokens.spacingVerticalL,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  notFound: {
    padding: tokens.spacingVerticalXXL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalL,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  backBtn: {
    marginTop: '4px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  eyebrow: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  title: {
    letterSpacing: '-0.02em',
    marginTop: '2px',
    fontWeight: 900,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: '4px',
    display: 'block',
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
  },
  editBtn: {
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightBold,
    paddingLeft: '18px',
    paddingRight: '18px',
  },
  statsGrid: {
    display: 'grid',
    gap: '14px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: '0 4px 18px rgba(0,0,0,0.04)',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  statCard: {
    padding: '18px',
    border: 'none',
  },
  statRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 800,
    lineHeight: 1,
  },
  statLabel: {
    marginTop: '6px',
    display: 'block',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground2,
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
  },
  layout: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    alignItems: 'start',
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
    },
  },
  mainCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minWidth: 0,
  },
  sideCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    minWidth: 0,
  },
  panel: {
    overflow: 'hidden',
  },
  tabBar: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    minHeight: '48px',
  },
  tabBody: {
    minHeight: '200px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    maxHeight: '480px',
    overflowY: 'auto',
  },
  listItem: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    cursor: 'pointer',
    ':hover': {
      filter: 'brightness(0.97)',
    },
  },
  listItemInvoice: {
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
  },
  empty: {
    paddingTop: '48px',
    paddingBottom: '48px',
    textAlign: 'center',
  },
  emptyIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: tokens.spacingVerticalM,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  hero: {
    padding: '22px',
    borderRadius: '24px',
    background: `linear-gradient(145deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 50%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: `0 12px 28px ${tokens.colorBrandBackground2}`,
    border: 'none',
  },
  heroTop: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalL,
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  heroAvatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '22px',
    fontWeight: 900,
    border: '2px solid rgba(255,255,255,0.35)',
  },
  heroBadges: {
    display: 'flex',
    flexDirection: 'row',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  glassBadge: {
    height: '22px',
    fontWeight: tokens.fontWeightBold,
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#fff',
  },
  heroContact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  heroContactRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  sideCard: {
    padding: '18px',
  },
  sideTitle: {
    fontWeight: 800,
    fontSize: '15px',
    marginBottom: '14px',
    display: 'block',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '10px',
    alignItems: 'flex-start',
  },
  infoIcon: {
    color: tokens.colorNeutralForeground2,
    marginTop: '1px',
    display: 'flex',
  },
  infoLabel: {
    lineHeight: 1,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontSize: '10px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    display: 'block',
  },
  alertBox: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
  },
  alertHead: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    marginBottom: '4px',
  },
  mrCard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorBrandBackground2,
  },
  mrIcon: {
    width: '44px',
    height: '44px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  rxCard: {
    padding: '10px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    ':hover': {
      filter: 'brightness(0.97)',
    },
  },
  thumbBox: {
    width: '56px',
    height: '72px',
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  overviewRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <Text weight="bold" style={{ display: 'block', marginBottom: 4 }}>{title}</Text>
      <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{subtitle}</Text>
    </div>
  );
}

function PrescriptionsTabInline({ patientId, patient }: {
  patientId: string;
  patient: { firstName: string; lastName: string; mrNumber?: string | null; phone?: string | null; dateOfBirth?: string | Date | null };
}): React.JSX.Element {
  const styles = useStyles();
  type PrintItem = { prescription: Prescription; doctor: { firstName: string; lastName: string } };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: async () => {
      const today = new Date();
      const results: PrintItem[] = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayTokens = await window.clinic.tokens.list(d.toISOString().slice(0, 10));
        for (const t of dayTokens) {
          if (t.patientId === patientId && t.prescription) {
            results.push({ prescription: t.prescription, doctor: t.doctor ?? { firstName: '', lastName: '' } });
          }
        }
      }
      return results;
    },
  });

  if (isLoading) return <div style={{ padding: 8 }}><ListCardsSkeleton count={4} /></div>;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MedicalServicesOutlinedIcon style={{ fontSize: 30 }} />}
        title="No prescriptions"
        subtitle="Prescriptions written for this patient will appear here."
      />
    );
  }

  return (
    <>
      <div className={styles.list} style={{ maxHeight: 520, paddingRight: 4 }}>
        {items.map((item) => {
          const pr = item.prescription;
          const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
          const title = pr.thumbName?.trim() || pr.diagnosis || 'Prescription Entry';
          const thumbSrc = pr.thumbnail ? `data:image/png;base64,${pr.thumbnail}` : null;
          return (
            <div
              key={pr.id}
              className={styles.rxCard}
              onClick={() => setPrintItem({ prescription: pr, doctor: item.doctor ?? { firstName: '', lastName: '' } })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setPrintItem({ prescription: pr, doctor: item.doctor ?? { firstName: '', lastName: '' } });
                }
              }}
            >
              <div className={styles.thumbBox}>
                {thumbSrc ? (
                  <img className={styles.thumbImg} src={thumbSrc} alt="" />
                ) : (
                  <MedicalServicesOutlinedIcon style={{ fontSize: 22, color: 'currentColor' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text weight="bold" size={300} className={styles.truncate}>{title}</Text>
                <Text size={200} className={styles.truncate} style={{ display: 'block', marginTop: 2, color: tokens.colorNeutralForeground2 }}>
                  {new Date(pr.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  {doctorLabel ? ` · Dr. ${doctorLabel.replace(/^dr\.?\s*/i, '')}` : ''}
                </Text>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip content="Print Prescription" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<PrintOutlinedIcon style={{ fontSize: 18 }} />}
                    aria-label="Print Prescription"
                    onClick={() => setPrintItem({ prescription: pr, doctor: item.doctor ?? { firstName: '', lastName: '' } })}
                  />
                </Tooltip>
                <Badge appearance="tint" color="brand" size="small" style={{ fontWeight: 700 }}>Rx</Badge>
              </div>
            </div>
          );
        })}
      </div>
      {printItem && (
        <PrescriptionPrintPreview
          prescription={printItem.prescription}
          patient={patient}
          doctor={printItem.doctor}
          onClose={() => setPrintItem(null)}
        />
      )}
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoIcon}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <Text className={styles.infoLabel}>{label}</Text>
        <Text size={300} weight="semibold" style={{ wordBreak: 'break-word' }}>{value}</Text>
      </div>
    </div>
  );
}

export function PatientProfilePage(): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const isAdmin = user?.role === 'admin';
  const showLab = can('labDashboard');
  const showBilling = can('billing');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, id }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1000, search: '' }),
  });
  const patient = (patientsQuery.data?.data ?? []).find((p) => p.id === id);

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, enabled: showBilling });
  const labOrders = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<LabOrder[]>,
    enabled: showLab,
  });

  if (patientsQuery.isLoading) {
    return (
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 72, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 320, borderRadius: 12 }} />
      </div>
    );
  }
  if (!patient) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Patient not found.</MessageBarBody>
        </MessageBar>
        <Button
          style={{ marginTop: 16, borderRadius: 8, fontWeight: 700 }}
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/patients')}
        >
          Back to Patients
        </Button>
      </div>
    );
  }

  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((s, i) => s + Number(i.total), 0);
  const completedAppts = patientAppointments.filter((a) => a.status === 'COMPLETED').length;
  const pendingLab = patientLab.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  const summaryCards = [
    { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon />, bg: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1 },
    { label: 'Completed Visits', value: completedAppts, icon: <MedicalServicesOutlinedIcon />, bg: tokens.colorPaletteGreenBackground1, color: tokens.colorPaletteGreenForeground1 },
    ...(showLab
      ? [{ label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon />, bg: tokens.colorPaletteBlueBackground2, color: tokens.colorPaletteBlueForeground2 }]
      : []),
    ...(showBilling
      ? [{ label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon />, bg: tokens.colorPaletteDarkOrangeBackground1, color: tokens.colorPaletteDarkOrangeForeground1 }]
      : []),
  ];

  const tabs = [
    { label: 'Appointments', count: patientAppointments.length, icon: <CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />, value: 0 },
    ...(showBilling
      ? [{ label: 'Billing', count: patientInvoices.length, icon: <ReceiptOutlinedIcon style={{ fontSize: 18 }} />, value: 1 }]
      : []),
    ...(showLab
      ? [{ label: 'Lab', count: patientLab.length, icon: <BiotechOutlinedIcon style={{ fontSize: 18 }} />, value: 2 }]
      : []),
    { label: 'Documents', count: null as number | null, icon: <InsertDriveFileOutlinedIcon style={{ fontSize: 18 }} />, value: 3 },
    { label: 'Prescriptions', count: null as number | null, icon: <MedicalServicesOutlinedIcon style={{ fontSize: 18 }} />, value: 4 },
  ];

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tooltip content="Back to patients" relationship="label">
              <Button
                appearance="subtle"
                className={styles.backBtn}
                icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
                aria-label="Back to patients"
                onClick={() => navigate('/patients')}
              />
            </Tooltip>
            <div>
              <Text size={300} className={styles.eyebrow}>Patient profile</Text>
              <Title1 className={styles.title}>
                {patient.firstName} {patient.lastName}
              </Title1>
              <Text size={300} className={styles.subtitle}>
                {patient.mrNumber ? `MR# ${patient.mrNumber}` : 'Medical record overview'}
                {patient.phone ? ` · ${patient.phone}` : ''}
              </Text>
            </div>
          </div>
          <div className={styles.actions}>
            <PatientWhatsAppButton patient={patient} style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 8, paddingBottom: 8 }} />
            {!isAdmin && (
              <Button
                icon={<EditOutlinedIcon />}
                appearance="primary"
                className={styles.editBtn}
                onClick={() => setEditOpen(true)}
              >
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        <div className={styles.statsGrid}>
          {summaryCards.map((c) => (
            <div key={c.label} className={`${styles.softCard} ${styles.statCard}`} style={{ backgroundColor: c.bg }}>
              <div className={styles.statRow}>
                <div>
                  <Text className={styles.statValue} style={{ color: c.color }}>{c.value}</Text>
                  <Text size={200} className={styles.statLabel}>{c.label}</Text>
                </div>
                <div className={styles.statIcon} style={{ backgroundColor: `${c.color}26`, color: c.color }}>
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <div className={`${styles.softCard} ${styles.panel}`}>
              <div className={styles.tabBar}>
                <TabList
                  selectedValue={tab}
                  onTabSelect={(_, d) => setTab(Number(d.value))}
                >
                  {tabs.map((t) => (
                    <Tab
                      key={t.label}
                      icon={t.icon}
                      value={t.value}
                    >
                      {t.count !== null ? `${t.label} (${t.count})` : t.label}
                    </Tab>
                  ))}
                </TabList>
              </div>

              <div className={styles.tabBody}>
                {tab === 0 && (
                  patientAppointments.length === 0 ? (
                    <EmptyState
                      icon={<CalendarMonthOutlinedIcon style={{ fontSize: 30 }} />}
                      title="No appointments"
                      subtitle="Appointment history for this patient will show here."
                    />
                  ) : (
                    <div className={styles.list}>
                      {[...patientAppointments]
                        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                        .map((a) => (
                          <div
                            key={a.id}
                            className={styles.listItem}
                            style={{ borderLeftColor: STATUS_BORDER[a.status] ?? tokens.colorNeutralStroke2 }}
                            onClick={() => navigate(`/appointments/${a.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') navigate(`/appointments/${a.id}`);
                            }}
                          >
                            <Avatar
                              icon={<CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />}
                              shape="square"
                              size={40}
                              color="brand"
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text weight="bold" size={300} className={styles.truncate}>
                                {new Date(a.startsAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                              <Text size={200} className={styles.truncate} style={{ display: 'block', color: tokens.colorNeutralForeground2 }}>
                                Dr. {a.provider.firstName} {a.provider.lastName}
                                {a.reason ? ` · ${a.reason}` : ''}
                              </Text>
                            </div>
                            <StatusBadge color={apptStatusColor[a.status] ?? 'subtle'}>
                              {a.status.replace('_', ' ')}
                            </StatusBadge>
                          </div>
                        ))}
                    </div>
                  )
                )}

                {showBilling && tab === 1 && (
                  patientInvoices.length === 0 ? (
                    <EmptyState
                      icon={<ReceiptOutlinedIcon style={{ fontSize: 30 }} />}
                      title="No invoices"
                      subtitle="Billing records for this patient will appear here."
                    />
                  ) : (
                    <div className={styles.list}>
                      {[...patientInvoices]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((inv) => (
                          <div
                            key={inv.id}
                            className={`${styles.listItem} ${styles.listItemInvoice}`}
                            style={{
                              borderLeftColor: INVOICE_BORDER[inv.status] ?? tokens.colorNeutralStroke2,
                              cursor: user?.role === 'receptionist' ? 'pointer' : 'default',
                            }}
                            onClick={() => {
                              if (user?.role === 'receptionist') navigate(`/billing/${inv.id}`);
                            }}
                            role={user?.role === 'receptionist' ? 'button' : undefined}
                            tabIndex={user?.role === 'receptionist' ? 0 : undefined}
                          >
                            <Avatar
                              name={inv.invoiceNumber}
                              initials={inv.invoiceNumber.slice(-4)}
                              shape="square"
                              size={40}
                              color="colorful"
                              style={{
                                backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
                                color: tokens.colorPaletteDarkOrangeForeground1,
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text weight="bold" size={300} style={{ color: tokens.colorBrandForeground1 }}>{inv.invoiceNumber}</Text>
                              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                                {new Date(inv.createdAt).toLocaleDateString()} · Paid {money(Number(inv.amountPaid ?? 0))}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Text weight="bold" size={300}>{money(Number(inv.total))}</Text>
                              <div style={{ marginTop: 2 }}>
                                <StatusBadge
                                  color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'subtle'}
                                >
                                  {inv.status.replace('_', ' ')}
                                </StatusBadge>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )
                )}

                {showLab && tab === 2 && (
                  patientLab.length === 0 ? (
                    <EmptyState
                      icon={<BiotechOutlinedIcon style={{ fontSize: 30 }} />}
                      title="No lab orders"
                      subtitle="Lab test orders for this patient will show here."
                    />
                  ) : (
                    <div className={styles.list}>
                      {[...patientLab]
                        .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
                        .map((o) => (
                          <div
                            key={o.id}
                            style={{
                              cursor: user?.role === 'lab_technician' ? 'pointer' : 'default',
                              borderRadius: 4,
                            }}
                            onClick={() => {
                              if (user?.role === 'lab_technician') navigate(`/lab/${o.id}`);
                            }}
                            role={user?.role === 'lab_technician' ? 'button' : undefined}
                            tabIndex={user?.role === 'lab_technician' ? 0 : undefined}
                          >
                            <LabOrderHistoryCard order={o} />
                          </div>
                        ))}
                    </div>
                  )
                )}

                {tab === 3 && <PatientDocumentsPanel patient={patient} />}
                {tab === 4 && <PrescriptionsTabInline patientId={patient.id} patient={patient} />}
              </div>
            </div>
          </div>

          <div className={styles.sideCol}>
            <div className={styles.hero}>
              <div className={styles.heroTop}>
                <Avatar
                  className={styles.heroAvatar}
                  name={`${patient.firstName} ${patient.lastName}`}
                  initials={initials}
                  size={64}
                  color="brand"
                />
                <div style={{ minWidth: 0 }}>
                  <Text weight="bold" style={{ fontSize: 18, color: 'inherit' }} className={styles.truncate}>
                    {patient.firstName} {patient.lastName}
                  </Text>
                  <div className={styles.heroBadges}>
                    {patient.mrNumber && (
                      <Badge appearance="filled" size="small" className={styles.glassBadge}>
                        MR# {patient.mrNumber}
                      </Badge>
                    )}
                    {patient.bloodGroup && (
                      <Badge appearance="filled" size="small" className={styles.glassBadge}>
                        {patient.bloodGroup}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.heroContact}>
                {patient.phone && (
                  <div className={styles.heroContactRow}>
                    <PhoneOutlinedIcon style={{ fontSize: 16, opacity: 0.85 }} />
                    <Text size={300} weight="semibold" style={{ color: 'inherit' }}>{patient.phone}</Text>
                  </div>
                )}
                {patient.email && (
                  <div className={styles.heroContactRow}>
                    <EmailOutlinedIcon style={{ fontSize: 16, opacity: 0.85 }} />
                    <Text size={300} weight="semibold" style={{ color: 'inherit', wordBreak: 'break-all' }}>{patient.email}</Text>
                  </div>
                )}
                {patient.dateOfBirth && (
                  <div className={styles.heroContactRow}>
                    <CakeOutlinedIcon style={{ fontSize: 16, opacity: 0.85 }} />
                    <Text size={300} weight="semibold" style={{ color: 'inherit' }}>
                      {new Date(patient.dateOfBirth).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </div>
                )}
              </div>
            </div>

            <div className={`${styles.softCard} ${styles.sideCard}`}>
              <Text className={styles.sideTitle}>Contact Details</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <InfoRow icon={<PhoneOutlinedIcon style={{ fontSize: 17 }} />} label="Phone" value={patient.phone || '—'} />
                <InfoRow icon={<EmailOutlinedIcon style={{ fontSize: 17 }} />} label="Email" value={patient.email || '—'} />
                <InfoRow icon={<HomeOutlinedIcon style={{ fontSize: 17 }} />} label="Address" value={patient.address || '—'} />
                {patient.emergencyContactName && (
                  <InfoRow
                    icon={<ContactPhoneOutlinedIcon style={{ fontSize: 17 }} />}
                    label="Emergency"
                    value={`${patient.emergencyContactName}${patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ''}`}
                  />
                )}
              </div>
            </div>

            <div className={`${styles.softCard} ${styles.sideCard}`}>
              <Text className={styles.sideTitle}>Overview</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ...(showBilling ? [{ label: 'Total Paid', value: money(totalPaid), color: tokens.colorPaletteGreenForeground1 }] : []),
                  ...(showLab ? [{ label: 'Pending Lab', value: pendingLab, color: tokens.colorPaletteDarkOrangeForeground1 }] : []),
                  { label: 'Completed Visits', value: completedAppts, color: tokens.colorBrandForeground1 },
                ].map((s) => (
                  <div key={s.label} className={styles.overviewRow}>
                    <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>{s.label}</Text>
                    <Text weight="bold" style={{ fontSize: 15, color: s.color }}>{s.value}</Text>
                  </div>
                ))}
              </div>
            </div>

            {(patient.allergies || patient.chronicConditions) && (
              <div className={`${styles.softCard} ${styles.sideCard}`}>
                <Text className={styles.sideTitle}>Medical Alerts</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {patient.allergies && (
                    <div
                      className={styles.alertBox}
                      style={{
                        backgroundColor: tokens.colorPaletteRedBackground1,
                        borderLeftColor: tokens.colorPaletteRedForeground1,
                      }}
                    >
                      <div className={styles.alertHead}>
                        <WarningAmberOutlinedIcon style={{ fontSize: 18, color: tokens.colorPaletteRedForeground1 }} />
                        <Text size={200} weight="bold" style={{ color: tokens.colorPaletteRedForeground1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Allergies
                        </Text>
                      </div>
                      <Text size={300} weight="semibold">{patient.allergies}</Text>
                    </div>
                  )}
                  {patient.chronicConditions && (
                    <div
                      className={styles.alertBox}
                      style={{
                        backgroundColor: tokens.colorPaletteDarkOrangeBackground1,
                        borderLeftColor: tokens.colorPaletteDarkOrangeForeground1,
                      }}
                    >
                      <div className={styles.alertHead}>
                        <HealthAndSafetyOutlinedIcon style={{ fontSize: 18, color: tokens.colorPaletteDarkOrangeForeground1 }} />
                        <Text size={200} weight="bold" style={{ color: tokens.colorPaletteDarkOrangeForeground1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Chronic Conditions
                        </Text>
                      </div>
                      <Text size={300} weight="semibold">{patient.chronicConditions}</Text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {patient.mrNumber && (
              <div className={`${styles.softCard} ${styles.mrCard}`}>
                <div className={styles.mrIcon}>
                  <BadgeOutlinedIcon />
                </div>
                <div>
                  <Text size={200} weight="bold" style={{ color: tokens.colorNeutralForeground2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Medical Record
                  </Text>
                  <Text weight="bold" style={{ fontSize: 16, color: tokens.colorBrandForeground1, display: 'block' }}>{patient.mrNumber}</Text>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && patient && (
        <PatientDialog open={editOpen} patient={patient} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
