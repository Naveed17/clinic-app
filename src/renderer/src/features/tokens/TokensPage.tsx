import {
  Avatar,
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Tab,
  TabList,
  Text,
  Textarea,
  Title2,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { FluentDateField, formatDateIso, parseDateIso } from '@/components/FluentDateField';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Document, Page, Text as PdfText, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { DEFAULT_CLINIC_LOGO, useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import type { Token, TokenPerson, TokenStatus, PrescriptionInput, PrescriptionMedicine } from '@/types/token';
import { useAuth } from '@/features/auth/AuthContext';
import { FetchingBar, ListCardsSkeleton, StatCardsSkeleton } from '@/components/LoadingUI';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { appointmentsService } from '@/services/appointments.service';
import { doctorOfflineReason, slotSearchFrom } from '@/utils/appointmentSlot';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import { ConfirmDialog, FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { StatusBadge } from '@/components/TableUI';
import { PdfBlobPreview } from '@/utils/PdfBlobPreview';
import { printTokenSlip } from '@/utils/printTokenSlip';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';
import { labResultPreview } from '@/features/lab/labReportPayload';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { TokenFeeFields } from '@/features/tokens/TokenFeeFields';
import { tokenNetFee } from '@shared/tokenFee';
import { AddOutlinedIcon, CheckCircleOutlinedIcon, ChevronLeftIcon, ChevronRightIcon, CloseOutlinedIcon, ConfirmationNumberOutlinedIcon, DeleteOutlineIcon, DoneAllOutlinedIcon, HourglassEmptyOutlinedIcon, PrintOutlinedIcon, SkipNextOutlinedIcon, UndoOutlinedIcon } from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<TokenStatus, { label: string; color: StatusColor }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'subtle' },
};

const useDialogStyles = makeStyles({
  surface: {
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  surfaceMd: {
    maxWidth: '720px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  fields: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  doctorOption: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, width: '100%' },
  doctorFee: { marginLeft: 'auto', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightBold },
  medGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, marginBottom: tokens.spacingVerticalS },
  row: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  previewSurface: {
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  previewHead: {
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  previewBody: { padding: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto', backgroundColor: '#f1f5f9' },
  previewFoot: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  previewActions: { display: 'flex', justifyContent: 'flex-end', gap: '4px' },
  loadingBox: { height: '560px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
});

const usePageStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL, paddingBottom: tokens.spacingVerticalL },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: tokens.spacingHorizontalL, flexWrap: 'wrap' },
  subtitle: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightSemibold },
  title: { letterSpacing: '-0.02em', marginTop: tokens.spacingVerticalXXS, fontWeight: 900 },
  headerActions: { display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center', flexWrap: 'wrap' },
  metrics: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(4, 1fr)',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr 1fr' },
  },
  metricCard: { padding: tokens.spacingVerticalXL, borderRadius: '20px', border: 'none' },
  metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  metricIcon: { width: '40px', height: '40px', borderRadius: tokens.borderRadiusMedium, display: 'grid', placeItems: 'center' },
  layout: { display: 'grid', gap: tokens.spacingVerticalXL, alignItems: 'start' },
  col: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, minWidth: 0 },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalXL,
    position: 'relative',
  },
  doctorBar: {
    padding: '4px',
    paddingLeft: '16px',
    borderRadius: '999px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  doctorLabel: {
    flexShrink: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase100,
  },
  queueHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalL },
  queueList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' },
  tokenRow: {
    padding: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
  },
  tokenBody: { flex: 1, minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  tokenActions: { display: 'flex', gap: '2px' },
  empty: { paddingTop: '40px', paddingBottom: '40px', textAlign: 'center' },
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
  nowCard: {
    padding: '22px',
    borderRadius: '24px',
    border: 'none',
    backgroundImage: `linear-gradient(160deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackgroundSelected} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow16,
    position: 'relative',
    overflow: 'hidden',
  },
  nowOrb1: {
    position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px',
    borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)',
  },
  nowOrb2: {
    position: 'absolute', right: '20px', bottom: '-40px', width: '100px', height: '100px',
    borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nowActions: { display: 'flex', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalXL },
  snapshot: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  snapshotRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tabsWrap: { position: 'relative', flex: 1, minWidth: 0 },
  tabsScroller: {
    display: 'flex',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    borderRadius: '999px',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '4px',
  },
  scrollBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: '28px',
    height: '28px',
    minWidth: '28px',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
});

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

function feeLabel(fee: unknown): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(fee) || 0)}`;
}

export function IssueTokenDialog({ open, onClose, date, defaultPatientId, defaultDoctorId, onSuccess }: {
  open: boolean;
  onClose: () => void;
  date: string;
  defaultPatientId?: string;
  defaultDoctorId?: string;
  onSuccess?: (token: Token) => void;
}): React.JSX.Element {
  const styles = useDialogStyles();
  const qc = useQueryClient();
  const { can } = useLicense();
  const showLabReason = can('labDashboard');
  const [patientId, setPatientId] = useState(defaultPatientId ?? '');
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? '');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [feeDiscount, setFeeDiscount] = useState('');

  useEffect(() => {
    if (open) {
      setPatientId(defaultPatientId ?? '');
      setDoctorId(defaultDoctorId ?? '');
      setNotes('');
      setReason('');
      setConsultationFee('');
      setFeeDiscount('');
    }
  }, [open, defaultPatientId, defaultDoctorId]);

  const { data: patients = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
  });
  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });

  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId) ?? null, [patients, patientId]);
  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId) ?? null, [doctors, doctorId]);

  useEffect(() => {
    if (!open || !selectedDoctor) return;
    setConsultationFee(String(Number(selectedDoctor.consultationFee ?? 0)));
    setFeeDiscount('');
  }, [open, selectedDoctor]);

  const { data: weekVisits } = useQuery({
    queryKey: ['token-week-visits', patientId, doctorId, date],
    queryFn: () => window.clinic.tokens.weekVisits(patientId, doctorId, date).catch(() => ({ count: 0 })),
    enabled: open && Boolean(patientId && doctorId && date),
  });
  const { data: tokenSchedule = [], isFetched: tokenScheduleFetched } = useQuery({
    queryKey: ['schedule', doctorId],
    queryFn: () => window.clinic.schedule.get(doctorId),
    enabled: open && Boolean(doctorId),
  });
  const offlineReason = doctorId && date && tokenScheduleFetched
    ? doctorOfflineReason(tokenSchedule, date)
    : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const startsAt = slotSearchFrom(date);
      const endsAt = new Date(startsAt.getTime() + 30 * 60000);
      await appointmentsService.ensureSameDay({
        patientId,
        providerId: doctorId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: reason || null,
        notes: notes || null,
        recurrenceRule: null,
      });
      return window.clinic.tokens.create({
        patientId,
        doctorId,
        date,
        notes,
        reason,
        consultationFee: parseFloat(consultationFee) || 0,
        feeDiscount: parseFloat(feeDiscount) || 0,
      }) as Promise<Token>;
    },
    onSuccess: async (token: Token) => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await qc.invalidateQueries({ queryKey: ['appointments'] });
      setPatientId(''); setDoctorId(''); setNotes(''); setReason(''); setConsultationFee(''); setFeeDiscount('');
      onClose();
      onSuccess?.(token);
    },
    meta: { silent: true },
  });

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle title="Issue Token" subtitle="Create a queue token for a patient visit." />
        <DialogBody>
          <DialogContent className={styles.body}>
            <div className={styles.fields}>
              {mutation.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>{(mutation.error as Error)?.message || 'Failed to issue token.'}</MessageBarBody>
                </MessageBar>
              )}
              {offlineReason && (
                <MessageBar intent="warning"><MessageBarBody>{offlineReason}</MessageBarBody></MessageBar>
              )}
              <Field label="Patient">
                <Combobox
                  placeholder="Select patient"
                  value={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : ''}
                  selectedOptions={patientId ? [patientId] : []}
                  onOptionSelect={(_, data) => setPatientId(data.optionValue ?? '')}
                >
                  {patients.map((p) => (
                    <Option key={p.id} value={p.id} text={`${p.firstName} ${p.lastName}`}>
                      {p.firstName} {p.lastName}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field label="Doctor">
                <Combobox
                  placeholder="Select doctor"
                  value={selectedDoctor ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}` : ''}
                  selectedOptions={doctorId ? [doctorId] : []}
                  onOptionSelect={(_, data) => setDoctorId(data.optionValue ?? '')}
                >
                  {doctors.map((d) => (
                    <Option key={d.id} value={d.id} text={`Dr. ${d.firstName} ${d.lastName}`}>
                      <div className={styles.doctorOption}>
                        <DoctorAvatar src={d.avatar} name={`Dr. ${d.firstName} ${d.lastName}`} size={28} />
                        <Text weight="semibold" size={300} style={{ flex: 1 }}>
                          Dr. {d.firstName} {d.lastName}
                        </Text>
                        <Text size={200} className={styles.doctorFee}>{feeLabel(d.consultationFee)}</Text>
                      </div>
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <TokenFeeFields
                consultationFee={consultationFee}
                feeDiscount={feeDiscount}
                onFeeChange={setConsultationFee}
                onDiscountChange={setFeeDiscount}
                priorVisitsThisWeek={weekVisits?.count ?? 0}
              />
              <Field label="Reason (optional)">
                <Dropdown
                  value={reason || '— None —'}
                  selectedOptions={[reason]}
                  onOptionSelect={(_, data) => setReason(data.optionValue ?? '')}
                >
                  <Option value="" text="— None —">— None —</Option>
                  <Option value="Checkup" text="Checkup">Checkup</Option>
                  <Option value="Follow-up" text="Follow-up">Follow-up</Option>
                  <Option value="Urgent" text="Urgent">Urgent</Option>
                  <Option value="Consultation" text="Consultation">Consultation</Option>
                  {showLabReason && <Option value="Lab Results" text="Lab Results">Lab Results</Option>}
                  <Option value="Vaccination" text="Vaccination">Vaccination</Option>
                </Dropdown>
              </Field>
              <Field label="Notes (optional)">
                <Input value={notes} onChange={(_, d) => setNotes(d.value)} />
              </Field>
            </div>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <SubmitButton
            disabled={!patientId || !doctorId || Boolean(offlineReason)}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Issue Token
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}

function FeeRefundDialog({ token, onClose }: { token: Token; onClose: () => void }): React.JSX.Element {
  const styles = useDialogStyles();
  const qc = useQueryClient();
  const remaining = tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded);
  const charged = tokenNetFee(token.consultationFee, token.feeDiscount, 0);
  const [amount, setAmount] = useState(String(remaining));
  const mutation = useMutation({
    mutationFn: () => {
      const n = parseFloat(amount);
      return window.clinic.tokens.refundFee(token.id, Number.isFinite(n) ? n : remaining);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      onClose();
    },
    meta: { toast: 'Consultation fee refunded', errorToast: 'Failed to refund fee.' },
  });
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={`Refund fee — Token #${String(token.tokenNumber).padStart(3, '0')}`}
          subtitle={`Return consultation fee for ${token.patient.firstName} ${token.patient.lastName}.`}
        />
        <DialogBody>
          <DialogContent className={styles.body}>
            <div className={styles.fields}>
              {mutation.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>{(mutation.error as Error)?.message || 'Failed to refund fee.'}</MessageBarBody>
                </MessageBar>
              )}
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                Collected: <strong>Rs. {new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(charged)}</strong>
                {Number(token.feeDiscount ?? 0) > 0
                  ? ` · Discount: Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(token.feeDiscount))}`
                  : ''}
                {Number(token.feeRefunded ?? 0) > 0
                  ? ` · Already refunded: Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(token.feeRefunded))}`
                  : ''}
              </Text>
              <Field label="Refund amount">
                <Input
                  type="number"
                  value={amount}
                  onChange={(_, d) => setAmount(d.value)}
                  contentBefore={<Text size={200}>Rs.</Text>}
                />
              </Field>
            </div>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <SubmitButton loading={mutation.isPending} disabled={remaining <= 0} onClick={() => mutation.mutate()}>
            Refund Fee
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}

Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzA.ttf' },
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lNkaiiRdih4SpP_SEvyRTo39l8hw.ttf', fontWeight: 'bold' },
  ],
});

