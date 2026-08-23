import { Button, Tooltip } from '@fluentui/react-components';
import { useState, type CSSProperties } from 'react';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientWhatsAppSendDialog } from './PatientWhatsAppSendDialog';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import type { Patient } from '@/types/patient';
import { WhatsAppIcon } from '@/icons/fluent';

export function PatientWhatsAppButton({
  patient,
  style,
  sx: _sx,
}: {
  patient: Patient;
  style?: CSSProperties;
  /** @deprecated ignored — use style */
  sx?: unknown;
}): React.JSX.Element {
  const { can } = useLicense();
  const [apiOpen, setApiOpen] = useState(false);
  const hasPhone = Boolean(patient.phone?.trim());
  const useApi = can('whatsapp');

  function handleClick(): void {
    if (!hasPhone) return;
    if (useApi) {
      setApiOpen(true);
      return;
    }
    openWhatsAppWeb(patient.phone || '');
  }

  return (
    <>
      <Tooltip
        content={
          hasPhone
            ? useApi
              ? 'Send via WhatsApp Cloud API (add-on)'
              : 'Open WhatsApp Web'
            : 'Patient has no phone number'
        }
        relationship="label"
      >
        <Button
          icon={<WhatsAppIcon />}
          disabled={!hasPhone}
          onClick={handleClick}
          style={{
            fontWeight: 700,
            backgroundColor: '#25D366',
            color: '#fff',
            border: 'none',
            ...style,
          }}
        >
          WhatsApp
        </Button>
      </Tooltip>
      {useApi && (
        <PatientWhatsAppSendDialog open={apiOpen} patient={patient} onClose={() => setApiOpen(false)} />
      )}
    </>
  );
}
