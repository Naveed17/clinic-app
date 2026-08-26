import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components';
import { CloseIcon, ContentCopyIcon, WhatsAppIcon } from '@/icons/fluent';
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
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open && !sendingApi) onClose(); }}>
      <DialogSurface style={{ maxWidth: 560, width: '100%', borderRadius: tokens.borderRadiusLarge, border: `1px solid ${tokens.colorNeutralStroke1}`, boxShadow: tokens.shadow16 }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${tokens.colorNeutralStroke1}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WhatsAppIcon />
            <DialogTitle style={{ margin: 0 }}>Send WhatsApp Confirmation</DialogTitle>
          </div>
          <Button appearance="subtle" size="small" icon={<CloseIcon />} onClick={onClose} disabled={sendingApi} />
        </div>

        <DialogBody style={{ padding: 20 }}>
          <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {apiError && (
              <MessageBar intent="error">
                <MessageBarBody>{apiError}</MessageBarBody>
              </MessageBar>
            )}
            {apiSent && (
              <MessageBar intent="success">
                <MessageBarBody>WhatsApp message successfully sent!</MessageBarBody>
              </MessageBar>
            )}

            <MessageBar intent="info">
              <MessageBarBody>
                {hasApiSubscription
                  ? 'Appointment booked! Click Send WhatsApp below to send message directly.'
                  : 'Appointment booked! Review the pre-filled message below and click Open WhatsApp Web to send.'}
              </MessageBarBody>
            </MessageBar>

            <Text weight="bold" size={300}>Message Preview:</Text>

            <Textarea
              rows={6}
              value={defaultMessage}
              readOnly
              style={{ width: '100%', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5' }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                appearance="outline"
                icon={<ContentCopyIcon />}
                onClick={() => void handleCopyText()}
              >
                {copiedText ? 'Text Copied!' : 'Copy Text'}
              </Button>
            </div>
          </DialogContent>
        </DialogBody>

        <DialogActions style={{ padding: '16px 20px', borderTop: `1px solid ${tokens.colorNeutralStroke1}` }}>
          <Button appearance="subtle" onClick={onClose} disabled={sendingApi}>
            Close
          </Button>

          {hasApiSubscription ? (
            <Button
              appearance="primary"
              icon={sendingApi ? <Spinner size="tiny" /> : <WhatsAppIcon />}
              onClick={() => void handleSendApi()}
              disabled={sendingApi || !formattedPhone}
              style={{ backgroundColor: '#107c10', fontWeight: 700 }}
            >
              {sendingApi ? 'Sending…' : 'Send WhatsApp'}
            </Button>
          ) : (
            <Button
              appearance="primary"
              icon={<WhatsAppIcon />}
              onClick={handleSendWhatsAppWeb}
              style={{ backgroundColor: '#107c10', fontWeight: 700 }}
            >
              Open WhatsApp Web & Send
            </Button>
          )}
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
