import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Button,
  Dialog,
  DialogSurface,
  Input,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import type { Token } from '@/types/token';
import type { Patient } from '@/types/patient';
import {
  PAD_BLUE,
  PAD_INK,
  PAD_LINE,
  PrescriptionPadPdfPreview,
  parsePadMeta,
  stripAdviceHtml,
  doctorPadLines,
  type PrescriptionPadClinic,
} from './PrescriptionPadPdf';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import { AutoAwesomeOutlinedIcon, CloseOutlinedIcon, FormatBoldIcon, FormatListBulletedIcon, FormatListNumberedIcon, LocalPhoneOutlinedIcon, PlaceOutlinedIcon, PrintOutlinedIcon, RedoIcon, SaveOutlinedIcon, UndoIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  surface: {
    maxWidth: '900px',
    width: '100%',
    maxHeight: '94vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: '#eef3f8',
  },
  toolbarBar: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
    gap: tokens.spacingHorizontalS,
  },
  toolbarActions: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  hintOk: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  hintInfo: {
    color: tokens.colorPaletteBlueForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  hintError: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  scroll: {
    overflow: 'auto',
    padding: tokens.spacingVerticalL,
    flex: '1 1 auto',
    minHeight: 0,
  },
  page: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    maxWidth: '794px',
    minHeight: '1120px',
    backgroundColor: '#ffffff',
    color: PAD_INK,
    boxShadow: '0 12px 40px rgba(30,58,95,0.12)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    paddingLeft: '40px',
    paddingRight: '40px',
    paddingTop: '36px',
    paddingBottom: '16px',
  },
  doctorName: {
    fontWeight: 800,
    color: `${PAD_BLUE} !important`,
    fontSize: '26px',
    lineHeight: 1.15,
  },
  doctorMeta: {
    marginTop: '4px',
    color: `${PAD_BLUE} !important`,
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.35,
  },
  logo: {
    width: '56px',
    height: '56px',
    objectFit: 'contain',
    display: 'block',
    paddingTop: '4px',
  },
  fields: {
    position: 'relative',
    zIndex: 1,
    paddingLeft: '40px',
    paddingRight: '40px',
    paddingTop: '8px',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: '12px',
  },
  fieldRowSplit: {
    display: 'flex',
    flexDirection: 'row',
    gap: '24px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: '140px',
  },
  label: {
    fontWeight: 700,
    color: `${PAD_BLUE} !important`,
    fontSize: '13px',
    flexShrink: 0,
    minWidth: '108px',
  },
  labelSm: {
    fontWeight: 700,
    color: `${PAD_BLUE} !important`,
    fontSize: '13px',
    flexShrink: 0,
    minWidth: '40px',
  },
  underlineInput: {
    flex: 1,
    minWidth: 0,
  },
  formatBar: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
    paddingLeft: '40px',
    paddingRight: '40px',
    paddingTop: '8px',
  },
  rxBody: {
    position: 'relative',
    flex: 1,
    paddingLeft: '40px',
    paddingRight: '40px',
    paddingTop: '8px',
    paddingBottom: '16px',
    minHeight: '380px',
  },
  watermark: {
    position: 'absolute',
    top: '12%',
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    opacity: 0.1,
    zIndex: 0,
    width: '200px',
    height: '200px',
    objectFit: 'contain',
  },
  rxTitle: {
    position: 'relative',
    zIndex: 1,
    fontWeight: 800,
    color: `${PAD_BLUE} !important`,
    fontSize: '34px',
    marginBottom: '8px',
    lineHeight: 1,
  },
  editorWrap: {
    position: 'relative',
    zIndex: 1,
  },
  signature: {
    position: 'relative',
    zIndex: 1,
    marginTop: '32px',
    marginLeft: 'auto',
    width: '180px',
    textAlign: 'center',
  },
  signatureLine: {
    borderBottom: `1px solid ${PAD_LINE}`,
    marginBottom: '6px',
  },
  signatureLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: `${PAD_BLUE} !important`,
    letterSpacing: '2px',
  },
  footer: {
    position: 'relative',
    marginTop: 'auto',
    paddingLeft: '40px',
    paddingRight: '40px',
    paddingTop: '18px',
    paddingBottom: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    backgroundColor: '#ffffff',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '40px',
      right: '40px',
      height: '2px',
      backgroundImage: 'linear-gradient(to right, #5EC8D8, #3A6A8C, #1A2332)',
    },
  },
  brand: {
    fontWeight: 500,
    color: '#5A6570 !important',
    fontSize: '12px',
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  footerMeta: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  footerPhone: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  footerText: {
    fontSize: '11px',
    color: '#5A6570 !important',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  savePdf: {
    backgroundColor: PAD_BLUE,
  },
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrescriptionThumbHtml(opts: {
  clinicName: string;
  patientName: string;
  diagnosis: string;
  adviceHtml: string;
  dateStr: string;
}): string {
  const adviceText = stripAdviceHtml(opts.adviceHtml)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => `<div class="line">${escapeHtml(line)}</div>`)
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 280px; height: 360px; overflow: hidden; background: #fff; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #0f172a;
    padding: 14px 12px;
    border: 1px solid #cbd5e1;
  }
  .brand { font-size: 12px; font-weight: 800; color: #0f766e; letter-spacing: 0.02em; }
  .meta { margin-top: 6px; font-size: 10px; color: #64748b; }
  .name { margin-top: 10px; font-size: 13px; font-weight: 700; }
  .dx { margin-top: 4px; font-size: 11px; color: #334155; }
  .rx {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #94a3b8;
    font-size: 11px;
    line-height: 1.35;
  }
  .rx .label { font-size: 10px; font-weight: 700; color: #0f766e; margin-bottom: 4px; }
  .line { margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body>
  <div class="brand">${escapeHtml(opts.clinicName || 'CareFlow')}</div>
  <div class="meta">${escapeHtml(opts.dateStr)} · Prescription</div>
  <div class="name">${escapeHtml(opts.patientName || 'Patient')}</div>
  ${opts.diagnosis ? `<div class="dx">Dx: ${escapeHtml(opts.diagnosis)}</div>` : ''}
  <div class="rx">
    <div class="label">Rx / Advice</div>
    ${adviceText || '<div class="line">—</div>'}
  </div>
</body></html>`;
}

function calcAge(dob: Date | string | null | undefined): string {
  if (!dob) return '';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

function plainTextToHtml(text: string): string {
  if (!text?.trim()) return '<p></p>';
  if (/<(?:p|ul|ol|li|strong|b|br)\b/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

interface PrescriptionPadDialogProps {
  token: Token;
  onClose: () => void;
}

export function PrescriptionPadDialog({ token, onClose }: PrescriptionPadDialogProps): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const brandLogo = useClinicBrandLogo();
  const [clinic, setClinic] = useState<PrescriptionPadClinic>({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
  });
  const [patientName, setPatientName] = useState(
    `${token.patient.firstName} ${token.patient.lastName}`.trim(),
  );
  const [patientAddress, setPatientAddress] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);
  const [bodyTextForPdf, setBodyTextForPdf] = useState('');

  const initialHtml = useMemo(() => {
    const parsed = parsePadMeta(token.prescription?.advice ?? '');
    return plainTextToHtml(parsed.body);
  }, [token.prescription?.advice]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    immediatelyRender: false,
  });

  useEffect(() => {
    void window.clinic?.settings?.get().then((settings) => {
      if (!settings) return;
      setClinic({
        clinicName: settings.clinicName ?? '',
        clinicAddress: settings.clinicAddress ?? '',
        clinicPhone: settings.clinicPhone ?? '',
      });
    });
  }, []);

  useEffect(() => {
    const doctorId = token.doctorId;
    if (!doctorId) return;
    void window.clinic.doctors
      .getOne(doctorId)
      .then((doctor) => {
        const lines = doctorPadLines(doctor?.doctorProfile);
        setQualification(lines.qualification);
        setSpecialization(lines.specialization);
      })
      .catch(() => undefined);
  }, [token.doctorId]);

  useEffect(() => {
    const parsed = parsePadMeta(token.prescription?.advice ?? '');
    if (parsed.sex) setPatientSex(parsed.sex);
    if (parsed.age) setPatientAge(parsed.age);
    if (parsed.dob) setPatientDob(parsed.dob);
    if (parsed.address) setPatientAddress(parsed.address);
    if (parsed.diagnosis) setDiagnosis(parsed.diagnosis);
  }, [token.prescription?.advice]);

  useEffect(() => {
    void window.clinic.patients
      .list({ page: 1, pageSize: 50, search: token.patient.mrNumber || token.patient.firstName })
      .then((res) => {
        const match = res.data.find((p: Patient) => p.id === token.patientId);
        if (!match) return;
        if (match.address) {
          setPatientAddress((prev) => prev || match.address || '');
        }
        if (match.dateOfBirth) {
          setPatientDob((prev) => {
            if (prev) return prev;
            const iso = new Date(match.dateOfBirth!).toISOString().slice(0, 10);
            setPatientAge((agePrev) => agePrev || calcAge(match.dateOfBirth));
            return iso;
          });
        }
      })
      .catch(() => undefined);
  }, [token.patientId, token.patient.mrNumber, token.patient.firstName]);

  const doctorName =
    user?.name?.trim() ||
    `${token.doctor.firstName} ${token.doctor.lastName}`.trim() ||
    'Doctor';
  const displayDoctor = doctorName.toLowerCase().startsWith('dr') ? doctorName : `Dr. ${doctorName}`;
  const dateStr = new Date(token.date || Date.now()).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const brand = clinic.clinicName?.trim() || 'HOSPITAL';

  function onDobChange(value: string): void {
    setPatientDob(value);
    setPatientAge(calcAge(value || null));
  }

  async function handleSave(): Promise<boolean> {
    if (!editor) return false;
    setSaving(true);
    setError(null);
    try {
      const html = editor.getHTML();
      const meta = `[Pad|sex:${patientSex}|age:${patientAge}|dob:${patientDob}|addr:${patientAddress.replace(/\|/g, ' ')}|dx:${diagnosis.replace(/\|/g, ' ')}]`;
      const thumbName = `Rx · ${patientName || 'Patient'} · ${dateStr}`;
      let thumbnail: string | null = null;
      try {
        const thumbHtml = buildPrescriptionThumbHtml({
          clinicName: brand,
          patientName,
          diagnosis,
          adviceHtml: html,
          dateStr,
        });
        const captured = await window.clinic.print.captureHtml(thumbHtml, {
          width: 280,
          height: 360,
        });
        if (captured?.ok && captured.base64) thumbnail = captured.base64;
      } catch {
        /* list still works without thumbnail */
      }
      await window.clinic.tokens.upsertPrescription(token.id, {
        diagnosis: diagnosis || 'Rx',
        medicines: [],
        tests: token.prescription?.tests ?? [],
        advice: `${meta}\n${html}`.trim(),
        thumbName,
        thumbnail,
      });
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save prescription');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAiSuggest(): Promise<void> {
    if (!editor) return;
    setAiLoading(true);
    setError(null);
    setAiHint(true);
    const currentText = stripAdviceHtml(editor.getHTML());
    editor.commands.setContent('<p></p>');
    let streamed = '';
    let lastPaint = 0;
    const paint = (html: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastPaint < 50) return;
      lastPaint = now;
      editor.commands.setContent(html.trim() || '<p></p>');
    };
    try {
      const result = await window.clinic.ai.suggestPrescription(
        {
          diagnosis,
          age: patientAge,
          sex: patientSex,
          currentText,
        },
        (delta) => {
          streamed += delta;
          paint(streamed);
        },
      );
      if (!result?.ok || !result.html) {
        setError(result?.error || 'AI suggestion failed');
        setAiHint(false);
        return;
      }
      editor.commands.setContent(result.html);
      setTimeout(() => setAiHint(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed');
      setAiHint(false);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveAndPdf(): Promise<void> {
    if (!editor) return;
    setBodyTextForPdf(editor.getHTML());
    const ok = await handleSave();
    if (ok) setPdfOpen(true);
  }

  const underlineInputStyle = {
    color: PAD_INK,
    fontSize: 13,
    fontWeight: 500,
  } as const;

  return (
    <>
      <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
        <DialogSurface className={styles.surface}>
          <div className={styles.toolbarBar}>
            <Text weight="bold" size={400} style={{ color: PAD_INK }}>
              Prescription Pad
            </Text>
            <div className={styles.toolbarActions}>
              {savedHint && <Text className={styles.hintOk}>Saved</Text>}
              {aiHint && <Text className={styles.hintInfo}>AI draft — verify before saving</Text>}
              {error && (
                <Text className={styles.hintError} title={error}>
                  {error}
                </Text>
              )}
              {can('ai') && (
                <Tooltip content="Draft Rx/advice with Groq AI (edit before save)" relationship="label">
                  <Button
                    size="small"
                    appearance="outline"
                    icon={aiLoading ? <Spinner size="tiny" /> : <AutoAwesomeOutlinedIcon />}
                    disabled={!editor || aiLoading || saving}
                    onClick={() => void handleAiSuggest()}
                  >
                    AI Suggest
                  </Button>
                </Tooltip>
              )}
              <Button
                size="small"
                appearance="outline"
                icon={saving ? <Spinner size="tiny" /> : <SaveOutlinedIcon />}
                disabled={!editor || saving}
                onClick={() => void handleSave()}
              >
                Save
              </Button>
              <Button
                size="small"
                appearance="primary"
                className={styles.savePdf}
                icon={saving ? <Spinner size="tiny" /> : <PrintOutlinedIcon />}
                disabled={!editor || saving}
                onClick={() => void handleSaveAndPdf()}
              >
                Save PDF
              </Button>
              <Button
                appearance="subtle"
                size="small"
                icon={<CloseOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={onClose}
                aria-label="Close"
              />
            </div>
          </div>

          <div className={styles.scroll}>
            <div className={styles.page}>
              <div className={styles.header}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text className={styles.doctorName}>{displayDoctor}</Text>
                  {qualification ? <Text className={styles.doctorMeta} as="p">{qualification}</Text> : null}
                  {specialization ? (
                    <Text className={styles.doctorMeta} as="p" style={{ paddingRight: 16 }}>
                      {specialization}
                    </Text>
                  ) : null}
                </div>
                <img src={brandLogo} alt="Clinic" className={styles.logo} />
              </div>

              <div className={styles.fields}>
                <div className={styles.fieldRow}>
                  <Text className={styles.label}>Patient Name:</Text>
                  <Input
                    appearance="underline"
                    className={styles.underlineInput}
                    value={patientName}
                    onChange={(_, d) => setPatientName(d.value)}
                    style={underlineInputStyle}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <Text className={styles.label}>Address:</Text>
                  <Input
                    appearance="underline"
                    className={styles.underlineInput}
                    value={patientAddress}
                    onChange={(_, d) => setPatientAddress(d.value)}
                    style={underlineInputStyle}
                  />
                </div>
                <div className={styles.fieldRowSplit}>
                  <div className={styles.fieldGroup}>
                    <Text className={styles.labelSm}>Age:</Text>
                    <Input
                      appearance="underline"
                      className={styles.underlineInput}
                      value={patientAge}
                      onChange={(_, d) => setPatientAge(d.value)}
                      style={underlineInputStyle}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <Text className={styles.labelSm} style={{ minWidth: 44 }}>Date:</Text>
                    <Input
                      appearance="underline"
                      className={styles.underlineInput}
                      value={dateStr}
                      readOnly
                      style={underlineInputStyle}
                    />
                  </div>
                  <div className={styles.fieldGroup} style={{ flex: 1.1 }}>
                    <Text className={styles.labelSm}>DOB:</Text>
                    <Input
                      type="date"
                      appearance="underline"
                      className={styles.underlineInput}
                      value={patientDob}
                      onChange={(_, d) => onDobChange(d.value)}
                      style={underlineInputStyle}
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <Text className={styles.label}>Diagnosis:</Text>
                  <Input
                    appearance="underline"
                    className={styles.underlineInput}
                    value={diagnosis}
                    onChange={(_, d) => setDiagnosis(d.value)}
                    style={underlineInputStyle}
                  />
                </div>
              </div>

              <div className={styles.formatBar}>
                {[
                  { title: 'Bold', icon: <FormatBoldIcon style={{ fontSize: 18 }} />, run: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                  { title: 'Bullets', icon: <FormatListBulletedIcon style={{ fontSize: 18 }} />, run: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                  { title: 'Numbers', icon: <FormatListNumberedIcon style={{ fontSize: 18 }} />, run: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
                  { title: 'Undo', icon: <UndoIcon style={{ fontSize: 18 }} />, run: () => editor?.chain().focus().undo().run() },
                  { title: 'Redo', icon: <RedoIcon style={{ fontSize: 18 }} />, run: () => editor?.chain().focus().redo().run() },
                ].map((b) => (
                  <Tooltip key={b.title} content={b.title} relationship="label">
                    <Button
                      appearance="subtle"
                      size="small"
                      disabled={!editor}
                      onClick={b.run}
                      icon={b.icon}
                      style={{ color: b.active ? PAD_BLUE : '#64748b' }}
                    />
                  </Tooltip>
                ))}
              </div>

              <div className={styles.rxBody}>
                <img src={brandLogo} alt="" className={styles.watermark} />
                <Text className={styles.rxTitle}>Rx</Text>
                <div className={styles.editorWrap}>
                  <style>{`
                    .ProseMirror {
                      outline: none;
                      min-height: 300px;
                      font-size: 15px;
                      line-height: 1.7;
                      color: ${PAD_INK} !important;
                      caret-color: ${PAD_BLUE};
                    }
                    .ProseMirror p, .ProseMirror li, .ProseMirror span, .ProseMirror strong {
                      color: ${PAD_INK} !important;
                    }
                    .ProseMirror p { margin: 0 0 8px; }
                    .ProseMirror ul, .ProseMirror ol { padding-left: 20px; margin: 8px 0; }
                  `}</style>
                  <EditorContent editor={editor} />
                </div>

                <div className={styles.signature}>
                  <div className={styles.signatureLine} />
                  <Text className={styles.signatureLabel}>SIGNATURE</Text>
                </div>
              </div>

              <div className={styles.footer}>
                <Text className={styles.brand}>{brand}</Text>
                {clinic.clinicAddress && (
                  <div className={styles.footerMeta}>
                    <PlaceOutlinedIcon style={{ fontSize: 16, color: '#5A6570', flexShrink: 0 }} />
                    <Text className={styles.footerText}>{clinic.clinicAddress}</Text>
                  </div>
                )}
                {clinic.clinicPhone && (
                  <div className={styles.footerPhone}>
                    <LocalPhoneOutlinedIcon style={{ fontSize: 16, color: '#5A6570', flexShrink: 0 }} />
                    <Text className={styles.footerText}>{clinic.clinicPhone}</Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogSurface>
      </Dialog>

      {pdfOpen && (
        <PrescriptionPadPdfPreview
          onClose={() => setPdfOpen(false)}
          clinic={clinic}
          doctorName={displayDoctor}
          qualification={qualification}
          specialization={specialization}
          patientName={patientName}
          patientAddress={patientAddress}
          patientAge={patientAge || '—'}
          patientSex={patientSex || '—'}
          dateStr={dateStr}
          diagnosis={diagnosis}
          bodyText={bodyTextForPdf}
          logoSrc={brandLogo}
        />
      )}
    </>
  );
}
