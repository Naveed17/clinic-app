import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { Button, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { PatientWhatsAppSendDialog } from './PatientWhatsAppSendDialog';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import type { Patient } from '@/types/patient';

export function PatientWhatsAppButton({
  patient,
  sx,
}: {
  patient: Patient;
  sx?: object;
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
        title={
          hasPhone
            ? useApi
              ? 'Send via WhatsApp Cloud API (add-on)'
              : 'Open WhatsApp Web'
            : 'Patient has no phone number'
        }
      >
        <span>
          <Button
            startIcon={<WhatsAppIcon />}
            variant="contained"
            disabled={!hasPhone}
            onClick={handleClick}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5a' },
              ...sx,
            }}
          >
            WhatsApp
          </Button>
        </span>
      </Tooltip>
      {useApi && (
        <PatientWhatsAppSendDialog open={apiOpen} patient={patient} onClose={() => setApiOpen(false)} />
      )}
    </>
  );
}
