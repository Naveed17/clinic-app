import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import { Box, Button, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { CAREFLOW_BRAND, supportTelHref, supportWhatsAppHref } from '@shared/careflowSupport';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

export function LicenseDisabledOverlay({
  reason,
  checking,
  onCheck,
}: {
  reason: string;
  checking: boolean;
  onCheck: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const brandLogo = useClinicBrandLogo();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void window.clinic.license.support().then((contact) => {
      setPhone(String(contact?.phone || '').trim());
      setEmail(String(contact?.email || '').trim());
    }).catch(() => {
      setPhone('');
      setEmail('');
    });
  }, []);

  const tel = supportTelHref(phone);
  const whatsapp = supportWhatsAppHref(phone);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 640,
          borderRadius: 3.5,
          p: { xs: 4, sm: 5.5 },
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          color: 'text.primary',
        }}
      >
        <Stack alignItems="center" spacing={2.25}>
          <Box
            sx={{
              width: 76,
              height: 76,
              borderRadius: 3,
              bgcolor: 'common.white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              p: 0.75,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box
              component="img"
              src={brandLogo}
              alt={CAREFLOW_BRAND}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
          <Typography fontWeight={800} fontSize={32} lineHeight={1.1} color="text.primary">
            {CAREFLOW_BRAND}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: '-3px !important' }}>
            Clinic Management
          </Typography>

          <Typography fontWeight={800} textAlign="center" color="text.primary" sx={{ pt: 1, fontSize: 26 }}>
            License disabled
          </Typography>
          <Typography textAlign="center" color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.45 }}>
            {reason}
          </Typography>
          <Typography textAlign="center" color="text.secondary" sx={{ fontSize: 16, lineHeight: 1.55, maxWidth: 520 }}>
            You do not need to enter a new license key. When CareFlow enables this clinic again,
            the app will unlock automatically.
          </Typography>

          {(phone || email) && (
            <Box
              sx={{
                width: '100%',
                mt: 1.5,
                px: 2.75,
                py: 2.5,
                borderRadius: 2.5,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              }}
            >
              <Typography color="text.secondary" sx={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.2 }}>
                Customer support
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.6 }}>
                {phone && (
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <LocalPhoneOutlinedIcon sx={{ fontSize: 22, color: 'primary.main' }} />
                    <Link
                      href={tel || undefined}
                      underline="hover"
                      color="text.primary"
                      sx={{ fontSize: 16.5, fontWeight: 600 }}
                    >
                      {phone}
                    </Link>
                  </Stack>
                )}
                {email && (
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <EmailOutlinedIcon sx={{ fontSize: 22, color: 'primary.main' }} />
                    <Link
                      href={`mailto:${email}`}
                      underline="hover"
                      color="text.primary"
                      sx={{ fontSize: 16.5, fontWeight: 600 }}
                    >
                      {email}
                    </Link>
                  </Stack>
                )}
                {whatsapp && (
                  <Link
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    color="primary.main"
                    sx={{ fontSize: 15.5, fontWeight: 600 }}
                  >
                    WhatsApp CareFlow
                  </Link>
                )}
              </Stack>
            </Box>
          )}

          <Button
            variant="outlined"
            color="primary"
            onClick={onCheck}
            disabled={checking}
            startIcon={checking ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ mt: 1.25, px: 3, py: 1.1, fontSize: 15, fontWeight: 700 }}
          >
            {checking ? 'Checking…' : 'Check again'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
