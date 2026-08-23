import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { FluentDateField, formatDateIso, parseDateIso } from '@/components/FluentDateField';
import { doctorsService } from '@/services/doctors.service';
import { patientsService } from '@/services/patients.service';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import { showAppToast } from '@/components/AppToast';
import type { Doctor } from '@/types/doctor';
import type { Patient } from '@/types/patient';
import { CampaignOutlinedIcon, ImageOutlinedIcon } from '@/icons/fluent';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatVisitDate(date: string): string {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildVisitMessage(doctorName: string, date: string, clinicName: string): string {
  const when = formatVisitDate(date);
  const visit = doctorName && when
    ? `Dr. ${doctorName} has a clinic visit on ${when}.`
    : doctorName
      ? `Dr. ${doctorName} has a clinic visit.`
      : when
        ? `Clinic visit on ${when}.`
        : 'Clinic visit details.';
  const clinic = clinicName.trim() ? `\n${clinicName.trim()}` : '';
  return `Hello,\n\n${visit}${clinic}\n\nThank you.`;
}

async function listAllPatients(): Promise<Patient[]> {
  const all: Patient[] = [];
  let page = 1;
  const pageSize = 100;
  while (page <= 50) {
    const res = (await patientsService.list({ page, pageSize, search: '' })) as {
      data: Patient[];
      total: number;
    };
    all.push(...(res.data ?? []));
    if (all.length >= (res.total ?? 0) || !(res.data?.length)) break;
    page += 1;
  }
  return all;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
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
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  preview: {
    width: '100%',
    maxHeight: '180px',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  meta: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
});

export function WhatsAppCampaignDialog({
  open,
  onClose,
  clinicName,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  clinicName: string;
  enabled: boolean;
}): React.JSX.Element {
  const styles = useStyles();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [text, setText] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageMime, setImageMime] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [phones, setPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTextRef = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doctorName = useMemo(() => {
    const d = doctors.find((x) => x.id === doctorId);
    return d ? `${d.firstName} ${d.lastName}`.trim() : '';
  }, [doctors, doctorId]);

  const selectedDoctorLabel = doctorId
    ? `Dr. ${doctorName}`
    : '— Select doctor —';

  useEffect(() => {
    if (!open) return;
    setDoctorId('');
    setDate(todayStr());
    setText('');
    setImageName('');
    setImageMime('');
    setImageBase64('');
    setImagePreview('');
    setResult(null);
    setError(null);
    autoTextRef.current = '';
    setLoading(true);
    void Promise.all([
      doctorsService.list({ page: 1, pageSize: 100, search: '' }) as Promise<{ data: Doctor[] }>,
      listAllPatients(),
    ])
      .then(([docRes, patients]) => {
        setDoctors(docRes.data ?? []);
        const unique = [...new Set(
          patients.map((p) => toWhatsAppNumber(p.phone)).filter((p): p is string => Boolean(p)),
        )];
        setPhones(unique);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load campaign data.');
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const next = buildVisitMessage(doctorName, date, clinicName);
    if (!text || text === autoTextRef.current) {
      setText(next);
    }
    autoTextRef.current = next;
    // Only rewrite the draft when doctor/date change and user has not customized it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorName, date, clinicName, open]);

  function clearImage(): void {
    setImageName('');
    setImageMime('');
    setImageBase64('');
    setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onPickImage(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(',')[1] || '';
    if (!base64) {
      setError('Could not read image.');
      return;
    }
    setImageBase64(base64);
    setImageMime(file.type || 'image/jpeg');
    setImageName(file.name);
    setImagePreview(dataUrl);
    setError(null);
  }

  async function handleSend(): Promise<void> {
    if (!enabled) {
      setError('Enable WhatsApp in Settings first.');
      return;
    }
    if (!text.trim()) {
      setError('Write campaign text.');
      return;
    }
    if (phones.length === 0) {
      setError('No patients with WhatsApp numbers yet.');
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.clinic.whatsapp.campaign({
        text: text.trim(),
        phones,
        ...(imageBase64
          ? { imageBase64, imageMime, imageName }
          : {}),
      });
      setResult({ sent: res.sent, failed: res.failed, errors: res.errors ?? [] });
      showAppToast({
        type: res.failed ? 'error' : 'success',
        message: res.failed ? `Campaign sent with ${res.failed} failed` : 'Campaign sent',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Campaign failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open && !sending) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title="WhatsApp campaign"
          subtitle="Doctor visit message — all patients with a WhatsApp number."
        />
        <DialogBody>
          <DialogContent className={styles.body}>
            <div className={styles.fields}>
              {!enabled && (
                <MessageBar intent="warning">
                  <MessageBarBody>Enable WhatsApp and save settings before sending.</MessageBarBody>
                </MessageBar>
              )}
              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              {result && (
                <MessageBar intent={result.failed ? 'warning' : 'success'}>
                  <MessageBarBody>
                    Sent {result.sent}, failed {result.failed}.
                    {result.errors.length > 0 ? ` ${result.errors[0]}` : ''}
                  </MessageBarBody>
                </MessageBar>
              )}
              <Field label="Doctor">
                <Dropdown
                  placeholder="— Select doctor —"
                  value={selectedDoctorLabel}
                  selectedOptions={doctorId ? [doctorId] : ['']}
                  disabled={loading || sending}
                  onOptionSelect={(_, data) => setDoctorId(data.optionValue ?? '')}
                >
                  <Option value="" text="— Select doctor —">— Select doctor —</Option>
                  {doctors.map((d) => (
                    <Option key={d.id} value={d.id} text={`Dr. ${d.firstName} ${d.lastName}`}>
                      Dr. {d.firstName} {d.lastName}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <FluentDateField
                label="Visit date"
                value={parseDateIso(date)}
                onSelectDate={(d) => setDate(formatDateIso(d) || todayStr())}
                disabled={loading || sending}
              />
              <Field label="Message">
                <Textarea
                  rows={5}
                  value={text}
                  onChange={(_, d) => setText(d.value)}
                  disabled={loading || sending}
                />
              </Field>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => void onPickImage(e.target.files?.[0])}
              />
              <div className={styles.row}>
                <Button
                  appearance="outline"
                  icon={<ImageOutlinedIcon />}
                  disabled={loading || sending}
                  onClick={() => fileRef.current?.click()}
                >
                  {imageName || 'Add image'}
                </Button>
                {imageName && (
                  <Button appearance="subtle" size="small" onClick={clearImage} disabled={sending}>
                    Remove
                  </Button>
                )}
              </div>
              {imagePreview && (
                <img className={styles.preview} src={imagePreview} alt="Campaign" />
              )}
              <Text className={styles.meta}>
                Recipients: {loading ? '…' : phones.length} patients with WhatsApp numbers
              </Text>
            </div>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={sending}>
            Close
          </Button>
          <SubmitButton
            loading={sending}
            disabled={!enabled || loading || !text.trim() || phones.length === 0}
            onClick={() => void handleSend()}
            icon={<CampaignOutlinedIcon />}
          >
            Send campaign
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
