import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Prescription } from '@/types/token';
import { ListCardsSkeleton } from '@/components/LoadingUI';
import { StatusBadge } from '@/components/TableUI';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import type { Patient } from '@/types/patient';
import { PrescriptionPrintPreview } from '@/features/tokens/PrescriptionPrintPreview';
import { formatAdvicePreview } from '@/features/tokens/PrescriptionPadPdf';
import { PatientDocumentsPanel } from './PatientDocumentsPanel';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { LabOrderHistoryCard } from '@/features/lab/LabOrderResultView';
import type { LabOrder } from '@/types/lab';
import { AutoAwesomeOutlinedIcon, BiotechOutlinedIcon, CalendarMonthOutlinedIcon, InsertDriveFileOutlinedIcon, MedicalServicesOutlinedIcon, MonitorHeartOutlinedIcon, PrintOutlinedIcon, ReceiptOutlinedIcon } from '@/icons/fluent';

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
  VOID: tokens.colorPaletteRedForeground1,
  REFUNDED: tokens.colorPaletteRedForeground1,
  DRAFT: tokens.colorPaletteBlueForeground2,
};

const useStyles = makeStyles({
  surface: {
    width: '100%',
    maxWidth: '1100px',
    minHeight: '650px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '28px',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    padding: tokens.spacingVerticalXL,
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  hero: {
    padding: '22px',
    borderRadius: '24px',
    background: `linear-gradient(145deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 50%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: `0 12px 28px ${tokens.colorBrandBackground2}`,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
  },
  heroAvatar: {
    width: '58px',
    height: '58px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 900,
    border: '2px solid rgba(255,255,255,0.35)',
  },
  heroNameRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  heroName: {
    fontWeight: 900,
    fontSize: tokens.fontSizeBase500,
    color: 'inherit',
  },
  heroSub: {
    opacity: 0.88,
    marginTop: '3px',
    display: 'block',
    color: 'inherit',
  },
  closeHero: {
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightBold,
    backgroundColor: 'rgba(255,255,255,0.16)',
    color: '#fff',
    border: 'none',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.24)',
      color: '#fff',
    },
  },
  mrBadge: {
    height: '22px',
    fontWeight: tokens.fontWeightBold,
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#fff',
  },
  statsGrid: {
    display: 'grid',
    gap: '14px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: '0 4px 18px rgba(0,0,0,0.04)',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  statCard: {
    padding: '17px',
    border: 'none',
  },
  statRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: '26px',
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
    width: '38px',
    height: '38px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
  },
  tabs: {
    paddingLeft: '20px',
    paddingRight: '20px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    minHeight: '48px',
    flexShrink: 0,
  },
  body: {
    padding: 0,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    flexDirection: 'column',
  },
  footer: {
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '14px',
    paddingBottom: '14px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
  },
  listItem: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
  },
  listItemInvoice: {
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
  },
  itemAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
  },
  medicalGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    padding: tokens.spacingVerticalL,
  },
  medicalCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusMedium,
  },
  medicalLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  rxHead: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
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
      backgroundColor: tokens.colorBrandBackground2,
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
  summaryAlert: {
    whiteSpace: 'pre-wrap',
    alignItems: 'flex-start',
  },
});

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <Text weight="bold" style={{ display: 'block', marginBottom: 4 }}>Nothing here yet</Text>
      <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{text}</Text>
    </div>
  );
}

function PrescriptionsTab({ patientId, patient }: { patientId: string; patient?: Patient }): React.JSX.Element {
  const styles = useStyles();
  const { can } = useLicense();
  type PrintItem = {
    prescription: Prescription;
    doctor: { firstName: string; lastName: string };
  };
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tokens-all-prescriptions', patientId],
    queryFn: async () => {
      const today = new Date();
      const results: Array<{
        prescription: Prescription;
        doctor: { firstName: string; lastName: string };
        tokenNumber?: number;
        date?: string;
      }> = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayTokens = await window.clinic.tokens.list(dateStr);
        for (const t of dayTokens) {
          if (t.patientId === patientId && t.prescription) {
            results.push({
              prescription: t.prescription,
              doctor: t.doctor ?? { firstName: '', lastName: '' },
              tokenNumber: t.tokenNumber,
              date: t.date,
            });
          }
        }
      }
      return results;
    },
  });

  async function handleSummarize(): Promise<void> {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary('');
    try {
      const visits = items.slice(0, 12).map((item) => ({
        date: new Date(item.prescription.createdAt).toLocaleDateString(),
        diagnosis: item.prescription.diagnosis || item.prescription.thumbName || '',
        advice: formatAdvicePreview(item.prescription.advice || ''),
      }));
      let streamed = '';
      const result = await window.clinic.ai.summarizePatient(
        {
          patientName: patient
            ? `${patient.firstName} ${patient.lastName}`.trim()
            : undefined,
          visits,
        },
        (delta) => {
          streamed += delta;
          setSummary(streamed);
        },
      );
      if (!result?.ok || !result.summary) {
        setSummaryError(result?.error || 'Summary failed');
        setSummary(null);
        return;
      }
      setSummary(result.summary);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Summary failed');
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  if (isLoading) return <div style={{ padding: 16 }}><ListCardsSkeleton count={5} /></div>;
  if (items.length === 0) return <EmptyState icon={<MedicalServicesOutlinedIcon style={{ fontSize: 40 }} />} text="No prescriptions found." />;

  return (
    <>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className={styles.rxHead}>
          <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>
            {items.length} prescription{items.length === 1 ? '' : 's'}
          </Text>
          {can('ai') && (
            <Button
              size="small"
              appearance="outline"
              icon={summaryLoading ? <Spinner size="tiny" /> : <AutoAwesomeOutlinedIcon />}
              disabled={summaryLoading}
              onClick={() => void handleSummarize()}
              style={{ borderRadius: 4 }}
            >
              AI Summarize
            </Button>
          )}
        </div>
        {can('ai') && summaryError && (
          <MessageBar intent="error">
            <MessageBarBody>{summaryError}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button appearance="transparent" icon={<Dismiss24Regular />} aria-label="close" onClick={() => setSummaryError(null)} />
              }
            />
          </MessageBar>
        )}
        {can('ai') && summary !== null && (
          <MessageBar intent="info" icon={<AutoAwesomeOutlinedIcon />} className={styles.summaryAlert}>
            <MessageBarBody>
              <Text size={200} weight="bold" style={{ display: 'block', marginBottom: 4 }}>
                AI visit summary — verify clinically
              </Text>
              <Text size={300} style={{ whiteSpace: 'pre-wrap' }}>
                {summary || (summaryLoading ? '…' : '')}
              </Text>
            </MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button appearance="transparent" icon={<Dismiss24Regular />} aria-label="close" onClick={() => setSummary(null)} />
              }
            />
          </MessageBar>
        )}
        {items.map((item) => {
          const pr = item.prescription;
          const doctorLabel = `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim();
          const title = pr.thumbName?.trim() || pr.diagnosis || 'Prescription Entry';
          const thumbSrc = pr.thumbnail ? `data:image/png;base64,${pr.thumbnail}` : null;
          return (
            <div
              key={pr.id}
              className={styles.rxCard}
              onClick={() => setPrintItem({
                prescription: pr,
                doctor: item.doctor ?? { firstName: '', lastName: '' },
              })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setPrintItem({
                    prescription: pr,
                    doctor: item.doctor ?? { firstName: '', lastName: '' },
                  });
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
                    icon={<PrintOutlinedIcon style={{ fontSize: 16 }} />}
                    aria-label="Print Prescription"
                    onClick={() => setPrintItem({
                      prescription: pr,
                      doctor: item.doctor ?? { firstName: '', lastName: '' },
                    })}
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

export function PatientHistoryDialog({ patient, onClose }: { patient: Patient; onClose: () => void }): React.JSX.Element | null {
  const styles = useStyles();
  const { can } = useLicense();
  const [tab, setTab] = useState('0');
  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(v)}`;
  const showLab = can('labDashboard');

  const appointments = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list, enabled: can('managePatients') });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: invoicesService.list, enabled: can('managePatients') });
  const labOrders = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list() as Promise<LabOrder[]>,
    enabled: can('managePatients') && showLab,
  });
  if (!can('managePatients')) return null;
  const patientAppointments = (appointments.data ?? []).filter((a) => a.patientId === patient.id);
  const patientInvoices = (invoices.data ?? []).filter((i) => i.patient.id === patient.id);
  const patientLab = (labOrders.data ?? []).filter((o) => o.patientId === patient.id);
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  const totalPaid = patientInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid ?? 0), 0);
  const totalBilled = patientInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
  const completedAppointments = patientAppointments.filter((a) => a.status === 'COMPLETED').length;
  const medicalTab = showLab ? '3' : '2';
  const documentsTab = showLab ? '4' : '3';
  const prescriptionsTab = showLab ? '5' : '4';

  const summaryCards = [
    { label: 'Appointments', value: patientAppointments.length, icon: <CalendarMonthOutlinedIcon />, bg: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1 },
    { label: 'Completed', value: completedAppointments, icon: <MonitorHeartOutlinedIcon />, bg: tokens.colorPaletteGreenBackground1, color: tokens.colorPaletteGreenForeground1 },
    ...(showLab
      ? [{ label: 'Lab Orders', value: patientLab.length, icon: <BiotechOutlinedIcon />, bg: tokens.colorPaletteBlueBackground2, color: tokens.colorPaletteBlueForeground2 }]
      : []),
    { label: 'Total Billed', value: money(totalBilled), icon: <ReceiptOutlinedIcon />, bg: tokens.colorPaletteDarkOrangeBackground1, color: tokens.colorPaletteDarkOrangeForeground1 },
    { label: 'Paid', value: money(totalPaid), icon: <ReceiptOutlinedIcon />, bg: tokens.colorPaletteBlueBackground2, color: tokens.colorPaletteBlueForeground2 },
  ];

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <div className={styles.header}>
          <div className={styles.hero}>
            <div className={styles.heroLeft}>
              <Avatar className={styles.heroAvatar} name={`${patient.firstName} ${patient.lastName}`} initials={initials} color="brand" size={56} />
              <div>
                <div className={styles.heroNameRow}>
                  <Text className={styles.heroName}>{patient.firstName} {patient.lastName}</Text>
                  {patient.mrNumber && (
                    <Badge appearance="filled" className={styles.mrBadge} size="small">
                      MR# {patient.mrNumber}
                    </Badge>
                  )}
                </div>
                <Text size={300} className={styles.heroSub}>Medical & treatment history</Text>
              </div>
            </div>
            <Button onClick={onClose} className={styles.closeHero}>Close</Button>
          </div>

          <div className={styles.statsGrid}>
            {summaryCards.map((card) => (
              <div key={card.label} className={`${styles.softCard} ${styles.statCard}`} style={{ backgroundColor: card.bg }}>
                <div className={styles.statRow}>
                  <div>
                    <Text className={styles.statValue} style={{ color: card.color }}>{card.value}</Text>
                    <Text size={200} className={styles.statLabel}>{card.label}</Text>
                  </div>
                  <div className={styles.statIcon} style={{ backgroundColor: `${card.color}26`, color: card.color }}>
                    {card.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.tabs}>
          <TabList
            selectedValue={tab}
            onTabSelect={(_, d) => setTab(String(d.value))}
          >
            <Tab icon={<CalendarMonthOutlinedIcon style={{ fontSize: 16 }} />} value="0">Appointments</Tab>
            <Tab icon={<ReceiptOutlinedIcon style={{ fontSize: 16 }} />} value="1">Billing</Tab>
            {showLab && (
              <Tab icon={<BiotechOutlinedIcon style={{ fontSize: 16 }} />} value="2">{`Lab (${patientLab.length})`}</Tab>
            )}
            <Tab icon={<MonitorHeartOutlinedIcon style={{ fontSize: 16 }} />} value={medicalTab}>Medical Info</Tab>
            <Tab icon={<InsertDriveFileOutlinedIcon style={{ fontSize: 16 }} />} value={documentsTab}>Documents</Tab>
            <Tab icon={<MedicalServicesOutlinedIcon style={{ fontSize: 16 }} />} value={prescriptionsTab}>Prescriptions</Tab>
          </TabList>
        </div>

        <DialogBody style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
          <DialogContent className={styles.body}>
            {tab === '0' && (
              patientAppointments.length === 0
                ? <EmptyState icon={<CalendarMonthOutlinedIcon style={{ fontSize: 40 }} />} text="No appointments found." />
                : (
                  <div className={styles.list}>
                    {[...patientAppointments]
                      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                      .map((a) => (
                        <div
                          key={a.id}
                          className={styles.listItem}
                          style={{ borderLeftColor: STATUS_BORDER[a.status] ?? tokens.colorNeutralStroke2 }}
                        >
                          <Avatar
                            className={styles.itemAvatar}
                            icon={<CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />}
                            shape="square"
                            size={40}
                            color="brand"
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <div>
                                <Text weight="bold" size={300}>
                                  {new Date(a.startsAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Text size={200} style={{ display: 'block', marginTop: 1, color: tokens.colorNeutralForeground2 }}>
                                  Dr. {a.provider.firstName} {a.provider.lastName}
                                  {a.reason ? ` · ${a.reason}` : ''}
                                </Text>
                              </div>
                              <StatusBadge color={apptStatusColor[a.status] ?? 'subtle'}>
                                {a.status.replace('_', ' ')}
                              </StatusBadge>
                            </div>
                            {a.notes && (
                              <Text size={300} style={{ display: 'block', marginTop: 6, color: tokens.colorNeutralForeground2, fontSize: 13 }}>
                                {a.notes}
                              </Text>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )
            )}

            {tab === '1' && (
              patientInvoices.length === 0
                ? <EmptyState icon={<ReceiptOutlinedIcon style={{ fontSize: 40 }} />} text="No invoices found." />
                : (
                  <div className={styles.list}>
                    {[...patientInvoices]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className={`${styles.listItem} ${styles.listItemInvoice}`}
                          style={{
                            alignItems: 'center',
                            borderLeftColor: INVOICE_BORDER[inv.status] ?? tokens.colorPaletteBlueForeground2,
                          }}
                        >
                          <Avatar
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 4,
                              backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
                              color: tokens.colorPaletteDarkOrangeForeground1,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                            name={inv.invoiceNumber}
                            initials={inv.invoiceNumber.slice(-4)}
                            shape="square"
                            size={40}
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

            {showLab && tab === '2' && (
              patientLab.length === 0
                ? <EmptyState icon={<BiotechOutlinedIcon style={{ fontSize: 40 }} />} text="Lab test orders for this patient will show here." />
                : (
                  <div className={styles.list}>
                    {[...patientLab]
                      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
                      .map((o) => <LabOrderHistoryCard key={o.id} order={o} />)}
                  </div>
                )
            )}

            {tab === medicalTab && (
              <div className={styles.medicalGrid}>
                {[
                  { label: 'Blood Group', value: patient.bloodGroup },
                  { label: 'Allergies', value: patient.allergies },
                  { label: 'Chronic Conditions', value: patient.chronicConditions },
                ].map(({ label, value }) => (
                  <div key={label} className={`${styles.softCard} ${styles.medicalCard}`}>
                    <Text size={200} className={styles.medicalLabel}>{label}</Text>
                    <Text style={{
                      marginTop: 4,
                      display: 'block',
                      fontWeight: value ? 700 : 400,
                      color: value ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground3,
                    }}
                    >
                      {value || '—'}
                    </Text>
                  </div>
                ))}
              </div>
            )}

            {tab === documentsTab && <PatientDocumentsPanel patient={patient} />}
            {tab === prescriptionsTab && <PrescriptionsTab patientId={patient.id} patient={patient} />}
          </DialogContent>
        </DialogBody>

        <DialogActions className={styles.footer}>
          <PatientWhatsAppButton patient={patient} />
          <Button onClick={onClose} appearance="outline" style={{ borderRadius: 8, fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
