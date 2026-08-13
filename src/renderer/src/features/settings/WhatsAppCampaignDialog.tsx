import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FormDialogTitle,
  SubmitButton,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { doctorsService } from '@/services/doctors.service';
import { patientsService } from '@/services/patients.service';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import type { Doctor } from '@/types/doctor';
import type { Patient } from '@/types/patient';

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
    ? `Dr. ${doctorName} ${when} ko clinic visit karenge.`
    : doctorName
      ? `Dr. ${doctorName} clinic visit karenge.`
      : when
        ? `${when} ko clinic visit hai.`
        : 'Clinic visit ki maloomat.';
  const clinic = clinicName.trim() ? `\n${clinicName.trim()}` : '';
  return `Assalam o Alaikum,\n\n${visit}${clinic}\n\nShukriya.`;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Campaign failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="WhatsApp campaign"
        subtitle="Doctor visit message — all patients with a WhatsApp number."
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {!enabled && <Alert severity="warning">Enable WhatsApp and save settings before sending.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity={result.failed ? 'warning' : 'success'}>
              Sent {result.sent}, failed {result.failed}.
              {result.errors.length > 0 ? ` ${result.errors[0]}` : ''}
            </Alert>
          )}
          <FormControl fullWidth size="small" disabled={loading || sending}>
            <InputLabel>Doctor</InputLabel>
            <Select
              label="Doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <MenuItem value="">— Select doctor —</MenuItem>
              {doctors.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  Dr. {d.firstName} {d.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Visit date"
            type="date"
            size="small"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={loading || sending}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Message"
            size="small"
            fullWidth
            multiline
            minRows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading || sending}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<ImageOutlinedIcon />}
              disabled={loading || sending}
              onClick={() => fileRef.current?.click()}
            >
              {imageName || 'Add image'}
            </Button>
            {imageName && (
              <Button size="small" onClick={clearImage} disabled={sending}>Remove</Button>
            )}
          </Stack>
          {imagePreview && (
            <Box
              component="img"
              src={imagePreview}
              alt="Campaign"
              sx={{
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            Recipients: {loading ? '…' : phones.length} patients with WhatsApp numbers
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={sending} sx={dialogCancelBtnSx}>Close</Button>
        <SubmitButton
          loading={sending}
          disabled={!enabled || loading || !text.trim() || phones.length === 0}
          onClick={() => void handleSend()}
          startIcon={<CampaignOutlinedIcon />}
        >
          Send campaign
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
