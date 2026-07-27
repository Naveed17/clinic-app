import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert, Paper, CircularProgress } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export function LicensePage({ onActivated }: { onActivated: () => void }): React.JSX.Element {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleActivate(): Promise<void> {
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) return;

    setLoading(true);
    setError('');


    const result = await window.clinic.license.activate(cleanKey);
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
        bgcolor: 'background.default'
      }}
    >
      <Paper elevation={3} sx={{ p: 5, width: 420, borderRadius: 3 }}>
        <Stack alignItems="center" spacing={2} mb={3}>
          <LockOutlinedIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h5" fontWeight={700}>
            License Activation
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Enter your license key to activate CareFlow.
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="License Key"
            placeholder="CLINIC-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleActivate()}
            fullWidth
            autoFocus
            disabled={loading}
            slotProps={{
              htmlInput: { style: { textTransform: 'uppercase', letterSpacing: '1px' } }
            }}
          />

          <Button
            variant="contained"
            size="large"
            disabled={loading || !key.trim()}
            onClick={handleActivate}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Activating…' : 'Activate'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}