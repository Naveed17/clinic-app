import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import LaptopOutlinedIcon from '@mui/icons-material/LaptopOutlined';
import BackupOutlinedIcon from '@mui/icons-material/BackupOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';

type ServerMode = 'local' | 'lan-server' | 'lan-client';

interface Settings {
  serverMode: ServerMode;
  clientApiUrl: string;
  lanPort: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
}

export function SettingsPage(): React.JSX.Element {
  const theme = useTheme();

  const [settings, setSettings] = useState<Settings>({
    serverMode: 'local',
    clientApiUrl: '',
    lanPort: 3333,
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
  });
  const [saved, setSaved] = useState(false);
  const [lanIp, setLanIp] = useState<string>('...');
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  async function handleBackup() {
    setBackupLoading(true); setBackupStatus(null);
    const result = await window.clinic?.backup.create();
    setBackupLoading(false);
    if (result?.canceled) return;
    setBackupStatus(result?.ok ? { type: 'success', msg: `Backup saved to: ${result.path ?? ''}` } : { type: 'error', msg: result?.error ?? 'Backup failed.' });
  }

  async function handleRestore() {
    setRestoreLoading(true); setBackupStatus(null);
    const result = await window.clinic?.backup.restore();
    setRestoreLoading(false);
    if (result?.canceled) return;
    setBackupStatus(result?.ok ? { type: 'success', msg: 'Restore successful! Please restart the app.' } : { type: 'error', msg: result?.error ?? 'Restore failed.' });
  }

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setSettings(s));
    void window.clinic?.settings.lanIp().then((ip) => setLanIp(ip));
  }, []);

  async function handleSave() {
    await window.clinic?.settings.save(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        maxWidth: 960,
        mx: 'auto',
      }}
    >
      <Stack direction="row" spacing={4} alignItems="flex-start">
        {/* Left: Backup & Restore + Clinic Info */}
        <Box sx={{ width: 260, flexShrink: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Clinic Information</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Shown on printed receipts and invoices.</Typography>
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <TextField
              label="Clinic Name"
              size="small"
              fullWidth
              value={settings.clinicName}
              onChange={(e) => setSettings((s) => ({ ...s, clinicName: e.target.value }))}
            />
            <TextField
              label="Address"
              size="small"
              fullWidth
              value={settings.clinicAddress}
              onChange={(e) => setSettings((s) => ({ ...s, clinicAddress: e.target.value }))}
            />
            <TextField
              label="Phone"
              size="small"
              fullWidth
              value={settings.clinicPhone}
              onChange={(e) => setSettings((s) => ({ ...s, clinicPhone: e.target.value }))}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Backup & Restore</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Save a copy of the database or restore from a previous backup.</Typography>
          <Stack direction="row" gap={2} flexWrap="wrap">
            <Button variant="outlined" startIcon={backupLoading ? <CircularProgress size={16} /> : <BackupOutlinedIcon />} disabled={backupLoading} onClick={() => void handleBackup()}>
              Create Backup
            </Button>
            <Button variant="outlined" color="warning" startIcon={restoreLoading ? <CircularProgress size={16} /> : <RestoreOutlinedIcon />} disabled={restoreLoading} onClick={() => void handleRestore()}>
              Restore Backup
            </Button>
          </Stack>
          {backupStatus && <Alert severity={backupStatus.type} sx={{ mt: 2 }}>{backupStatus.msg}</Alert>}
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Right: Network Settings */}
        <Stack spacing={3} flex={1}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Network Settings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure how this machine connects to the clinic network.
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Machine Role
          </Typography>
          <ToggleButtonGroup
            value={settings.serverMode === 'lan-client' ? 'local' : settings.serverMode}
            exclusive
            onChange={(_e, val) => val && setSettings((s) => ({ ...s, serverMode: val as ServerMode }))}
            sx={{ gap: 1, flexWrap: 'wrap', width: '100%' }}
          >
            {([
              { value: 'local', icon: <LaptopOutlinedIcon />, label: 'Standalone', desc: 'Only this machine, no sharing' },
              { value: 'lan-server', icon: <DnsOutlinedIcon />, label: 'LAN Server', desc: 'Share data with other machines' },
            ] as const).map(({ value, icon, label, desc }) => (
              <ToggleButton
                key={value}
                value={value}
                sx={{
                  flex: 1,
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 2,
                  px: 3,
                  borderRadius: '12px !important',
                  border: '1px solid !important',
                  borderColor: (settings.serverMode === value || (value === 'local' && settings.serverMode === 'lan-client'))
                    ? `${theme.palette.primary.main} !important`
                    : 'divider !important',
                  bgcolor: (settings.serverMode === value || (value === 'local' && settings.serverMode === 'lan-client'))
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                {icon}
                <Typography variant="caption" fontWeight={700}>{label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{desc}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Divider />

        <Alert severity="info" icon={<DnsOutlinedIcon />}>
          <Typography variant="body2" fontWeight={600}>
            {settings.serverMode === 'lan-server' ? 'LAN Server mode active.' : 'This machine hosts the database.'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Other machines on the network will auto-discover this machine. They connect via:
          </Typography>
          <Chip
            label={`http://${lanIp}:${settings.lanPort}`}
            size="small"
            sx={{ mt: 1, fontFamily: 'monospace', fontWeight: 600 }}
          />
        </Alert>

        <TextField
          label="Server Port"
          type="number"
          value={settings.lanPort}
          onChange={(e) => setSettings((s) => ({ ...s, lanPort: Number(e.target.value) }))}
          size="small"
          sx={{ maxWidth: 180 }}
          helperText="Default: 3333"
        />

        <Divider />

        <Stack direction="row" alignItems="center" spacing={2}>
          <Button variant="contained" onClick={() => void handleSave()}>
            Save Settings
          </Button>
          {saved && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              Saved! Restart the app to apply changes.
            </Alert>
          )}
        </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
