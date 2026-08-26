import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CloseIcon from '@mui/icons-material/Close';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import { formatTableDate } from '@/utils/formatDate';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import { showAppToast } from '@/components/AppToast';
import type { Appointment } from '@/types/appointment';

export function AppointmentWhatsAppDialog({
  open,
  onClose,
  appointment,
}: {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}): React.JSX.Element | null {
  const { can } = useLicense();
  const hasApiSubscription = can('whatsapp');

  const [copiedText, setCopiedText] = useState(false);
  const [sendingApi, setSendingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSent, setApiSent] = useState(false);

  const [clinic, setClinic] = useState<{ clinicName: string; clinicAddress: string; clinicPhone: string }>({
    clinicName: 'Tarar Clinic',
    clinicAddress: 'Phularwan',
    clinicPhone: '',
  });

  useEffect(() => {
    void window.clinic?.settings.get().then((settings) => {
      setClinic({
        clinicName: settings.clinicName || 'Tarar Clinic',
        clinicAddress: settings.clinicAddress || 'Phularwan',
        clinicPhone: settings.clinicPhone || '',
      });
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setApiError(null);
    setApiSent(false);
  }, [open]);

  if (!appointment) return null;

  const docName = `${appointment.provider.firstName} ${appointment.provider.lastName}`.trim();
  const formattedDoctor = docName.startsWith('Dr.') ? docName : `Dr. ${docName}`;
  const patName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
  const dateFormatted = formatTableDate(appointment.startsAt);
  const timeFormatted = appointment.startsAt
    ? new Date(appointment.startsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '10:00 AM';
  const tokenStr = appointment.tokenNumber ? `#${String(appointment.tokenNumber).padStart(3, '0')}` : 'WALK-IN';
  const rawPhone = appointment.patient.phone || '';
  const formattedPhone = toWhatsAppNumber(rawPhone) || rawPhone.trim();

  const defaultMessage = `Hi *${patName}*, this is a reminder for your upcoming appointment with *${formattedDoctor}* on *${dateFormatted} at ${timeFormatted}*. Please confirm your attendance by replying 'Yes' or 'reschedule'.`;

  async function handleCopyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(defaultMessage);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  function handleSendWhatsAppWeb(): void {
    if (formattedPhone) {
      openWhatsAppWeb(formattedPhone, defaultMessage);
    } else {
      openWhatsAppWeb('923000000000', defaultMessage);
    }
    onClose();
  }

  async function handleSendApi(): Promise<void> {
    if (!formattedPhone) {
      setApiError('Patient has no valid phone number.');
      return;
    }
    setSendingApi(true);
    setApiError(null);
    try {
      const res = await window.clinic.whatsapp.sendMessage({ phone: formattedPhone, text: defaultMessage });
      if (!res.success) {
        setApiError(res.error || 'WhatsApp message failed to send.');
        return;
      }
      setApiSent(true);
      showAppToast({ type: 'success', message: 'WhatsApp message sent successfully' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'WhatsApp message failed to send.');
    } finally {
      setSendingApi(false);
    }
  }

  return (
    <Dialog open={open} onClose={sendingApi ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <WhatsAppIcon sx={{ color: '#25D366', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={700}>
            Send WhatsApp Confirmation
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" disabled={sendingApi}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {apiError && <Alert severity="error">{apiError}</Alert>}
          {apiSent && <Alert severity="success">WhatsApp message successfully sent!</Alert>}

          <Alert severity="info" icon={<WhatsAppIcon />}>
            {hasApiSubscription
              ? 'Appointment booked! Click Send WhatsApp below to send message directly.'
              : 'Appointment booked! Review the pre-filled message below and click Open WhatsApp Web to send.'}
          </Alert>

          <Typography fontSize={14} fontWeight={700} color="text.primary">
            Message Preview:
          </Typography>

          <TextField
            multiline
            rows={8}
            fullWidth
            value={defaultMessage}
            slotProps={{ input: { readOnly: true } }}
            variant="outlined"
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'text.primary',
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc'),
              },
            }}
          />

          <Stack direction="row" spacing={2} justifyContent="flex-start">
            <Button
              variant="outlined"
              size="medium"
              startIcon={<ContentCopyIcon />}
              onClick={() => void handleCopyText()}
              color={copiedText ? 'success' : 'primary'}
            >
              {copiedText ? 'Text Copied!' : 'Copy Text'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.8)' : '#f8fafc') }}>
        <Button onClick={onClose} color="inherit" disabled={sendingApi}>
          Close
        </Button>

        {hasApiSubscription ? (
          <Button
            variant="contained"
            color="success"
            startIcon={sendingApi ? <CircularProgress size={18} color="inherit" /> : <WhatsAppIcon />}
            onClick={() => void handleSendApi()}
            disabled={sendingApi || !formattedPhone}
            sx={{ fontWeight: 700, px: 3 }}
          >
            {sendingApi ? 'Sending…' : 'Send WhatsApp'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            startIcon={<WhatsAppIcon />}
            onClick={handleSendWhatsAppWeb}
            sx={{ fontWeight: 700, px: 3 }}
          >
            Open WhatsApp Web & Send
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