const ts = StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    color: POS_RECEIPT.ink,
    paddingTop: POS_PAPER.pdfPaddingTop,
    paddingBottom: POS_PAPER.pdfPaddingBottom,
    paddingLeft: POS_PAPER.pdfPaddingLeft,
    paddingRight: POS_PAPER.pdfPaddingRight,
    fontFamily: POS_PAPER.pdfFontFamily,
  },
  logo: { width: 36, height: 36, alignSelf: 'center', marginBottom: 6 },
  shopName: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 2, color: '#000' },
  shopSub: { fontSize: 10, textAlign: 'center', color: POS_RECEIPT.muted, marginBottom: 1 },
  stars: { fontSize: 9, textAlign: 'center', color: '#000', marginVertical: 5 },
  title: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginVertical: 2, letterSpacing: 1, color: '#000' },
  tokenBox: { borderWidth: 2, borderColor: '#000', marginVertical: 8, paddingVertical: 8, alignItems: 'center' },
  tokenLabel: { fontSize: 9, letterSpacing: 2, color: '#000', fontWeight: 'bold' },
  tokenNum: { fontSize: 48, fontWeight: 'bold', lineHeight: 1, letterSpacing: 3, color: '#000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  lbl: { fontSize: 10, color: '#000', fontWeight: 'bold' },
  val: { fontSize: 10, color: POS_RECEIPT.muted },
  footer: { fontSize: 9, color: POS_RECEIPT.muted, textAlign: 'center', marginTop: 10 },
  brand: { fontSize: 8, color: '#000', textAlign: 'center', marginTop: 8, fontWeight: 'bold', letterSpacing: 0.5 },
});

