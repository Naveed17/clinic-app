import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert, Paper, CircularProgress, InputAdornment } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

/**
 * Strips 'CLINIC-' if user typed/pasted it, retains uppercase alphanumeric chars,
 * and formats with dashes every 4 characters up to max 3 slots (e.g. 8 chars → "45CS-LIGZ", 12 chars → "4FHR-QYZ3-8P20").
 */
function formatSuffix(raw: string): string {
  let cleaned = raw.toUpperCase().replace(/^CLINIC-?/i, '');
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
  // Max 12 alphanumeric chars (3 slots of 4 chars: XXXX-XXXX-XXXX)
  cleaned = cleaned.slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    parts.push(cleaned.slice(i, i + 4));
  }
  return parts.join('-');
}

export function LicensePage({ onActivated }: { onActivated: () => void }): React.JSX.Element {
  const [suffix, setSuffix] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fullKey = suffix ? `CLINIC-${suffix}` : '';

  async function handleActivate(): Promise<void> {
    if (!suffix.trim()) return;

    setLoading(true);
    setError('');

    const result = await window.clinic.license.activate(fullKey);
    setLoading(false);

    if (result.ok) {
      onActivated();
    } else {
      setError(result.error ?? 'Invalid or disabled license key.');
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper elevation={3} sx={{ p: 5, width: 460, borderRadius: 3.5 }}>
        <Stack alignItems="center" spacing={2} mb={3}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3,
              bgcolor: 'primary.50',
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" fontWeight={800}>
            License Activation
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Enter your license key to activate CareFlow.
          </Typography>
        </Stack>

        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="License Key"
            placeholder="XXXX-XXXX-XXXX"
            value={suffix}
            onChange={(e) => setSuffix(formatSuffix(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && !loading && void handleActivate()}
            fullWidth
            autoFocus
            disabled={loading}
            slotProps={{
              htmlInput: {
                maxLength: 35, // Allow full pasted strings (e.g. CLINIC-XXXX-XXXX-XXXX) so formatSuffix can process them
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '0.5px' }}>
                    CLINIC-
                  </InputAdornment>
                ),
                style: { textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 },
              },
            }}
          />

          <Button
            variant="contained"
            size="large"
            disabled={loading || !suffix.trim()}
            onClick={() => void handleActivate()}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ py: 1.4, borderRadius: 2.5, fontWeight: 700, fontSize: 15 }}
          >
            {loading ? 'Activating…' : 'Activate License'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}