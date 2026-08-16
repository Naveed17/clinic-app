import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { Alert, Button, Dialog, DialogActions, DialogContent, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  FormDialogTitle,
  SubmitButton,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import type { Patient } from '@/types/patient';
import { useLicense } from '@/features/auth/LicenseModulesContext';

export function PatientWhatsAppSendDialog({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient: Patient;
  onClose: () => void;
}): React.JSX.Element {
  const { can } = useLicense();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const phone = toWhatsAppNumber(patient.phone) || patient.phone?.trim() || '';

  useEffect(() => {
    if (!open) return;
    setText('');
    setError(null);
    setSent(false);
  }, [open]);

  async function handleSend(): Promise<void> {
    if (!phone) {
      setError('This patient has no valid WhatsApp number.');
      return;
    }
    if (!text.trim()) {
      setError('Write a message.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await window.clinic.whatsapp.sendMessage({ phone, text: text.trim() });
      if (!res.success) {
        setError(res.error || 'Send failed.');
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="Send WhatsApp"
        subtitle={`${patient.firstName} ${patient.lastName}${phone ? ` · ${phone}` : ''}`}
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {!phone && <Alert severity="warning">Add a phone number on this patient first.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {sent && <Alert severity="success">Message sent.</Alert>}
          <TextField
            label="Message"
            fullWidth
            multiline
            minRows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending || sent || !phone}
          />
          <Typography variant="caption" color="text.secondary">
            Cloud API se in-app send. WhatsApp Web ke liye neeche Open WhatsApp Web dabao.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={sending} sx={dialogCancelBtnSx}>{sent ? 'Close' : 'Cancel'}</Button>
        {phone && (
          <Button
            disabled={sending}
            onClick={() => {
              openWhatsAppWeb(phone, text);
              onClose();
            }}
            sx={dialogCancelBtnSx}
          >
            Open WhatsApp Web
          </Button>
        )}
        {can('whatsapp') && (
          <SubmitButton
            loading={sending}
            disabled={!phone || sent || !text.trim()}
            onClick={() => void handleSend()}
            startIcon={<WhatsAppIcon />}
          >
            Send
          </SubmitButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