export function TokenSlipDocument({ token, clinicName, clinicAddress, clinicPhone, logoSrc = DEFAULT_CLINIC_LOGO }: {
  token: Token; clinicName: string; clinicAddress: string; clinicPhone: string; logoSrc?: string;
}): React.JSX.Element {
  const date = new Date(token.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Document>
      <Page size={[POS_PAPER.pdfPageWidth, POS_PAPER.pdfPageHeightToken]} style={ts.page} wrap={false}>
        <Image src={logoSrc} style={ts.logo} />
        <PdfText style={ts.shopName}>{clinicName || POS_RECEIPT.clinicFallback}</PdfText>
        {clinicAddress ? <PdfText style={ts.shopSub}>{clinicAddress}</PdfText> : null}
        {clinicPhone ? <PdfText style={ts.shopSub}>Tel: {clinicPhone}</PdfText> : null}
        <PdfText style={ts.stars}>{POS_RECEIPT.starLine}</PdfText>
        <PdfText style={ts.title}>PATIENT TOKEN SLIP</PdfText>
        <PdfText style={ts.stars}>{POS_RECEIPT.starLine}</PdfText>
        <View style={ts.tokenBox}>
          <PdfText style={ts.tokenLabel}>TOKEN NO.</PdfText>
          <PdfText style={ts.tokenNum}>{String(token.tokenNumber).padStart(3, '0')}</PdfText>
        </View>
        <PdfText style={ts.stars}>{POS_RECEIPT.starLine}</PdfText>
        <View style={ts.row}><PdfText style={ts.lbl}>Patient</PdfText><PdfText style={ts.val}>{token.patient.firstName} {token.patient.lastName}</PdfText></View>
        {token.patient.mrNumber ? <View style={ts.row}><PdfText style={ts.lbl}>MR #</PdfText><PdfText style={ts.val}>{token.patient.mrNumber}</PdfText></View> : null}
        <View style={ts.row}><PdfText style={ts.lbl}>Doctor</PdfText><PdfText style={ts.val}>Dr. {token.doctor.firstName} {token.doctor.lastName}</PdfText></View>
        {Number(token.consultationFee ?? 0) > 0 ? (
          <>
            <View style={ts.row}>
              <PdfText style={ts.lbl}>Fee</PdfText>
              <PdfText style={ts.val}>{feeLabel(token.consultationFee)}</PdfText>
            </View>
            {Number(token.feeDiscount ?? 0) > 0 ? (
              <View style={ts.row}>
                <PdfText style={ts.lbl}>Discount</PdfText>
                <PdfText style={ts.val}>
                  - Rs. {new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(token.feeDiscount))}
                </PdfText>
              </View>
            ) : null}
            {Number(token.feeDiscount ?? 0) > 0 || Number(token.feeRefunded ?? 0) > 0 ? (
              <View style={ts.row}>
                <PdfText style={ts.lbl}>Payable</PdfText>
                <PdfText style={ts.val}>
                  Rs. {new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded))}
                  {Number(token.feeRefunded ?? 0) > 0 ? ' (refunded)' : ''}
                </PdfText>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={ts.row}><PdfText style={ts.lbl}>Date</PdfText><PdfText style={ts.val}>{date}</PdfText></View>
        <View style={ts.row}><PdfText style={ts.lbl}>Time</PdfText><PdfText style={ts.val}>{time}</PdfText></View>
        {token.notes ? <View style={ts.row}><PdfText style={ts.lbl}>Note</PdfText><PdfText style={ts.val}>{token.notes}</PdfText></View> : null}
        {token.reason ? <View style={ts.row}><PdfText style={ts.lbl}>Reason</PdfText><PdfText style={ts.val}>{token.reason}</PdfText></View> : null}
        <PdfText style={ts.stars}>{POS_RECEIPT.starLine}</PdfText>
        <PdfText style={ts.footer}>Please wait for your token to be called.{`\n`}{POS_RECEIPT.thankYou}</PdfText>
        <PdfText style={ts.brand}>{POS_RECEIPT.poweredBy}</PdfText>
      </Page>
    </Document>
  );
}

export function PrescriptionDialog({ token, onClose }: { token: Token; onClose: () => void }): React.JSX.Element {
  const styles = useDialogStyles();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = useLicense();
  const showLab = can('labDashboard');
  const canOrderLab = showLab && user?.role !== 'receptionist';
  const emptyMed = (): PrescriptionMedicine => ({ name: '', dosage: '', duration: '', instructions: '' });
  const [diagnosis, setDiagnosis] = useState(token.prescription?.diagnosis ?? '');
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(
    token.prescription?.medicines.length ? token.prescription.medicines : [emptyMed()],
  );
  const [tests, setTests] = useState<string[]>(token.prescription?.tests ?? []);
  const [testInput, setTestInput] = useState('');
  const [advice, setAdvice] = useState(token.prescription?.advice ?? '');
  const [labTest, setLabTest] = useState('');

  const { data: labOrders = [], refetch: refetchLabOrders } = useQuery<import('@/types/lab').LabOrder[]>({
    queryKey: ['lab-orders-token', token.id],
    queryFn: () => window.clinic.lab.listByToken(token.id),
    enabled: showLab,
  });

  const createLabOrderMutation = useMutation({
    mutationFn: (test: string) =>
      window.clinic.lab.create({ patientId: token.patientId, orderedById: token.doctorId, tokenId: token.id, test }),
    onSuccess: () => { void refetchLabOrders(); setLabTest(''); },
    meta: { toast: 'Lab order created' },
  });

  const mutation = useMutation({
    mutationFn: () => window.clinic.tokens.upsertPrescription(token.id, { diagnosis, medicines, tests, advice } as PrescriptionInput),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['tokens'] }); onClose(); },
    meta: { silent: true },
  });

  const updateMed = (i: number, field: keyof PrescriptionMedicine, val: string) =>
    setMedicines((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface className={styles.surfaceMd}>
        <FormDialogTitle
          title={`Prescription — Token #${String(token.tokenNumber).padStart(3, '0')}`}
          subtitle={`${token.patient.firstName} ${token.patient.lastName} · Dr. ${token.doctor.firstName} ${token.doctor.lastName}`}
        />
        <DialogBody>
          <DialogContent className={styles.body}>
            <div className={styles.fields}>
              <Field label="Diagnosis">
                <Input value={diagnosis} onChange={(_, d) => setDiagnosis(d.value)} />
              </Field>

              <div>
                <Text weight="bold" size={300} style={{ display: 'block', marginBottom: 8 }}>Medicines</Text>
                <div className={styles.fields}>
                  {medicines.map((m, i) => (
                    <div key={i} className={styles.medGrid}>
                      <MedicineAutocomplete value={m.name} onChange={(name) => updateMed(i, 'name', name)} size="small" />
                      <Field label="Dosage"><Input value={m.dosage} onChange={(_, d) => updateMed(i, 'dosage', d.value)} /></Field>
                      <Field label="Duration"><Input value={m.duration} onChange={(_, d) => updateMed(i, 'duration', d.value)} /></Field>
                      <Field label="Instructions"><Input value={m.instructions} onChange={(_, d) => updateMed(i, 'instructions', d.value)} /></Field>
                      <Button
                        appearance="subtle"
                        icon={<DeleteOutlineIcon style={{ fontSize: 18 }} />}
                        disabled={medicines.length === 1}
                        onClick={() => setMedicines((p) => p.filter((_, idx) => idx !== i))}
                        aria-label="Remove medicine"
                      />
                    </div>
                  ))}
                  <Button appearance="subtle" icon={<AddOutlinedIcon />} onClick={() => setMedicines((p) => [...p, emptyMed()])} style={{ alignSelf: 'flex-start' }}>
                    Add Medicine
                  </Button>
                </div>
              </div>

              {showLab && (
                <div>
                  <Text weight="bold" size={300} style={{ display: 'block', marginBottom: 8 }}>Lab Orders</Text>
                  {canOrderLab && (
                    <div className={styles.row} style={{ marginBottom: 8 }}>
                      <Field label="Test name" style={{ flex: 1 }}>
                        <Input
                          value={labTest}
                          onChange={(_, d) => setLabTest(d.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && labTest.trim()) createLabOrderMutation.mutate(labTest.trim()); }}
                        />
                      </Field>
                      <Button
                        appearance="outline"
                        size="small"
                        disabled={!labTest.trim() || createLabOrderMutation.isPending}
                        icon={createLabOrderMutation.isPending ? <Spinner size="tiny" /> : undefined}
                        onClick={() => createLabOrderMutation.mutate(labTest.trim())}
                      >
                        Order
                      </Button>
                    </div>
                  )}
                  {labOrders.length > 0 && (
                    <div className={styles.fields}>
                      {labOrders.map((o) => (
                        <div key={o.id} className={styles.row}>
                          <Badge
                            appearance="outline"
                            color={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'warning'}
                            size="small"
                          >
                            {o.test}
                          </Badge>
                          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{o.status.replace('_', ' ')}</Text>
                          {o.result && (
                            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>— {labResultPreview(o.result)}</Text>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Text weight="bold" size={300} style={{ display: 'block', marginBottom: 8 }}>Notes / Tests (text)</Text>
                <div className={styles.chipRow}>
                  {tests.map((t, i) => (
                    <Badge
                      key={i}
                      appearance="tint"
                      color="informative"
                      size="small"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTests((p) => p.filter((_, idx) => idx !== i))}
                    >
                      {t} ×
                    </Badge>
                  ))}
                </div>
                <div className={styles.row}>
                  <Field label="Add note">
                    <Input
                      value={testInput}
                      onChange={(_, d) => setTestInput(d.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && testInput.trim()) {
                          setTests((p) => [...p, testInput.trim()]);
                          setTestInput('');
                        }
                      }}
                    />
                  </Field>
                  <Button
                    size="small"
                    onClick={() => {
                      if (testInput.trim()) {
                        setTests((p) => [...p, testInput.trim()]);
                        setTestInput('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <Field label="Advice / Notes">
                <Textarea value={advice} onChange={(_, d) => setAdvice(d.value)} rows={2} />
              </Field>
            </div>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <SubmitButton loading={mutation.isPending} onClick={() => mutation.mutate()}>Save Prescription</SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}

export function TokenPrintPreview({
  token,
  onClose,
  autoPrint = false,
}: {
  token: Token;
  onClose: () => void;
  autoPrint?: boolean;
}): React.JSX.Element {
  const styles = useDialogStyles();
  const brandLogo = useClinicBrandLogo();
  const [clinic, setClinic] = useState<{ clinicName: string; clinicAddress: string; clinicPhone: string } | null>(null);
  const [freshToken, setFreshToken] = useState<Token>(token);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const autoPrintDone = useRef(false);

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setClinic({
      clinicName: s.clinicName ?? '',
      clinicAddress: s.clinicAddress ?? '',
      clinicPhone: s.clinicPhone ?? '',
    }));
    void window.clinic?.tokens?.getById?.(token.id).then((fresh) => {
      if (fresh) setFreshToken(fresh as Token);
    });
  }, [token.id]);

  const documentKey = [
    freshToken.id,
    freshToken.tokenNumber,
    clinic?.clinicName ?? '',
    clinic?.clinicAddress ?? '',
    clinic?.clinicPhone ?? '',
    brandLogo,
  ].join('|');

  const pdfDocument = useMemo(() => {
    if (!clinic) return null;
    return <TokenSlipDocument token={freshToken} logoSrc={brandLogo} {...clinic} />;
  }, [clinic, freshToken, brandLogo]);

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printTokenSlip(freshToken, { silent: true });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    if (!autoPrint || autoPrintDone.current) return;
    autoPrintDone.current = true;
    void handlePrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface className={styles.previewSurface}>
        <div className={styles.previewHead}>
          <Text weight="bold" size={400}>Token Slip PDF</Text>
          <Tooltip content="Close" relationship="label">
            <Button appearance="subtle" size="small" icon={<CloseOutlinedIcon style={{ fontSize: 18 }} />} onClick={onClose} aria-label="Close" />
          </Tooltip>
        </div>
        <div className={styles.previewBody}>
          {pdfDocument ? (
            <PdfBlobPreview documentKey={documentKey} pdfDocument={pdfDocument} height={560} />
          ) : (
            <div className={styles.loadingBox}>
              <Text style={{ color: tokens.colorNeutralForeground2 }}>Loading...</Text>
            </div>
          )}
        </div>
        <div className={styles.previewFoot}>
          {printError && (
            <MessageBar intent="error"><MessageBarBody>{printError}</MessageBarBody></MessageBar>
          )}
          <div className={styles.previewActions}>
            <Tooltip content="Close" relationship="label">
              <Button appearance="subtle" size="small" icon={<CloseOutlinedIcon style={{ fontSize: 18 }} />} onClick={onClose} aria-label="Close" />
            </Tooltip>
            <Tooltip content={printing ? 'Printing...' : 'Print'} relationship="label">
              <Button
                appearance="primary"
                size="small"
                disabled={printing || !pdfDocument}
                icon={printing ? <Spinner size="tiny" /> : <PrintOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => void handlePrint()}
                aria-label="Print"
              />
            </Tooltip>
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  );
}

function DoctorFilterTabs({
  doctors,
  value,
  onChange,
}: {
  doctors: TokenPerson[];
  value: string;
  onChange: (id: string) => void;
}): React.JSX.Element {
  const styles = usePageStyles();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<'left' | 'right' | null>(null);

  const updateOverflow = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      setCanLeft(false);
      setCanRight(false);
      return;
    }
    const { scrollLeft, clientWidth, scrollWidth } = scroller;
    setCanLeft(scrollLeft > 2);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateOverflow();
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    scroller.addEventListener('scroll', updateOverflow, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateOverflow()) : null;
    ro?.observe(scroller);
    window.addEventListener('resize', updateOverflow);
    return () => {
      scroller.removeEventListener('scroll', updateOverflow);
      ro?.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [doctors.length, updateOverflow]);

  function scrollByDir(dir: -1 | 1): void {
    scrollerRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!canLeft && !canRight) {
      setHoverEdge(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = 56;
    if (canLeft && x <= zone) setHoverEdge('left');
    else if (canRight && x >= rect.width - zone) setHoverEdge('right');
    else setHoverEdge(null);
  }

  const showLeft = canLeft && hoverEdge === 'left';
  const showRight = canRight && hoverEdge === 'right';

  return (
    <div className={styles.tabsWrap} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverEdge(null)}>
      <div ref={scrollerRef} className={styles.tabsScroller} style={{ scrollbarWidth: 'none' }}>
        <TabList
          selectedValue={value}
          onTabSelect={(_, data) => onChange(String(data.value))}
          size="small"
        >
          <Tab value="ALL">All Doctors</Tab>
          {doctors.map((d) => (
            <Tab key={d.id} value={d.id}>{`Dr. ${d.firstName} ${d.lastName}`}</Tab>
          ))}
        </TabList>
      </div>
      <Button
        appearance="subtle"
        size="small"
        aria-label="Scroll doctors left"
        icon={<ChevronLeftIcon style={{ fontSize: 18 }} />}
        onClick={() => scrollByDir(-1)}
        className={styles.scrollBtn}
        style={{ left: 4, opacity: showLeft ? 1 : 0, pointerEvents: showLeft ? 'auto' : 'none' }}
      />
      <Button
        appearance="subtle"
        size="small"
        aria-label="Scroll doctors right"
        icon={<ChevronRightIcon style={{ fontSize: 18 }} />}
        onClick={() => scrollByDir(1)}
        className={styles.scrollBtn}
        style={{ right: 4, opacity: showRight ? 1 : 0, pointerEvents: showRight ? 'auto' : 'none' }}
      />
    </div>
  );
}

export function TokensPage(): React.JSX.Element {
  const styles = usePageStyles();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const [date, setDate] = useState(todayStr());
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printToken, setPrintToken] = useState<Token | null>(null);
  const [deleteToken, setDeleteToken] = useState<Token | null>(null);
  const [refundToken, setRefundToken] = useState<Token | null>(null);

  const { data: tokensList = [], isLoading, isFetching, isError } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
    refetchInterval: 10_000,
  });

  const { data: doctors = [] } = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TokenStatus }) =>
      window.clinic.tokens.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
    meta: { silent: true },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.tokens.delete(id),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      setDeleteToken(null);
    },
    meta: { silent: true },
  });

  const roleFiltered = isDoctor ? tokensList.filter((t) => t.doctorId === user?.id) : tokensList;
  const filtered = filterDoctor === 'ALL' ? roleFiltered : roleFiltered.filter((t) => t.doctorId === filterDoctor);

  const waiting = tokensList.filter((t) => t.status === 'WAITING').length;
  const done = tokensList.filter((t) => t.status === 'DONE').length;
  const skipped = tokensList.filter((t) => t.status === 'SKIPPED').length;
  const currentToken = filtered.find((t) => t.status === 'WAITING');

  const summaryCards = [
    { label: 'Total Tokens', value: tokensList.length, icon: <ConfirmationNumberOutlinedIcon />, bg: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1 },
    { label: 'Waiting', value: waiting, icon: <HourglassEmptyOutlinedIcon />, bg: tokens.colorPaletteYellowBackground2, color: tokens.colorPaletteYellowForeground2 },
    { label: 'Completed', value: done, icon: <DoneAllOutlinedIcon />, bg: tokens.colorPaletteGreenBackground2, color: tokens.colorPaletteGreenForeground2 },
    { label: 'Skipped', value: skipped, icon: <SkipNextOutlinedIcon />, bg: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground2 },
  ];

  const layoutCols = currentToken ? 'minmax(0, 1fr) 300px' : '1fr';

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <Text className={styles.subtitle} size={300}>Live OPD queue</Text>
            <Title2 className={styles.title}>Token Queue</Title2>
            <Text size={300} style={{ color: tokens.colorNeutralForeground2, marginTop: 4, display: 'block' }}>
              Issue, track, and complete patient tokens for the day.
            </Text>
          </div>
          <div className={styles.headerActions}>
            <FluentDateField
              label="Date"
              value={parseDateIso(date)}
              onSelectDate={(d) => setDate(formatDateIso(d) || todayStr())}
            />
            {!isAdmin && (
              <Button appearance="primary" icon={<AddOutlinedIcon />} onClick={() => setDialogOpen(true)}>
                Issue Token
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <StatCardsSkeleton count={4} />
        ) : (
          <div className={styles.metrics}>
            {summaryCards.map((c) => (
              <div key={c.label} className={styles.metricCard} style={{ backgroundColor: c.bg }}>
                <div className={styles.metricRow}>
                  <div>
                    <Text style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</Text>
                    <Text size={200} weight="bold" style={{ color: tokens.colorNeutralForeground2, marginTop: 6, display: 'block' }}>
                      {c.label}
                    </Text>
                  </div>
                  <div className={styles.metricIcon} style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: c.color }}>
                    {c.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.layout} style={{ gridTemplateColumns: layoutCols }}>
          <div className={styles.col}>
            {!isDoctor && (
              <div className={styles.doctorBar}>
                <Text className={styles.doctorLabel}>Doctor</Text>
                <DoctorFilterTabs doctors={doctors} value={filterDoctor} onChange={setFilterDoctor} />
              </div>
            )}

            {isError && (
              <MessageBar intent="error"><MessageBarBody>Failed to load tokens.</MessageBarBody></MessageBar>
            )}

            <div className={styles.softCard}>
              <FetchingBar show={isFetching && !isLoading} />
              <div className={styles.queueHead}>
                <div>
                  <Text weight="bold" size={400}>Queue</Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground2, display: 'block' }}>
                    {new Date(date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    {' · '}
                    {filtered.length} token{filtered.length === 1 ? '' : 's'}
                  </Text>
                </div>
              </div>

              {isLoading && filtered.length === 0 ? (
                <ListCardsSkeleton count={6} />
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>
                    <ConfirmationNumberOutlinedIcon style={{ fontSize: 30 }} />
                  </div>
                  <Text weight="bold" style={{ display: 'block', marginBottom: 4 }}>No tokens yet</Text>
                  <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                    No tokens for this date{!isAdmin ? ' — issue one to start the queue.' : '.'}
                  </Text>
                  {!isAdmin && (
                    <Button appearance="primary" icon={<AddOutlinedIcon />} style={{ marginTop: 16 }} onClick={() => setDialogOpen(true)}>
                      Issue Token
                    </Button>
                  )}
                </div>
              ) : (
                <div className={styles.queueList}>
                  {filtered.map((token) => {
                    const cfg = statusConfig[token.status];
                    const isDone = token.status === 'DONE' || token.status === 'SKIPPED';
                    const isCurrent = currentToken?.id === token.id;
                    const leftColor =
                      token.status === 'WAITING'
                        ? tokens.colorPaletteYellowBorderActive
                        : token.status === 'DONE'
                          ? tokens.colorPaletteGreenBorderActive
                          : tokens.colorNeutralStroke2;
                    return (
                      <div
                        key={token.id}
                        className={styles.tokenRow}
                        style={{
                          opacity: isDone ? 0.62 : 1,
                          backgroundColor: isCurrent ? tokens.colorBrandBackground2 : tokens.colorNeutralBackground2,
                          borderLeftColor: leftColor,
                          borderColor: isCurrent ? tokens.colorBrandStroke1 : tokens.colorNeutralStroke2,
                        }}
                      >
                        <Avatar
                          name={`${token.patient.firstName} ${token.patient.lastName}`}
                          initials={String(token.tokenNumber).padStart(3, '0')}
                          color="brand"
                          style={{ borderRadius: 8, width: 44, height: 44, fontWeight: 900, fontSize: 14 }}
                        />
                        <div className={styles.tokenBody}>
                          <div className={styles.row}>
                            <Text weight="bold" size={300} truncate>
                              {token.patient.firstName} {token.patient.lastName}
                            </Text>
                            {isCurrent && <Badge appearance="filled" color="brand" size="small">Now</Badge>}
                          </div>
                          <Text size={200} truncate style={{ color: tokens.colorNeutralForeground2, display: 'block' }}>
                            Dr. {token.doctor.firstName} {token.doctor.lastName}
                            {Number(token.consultationFee ?? 0) > 0
                              ? ` · Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded))}${Number(token.feeDiscount ?? 0) > 0 ? ' after discount' : ''}${Number(token.feeRefunded ?? 0) > 0 ? ' refunded' : ''}`
                              : ''}
                            {token.reason ? ` · ${token.reason}` : ''}
                            {token.notes ? ` · ${token.notes}` : ''}
                          </Text>
                        </div>
                        <StatusBadge color={cfg.color}>{cfg.label}</StatusBadge>
                        <div className={styles.tokenActions}>
                          <Tooltip content="Print Token" relationship="label">
                            <Button appearance="subtle" size="small" icon={<PrintOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => setPrintToken(token)} />
                          </Tooltip>
                          {!isAdmin && tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded) > 0 && (
                            <Tooltip content="Refund consultation fee" relationship="label">
                              <Button appearance="subtle" size="small" icon={<UndoOutlinedIcon style={{ fontSize: 18 }} />} onClick={() => setRefundToken(token)} />
                            </Tooltip>
                          )}
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip content="Mark Done" relationship="label">
                              <Button
                                appearance="subtle"
                                size="small"
                                disabled={statusMutation.isPending}
                                icon={<CheckCircleOutlinedIcon style={{ fontSize: 18 }} />}
                                onClick={() => statusMutation.mutate({ id: token.id, status: 'DONE' })}
                              />
                            </Tooltip>
                          )}
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip content="Skip" relationship="label">
                              <Button
                                appearance="subtle"
                                size="small"
                                disabled={statusMutation.isPending}
                                icon={<SkipNextOutlinedIcon style={{ fontSize: 18 }} />}
                                onClick={() => statusMutation.mutate({ id: token.id, status: 'SKIPPED' })}
                              />
                            </Tooltip>
                          )}
                          {!isAdmin && token.status === 'WAITING' && (
                            <Tooltip content="Delete" relationship="label">
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<DeleteOutlineIcon style={{ fontSize: 18 }} />}
                                onClick={() => setDeleteToken(token)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {currentToken && (
            <div className={styles.col}>
              <div className={styles.nowCard}>
                <div className={styles.nowOrb1} />
                <div className={styles.nowOrb2} />
                <Text size={200} weight="bold" style={{ opacity: 0.8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Now Serving
                </Text>
                <Text style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, marginTop: 8, letterSpacing: '-0.03em', display: 'block' }}>
                  {String(currentToken.tokenNumber).padStart(3, '0')}
                </Text>
                <Text weight="bold" size={500} style={{ display: 'block', marginTop: 12 }}>
                  {currentToken.patient.firstName} {currentToken.patient.lastName}
                </Text>
                <Text size={300} style={{ opacity: 0.88, display: 'block', marginTop: 4 }}>
                  Dr. {currentToken.doctor.firstName} {currentToken.doctor.lastName}
                </Text>
                {(currentToken.reason || currentToken.notes) && (
                  <Text size={200} style={{ opacity: 0.75, display: 'block', marginTop: 8 }}>
                    {[currentToken.reason, currentToken.notes].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <div className={styles.row} style={{ marginTop: 20, gap: 8 }}>
                  <Badge appearance="outline" size="small" style={{ fontWeight: 800, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
                    {statusConfig[currentToken.status].label}
                  </Badge>
                  <Tooltip content="Print Token" relationship="label">
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<PrintOutlinedIcon style={{ fontSize: 18 }} />}
                      onClick={() => setPrintToken(currentToken)}
                      style={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.12)' }}
                    />
                  </Tooltip>
                </div>
                {!isAdmin && (
                  <div className={styles.nowActions}>
                    <Button
                      appearance="primary"
                      icon={statusMutation.isPending ? <Spinner size="tiny" /> : <CheckCircleOutlinedIcon />}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: currentToken.id, status: 'DONE' })}
                      style={{ flex: 1, backgroundColor: '#fff', color: tokens.colorBrandForeground1, fontWeight: 800 }}
                    >
                      Done
                    </Button>
                    <Button
                      appearance="outline"
                      icon={statusMutation.isPending ? <Spinner size="tiny" /> : <SkipNextOutlinedIcon />}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: currentToken.id, status: 'SKIPPED' })}
                      style={{ flex: 1, borderColor: 'rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700 }}
                    >
                      Skip
                    </Button>
                  </div>
                )}
              </div>

              <div className={styles.softCard}>
                <Text weight="bold" size={300} style={{ display: 'block', marginBottom: 10 }}>Queue snapshot</Text>
                <div className={styles.snapshot}>
                  {[
                    { label: 'Waiting ahead', value: Math.max(0, waiting - (currentToken ? 1 : 0)) },
                    { label: 'Done today', value: done },
                    { label: 'Skipped', value: skipped },
                  ].map((row) => (
                    <div key={row.label} className={styles.snapshotRow}>
                      <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>{row.label}</Text>
                      <Text weight="bold" size={300} style={{ color: tokens.colorBrandForeground1 }}>{row.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <IssueTokenDialog open={dialogOpen} onClose={() => setDialogOpen(false)} date={date} />
      {printToken && <TokenPrintPreview token={printToken} onClose={() => setPrintToken(null)} />}
      {refundToken && <FeeRefundDialog token={refundToken} onClose={() => setRefundToken(null)} />}
      <ConfirmDialog
        open={Boolean(deleteToken)}
        title="Delete token?"
        message={deleteToken ? `Delete token #${String(deleteToken.tokenNumber).padStart(3, '0')} for ${deleteToken.patient.firstName} ${deleteToken.patient.lastName}?` : ''}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteToken(null)}
        onConfirm={() => deleteToken && deleteMutation.mutate(deleteToken.id)}
      />
    </>
  );
}
