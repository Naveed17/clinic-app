import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Field,
  MessageBar,
  MessageBarBody,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import { showAppToast } from '@/components/AppToast';
import type { Patient } from '@/types/patient';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { WhatsAppIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
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
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
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
  hint: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
});

export function PatientWhatsAppSendDialog({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient: Patient;
  onClose: () => void;
}): React.JSX.Element {
  const styles = useStyles();
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
      showAppToast({ type: 'success', message: 'WhatsApp message sent' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.');
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
          title="Send WhatsApp"
          subtitle={`${patient.firstName} ${patient.lastName}${phone ? ` · ${phone}` : ''}`}
        />
        <DialogBody>
          <DialogContent className={styles.body}>
            {!phone && (
              <MessageBar intent="warning">
                <MessageBarBody>Add a phone number on this patient first.</MessageBarBody>
              </MessageBar>
            )}
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {sent && (
              <MessageBar intent="success">
                <MessageBarBody>Message sent.</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Message">
              <Textarea
                rows={4}
                value={text}
                onChange={(_, d) => setText(d.value)}
                disabled={sending || sent || !phone}
              />
            </Field>
            <Text className={styles.hint}>
              Cloud API se in-app send. WhatsApp Web ke liye neeche Open WhatsApp Web dabao.
            </Text>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={sending}>
            {sent ? 'Close' : 'Cancel'}
          </Button>
          {phone && (
            <Button
              appearance="secondary"
              disabled={sending}
              onClick={() => {
                openWhatsAppWeb(phone, text);
                onClose();
              }}
            >
              Open WhatsApp Web
            </Button>
          )}
          {can('whatsapp') && (
            <SubmitButton
              loading={sending}
              disabled={!phone || sent || !text.trim()}
              icon={<WhatsAppIcon />}
              onClick={() => void handleSend()}
            >
              Send
            </SubmitButton>
          )}
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
