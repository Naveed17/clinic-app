import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import type { Token } from '@/types/token';
import type { Patient } from '@/types/patient';
import {
  PAD_BLUE,
  PAD_BLUE_SOFT,
  PAD_INK,
  PAD_LINE,
  PrescriptionPadPdfPreview,
  parsePadMeta,
  type PrescriptionPadClinic,
} from './PrescriptionPadPdf';

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
  // Already rich HTML from TipTap (lists, bold, etc.)
  if (/<(?:p|ul|ol|li|strong|b|br)\b/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function PlusMedIcon({ size = 56, color = PAD_BLUE }: { size?: number; color?: string }): React.JSX.Element {
  const bar = size * 0.22;
  const len = size * 0.72;
  const r = bar / 2;
  const mid = (size - bar) / 2;
  const midL = (size - len) / 2;
  return (
    <Box component="svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden sx={{ display: 'block' }}>
      <rect x={mid} y={midL} width={bar} height={len} rx={r} ry={r} fill={color} />
      <rect x={midL} y={mid} width={len} height={bar} rx={r} ry={r} fill={color} />
    </Box>
  );
}

const underlineFieldSx = {
  '& .MuiInputBase-root': {
    color: `${PAD_INK} !important`,
    fontSize: 13,
    fontWeight: 500,
  },
  '& .MuiInputBase-input': {
    color: `${PAD_INK} !important`,
    py: 0.4,
    px: 0.25,
  },
  '& .MuiInput-underline:before': { borderBottomColor: `${PAD_LINE} !important` },
  '& .MuiInput-underline:hover:before': { borderBottomColor: `${PAD_BLUE} !important` },
  '& .MuiInput-underline:after': { borderBottomColor: PAD_BLUE },
};

interface PrescriptionPadDialogProps {
  token: Token;
  onClose: () => void;
}

export function PrescriptionPadDialog({ token, onClose }: PrescriptionPadDialogProps): React.JSX.Element {
  const { user } = useAuth();
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
  const [qualification, setQualification] = useState('CONSULTING PHYSICIAN');
  const [saving, setSaving] = useState(false);
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
      // Keep TipTap HTML so lists/bold survive save + print
      const html = editor.getHTML();
      const meta = `[Pad|sex:${patientSex}|age:${patientAge}|dob:${patientDob}|addr:${patientAddress.replace(/\|/g, ' ')}|dx:${diagnosis.replace(/\|/g, ' ')}]`;
      await window.clinic.tokens.upsertPrescription(token.id, {
        diagnosis: diagnosis || 'Rx',
        medicines: [],
        tests: token.prescription?.tests ?? [],
        advice: `${meta}\n${html}`.trim(),
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

  async function handleSaveAndPdf(): Promise<void> {
    if (!editor) return;
    setBodyTextForPdf(editor.getHTML());
    const ok = await handleSave();
    if (ok) setPdfOpen(true);
  }

  const labelSx = { fontWeight: 700, color: `${PAD_BLUE} !important`, fontSize: 13, flexShrink: 0, minWidth: 108 };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 1,
            overflow: 'hidden',
            maxHeight: '94vh',
            bgcolor: '#eef3f8',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          <Typography fontWeight={700} fontSize={15} color={PAD_INK}>
            Prescription Pad
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {savedHint && (
              <Typography variant="caption" color="success.main" fontWeight={600}>
                Saved
              </Typography>
            )}
            {error && (
              <Typography variant="caption" color="error" sx={{ maxWidth: 200 }} noWrap>
                {error}
              </Typography>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveOutlinedIcon />}
              loading={saving}
              disabled={!editor}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PrintOutlinedIcon />}
              loading={saving}
              disabled={!editor}
              onClick={() => void handleSaveAndPdf()}
              sx={{ bgcolor: PAD_BLUE, '&:hover': { bgcolor: '#1e4668' } }}
            >
              Save PDF
            </Button>
            <IconButton size="small" onClick={onClose}>
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ overflow: 'auto', p: { xs: 1.5, sm: 2.5 }, flex: '1 1 auto', minHeight: 0 }}>
          <Box
            sx={{
              mx: 'auto',
              width: '100%',
              maxWidth: 794,
              minHeight: 1120,
              bgcolor: '#ffffff',
              color: PAD_INK,
              boxShadow: '0 12px 40px rgba(30,58,95,0.12)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', px: 5, pt: 4.5, pb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, color: `${PAD_BLUE} !important`, fontSize: 26, lineHeight: 1.15 }}>
                  {displayDoctor}
                </Typography>
                <TextField
                  variant="standard"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value.toUpperCase())}
                  sx={{
                    ...underlineFieldSx,
                    mt: 0.5,
                    maxWidth: 280,
                    '& .MuiInputBase-input': {
                      color: `${PAD_BLUE} !important`,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      py: 0.25,
                    },
                    '& .MuiInput-underline:before': { borderBottom: 'none' },
                    '& .MuiInput-underline:after': { borderBottom: 'none' },
                    '& .MuiInput-underline:hover:before': { borderBottom: 'none !important' },
                  }}
                />
              </Box>
              <Box sx={{ pt: 0.5 }}>
                <PlusMedIcon size={56} />
              </Box>
            </Box>

            {/* Patient fields */}
            <Box sx={{ position: 'relative', zIndex: 1, px: 5, pt: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography sx={labelSx}>Patient Name:</Typography>
                <TextField
                  variant="standard"
                  fullWidth
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  sx={underlineFieldSx}
                />
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography sx={labelSx}>Address:</Typography>
                <TextField
                  variant="standard"
                  fullWidth
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  sx={underlineFieldSx}
                />
              </Stack>
              <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                  <Typography sx={{ ...labelSx, minWidth: 40 }}>Age:</Typography>
                  <TextField
                    variant="standard"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    sx={{ ...underlineFieldSx, flex: 1 }}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                  <Typography sx={{ ...labelSx, minWidth: 44 }}>Date:</Typography>
                  <TextField
                    variant="standard"
                    value={dateStr}
                    InputProps={{ readOnly: true }}
                    sx={{ ...underlineFieldSx, flex: 1 }}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1.1 }}>
                  <Typography sx={{ ...labelSx, minWidth: 40 }}>DOB:</Typography>
                  <TextField
                    type="date"
                    variant="standard"
                    value={patientDob}
                    onChange={(e) => onDobChange(e.target.value)}
                    sx={{ ...underlineFieldSx, flex: 1 }}
                  />
                </Stack>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography sx={labelSx}>Diagnosis:</Typography>
                <TextField
                  variant="standard"
                  fullWidth
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  sx={underlineFieldSx}
                />
              </Stack>
            </Box>

            {/* Toolbar */}
            <Stack direction="row" spacing={0.5} sx={{ px: 5, pt: 1 }}>
              {[
                { title: 'Bold', icon: <FormatBoldIcon fontSize="small" />, run: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                { title: 'Bullets', icon: <FormatListBulletedIcon fontSize="small" />, run: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                { title: 'Numbers', icon: <FormatListNumberedIcon fontSize="small" />, run: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
                { title: 'Undo', icon: <UndoIcon fontSize="small" />, run: () => editor?.chain().focus().undo().run() },
                { title: 'Redo', icon: <RedoIcon fontSize="small" />, run: () => editor?.chain().focus().redo().run() },
              ].map((b) => (
                <Tooltip key={b.title} title={b.title}>
                  <IconButton size="small" disabled={!editor} onClick={b.run} sx={{ color: b.active ? PAD_BLUE : '#64748b' }}>
                    {b.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>

            {/* Rx body */}
            <Box sx={{ position: 'relative', flex: 1, px: 5, pt: 1, pb: 2, minHeight: 380 }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: '12%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  opacity: 0.12,
                  zIndex: 0,
                }}
              >
                <PlusMedIcon size={200} color={PAD_BLUE_SOFT} />
              </Box>
              <Typography sx={{ position: 'relative', zIndex: 1, fontWeight: 800, color: `${PAD_BLUE} !important`, fontSize: 34, mb: 1, lineHeight: 1 }}>
                Rx
              </Typography>
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  '& .ProseMirror': {
                    outline: 'none',
                    minHeight: 300,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: `${PAD_INK} !important`,
                    caretColor: PAD_BLUE,
                    '& p, & li, & span, & strong': { color: `${PAD_INK} !important` },
                    '& p': { m: 0, mb: 1 },
                    '& ul, & ol': { pl: 2.5, my: 1 },
                  },
                }}
              >
                <EditorContent editor={editor} />
              </Box>

              {/* Signature */}
              <Box sx={{ position: 'relative', zIndex: 1, mt: 4, ml: 'auto', width: 180, textAlign: 'center' }}>
                <Box sx={{ borderBottom: `1px solid ${PAD_LINE}`, mb: 0.75 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: `${PAD_BLUE} !important`, letterSpacing: 2 }}>
                  SIGNATURE
                </Typography>
              </Box>
            </Box>

            {/* Simple footer — gradient top border, no bg */}
            <Box
              sx={{
                position: 'relative',
                mt: 'auto',
                px: 5,
                py: 2.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                bgcolor: '#ffffff',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 40,
                  right: 40,
                  height: '2px',
                  background: 'linear-gradient(to right, #5EC8D8, #3A6A8C, #1A2332)',
                },
              }}
            >
              <Typography
                sx={{
                  fontWeight: 500,
                  color: '#5A6570 !important',
                  fontSize: 12,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {brand}
              </Typography>
              {clinic.clinicAddress && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: 1, justifyContent: 'center', minWidth: 0 }}>
                  <PlaceOutlinedIcon sx={{ fontSize: 16, color: '#5A6570', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, color: '#5A6570 !important', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clinic.clinicAddress}
                  </Typography>
                </Stack>
              )}
              {clinic.clinicPhone && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                  <LocalPhoneOutlinedIcon sx={{ fontSize: 16, color: '#5A6570', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, color: '#5A6570 !important' }}>{clinic.clinicPhone}</Typography>
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      </Dialog>

      {pdfOpen && (
        <PrescriptionPadPdfPreview
          onClose={() => setPdfOpen(false)}
          clinic={clinic}
          doctorName={displayDoctor}
          qualification={qualification}
          patientName={patientName}
          patientAddress={patientAddress}
          patientAge={patientAge || '—'}
          patientSex={patientSex || '—'}
          dateStr={dateStr}
          diagnosis={diagnosis}
          bodyText={bodyTextForPdf}
        />
      )}
    </>
  );
}
