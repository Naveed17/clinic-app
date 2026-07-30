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
  LinearProgress,
} from '@mui/material';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import LaptopOutlinedIcon from '@mui/icons-material/LaptopOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import BackupOutlinedIcon from '@mui/icons-material/BackupOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import SystemUpdateAltOutlinedIcon from '@mui/icons-material/SystemUpdateAltOutlined';
import WifiTetheringOutlinedIcon from '@mui/icons-material/WifiTetheringOutlined';

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

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [lanIp, setLanIp] = useState<string>('...');
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'latest' | 'error'>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  useEffect(() => {
    if (updateStatus === 'latest' || updateStatus === 'error') {
      const t = setTimeout(() => setUpdateStatus('idle'), 3000);
      return () => clearTimeout(t);
    }
  }, [updateStatus]);
  useEffect(() => {
    void window.clinic?.update?.getVersion?.().then((ver: string) => {
      if (ver) setCurrentVersion(ver);
    });
  }, []);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  useEffect(() => {
    const cleanupProgress = window.clinic?.update?.onProgress?.((percent: number) => {
      setUpdateStatus('downloading');
      setDownloadProgress(percent);
    });

    const cleanupReady = window.clinic?.update?.onReady?.(() => {
      setUpdateStatus('ready');
    });

    return () => {
      cleanupProgress?.();
      cleanupReady?.();
    };
  }, []);
  const [prevMode, setPrevMode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

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

  async function handleCheckUpdate() {
    try {
      setUpdateStatus('checking');
      setDownloadProgress(0);

      if (!window.clinic?.update?.check) {
        console.error('Update IPC API not found');
        setUpdateStatus('error');
        return;
      }

      const result = await window.clinic.update.check();
      if (result === 'available') {
        setUpdateStatus('downloading');
      } else {
        setUpdateStatus(result || 'error');
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setUpdateStatus('error');
    }
  }

  function handleInstallUpdate() {
    void window.clinic?.update?.install();
  }

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => { setSettings(s); setPrevMode(s.serverMode); }).catch(() => {
      setSettings({ serverMode: 'local', clientApiUrl: '', lanPort: 3333, clinicName: '', clinicAddress: '', clinicPhone: '' });
    });
    void window.clinic?.settings.lanIp().then((ip) => setLanIp(ip));
  }, []);

  async function handleScan() {
    setScanning(true); setDiscovered([]); setTestResult(null);
    const servers = await window.clinic?.settings.scan();
    setDiscovered(servers ?? []);
    setScanning(false);
  }

  async function handleTestConnection() {
    if (!settings?.clientApiUrl) return;
    setTesting(true); setTestResult(null);
    const ok = await window.clinic?.settings.testConnection(settings.clientApiUrl);
    setTestResult(ok ?? false);
    setTesting(false);
  }

  async function handleSave() {
    if (!settings) return;
    const modeChanged = prevMode !== null && prevMode !== settings.serverMode;
    await window.clinic?.settings.save(settings);
    setPrevMode(settings.serverMode);
    if (modeChanged) {
      setSaved(true);
      setTimeout(() => void window.clinic?.settings.save(settings).then(() => window.location.reload()), 1200);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
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
        maxWidth: 1120,
        width: '100%',
        mx: 'auto',
      }}
    >
      {!settings ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
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
                onChange={(e) => setSettings((s) => s && ({ ...s, clinicName: e.target.value }))}
              />
              <TextField
                label="Address"
                size="small"
                fullWidth
                value={settings.clinicAddress}
                onChange={(e) => setSettings((s) => s && ({ ...s, clinicAddress: e.target.value }))}
              />
              <TextField
                label="Phone"
                size="small"
                fullWidth
                value={settings.clinicPhone}
                onChange={(e) => setSettings((s) => s && ({ ...s, clinicPhone: e.target.value }))}
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

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>App Update</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Check if a newer version is available.</Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Current Version:
              </Typography>
              <Chip label={`v${currentVersion}`} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600, height: 20 }} />
            </Stack>
            <Box sx={{ position: 'relative' }}>
              {/* Update Button State */}
              {updateStatus === 'ready' ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SystemUpdateAltOutlinedIcon />}
                  onClick={handleInstallUpdate}
                >
                  Restart & Install Update
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={updateStatus === 'checking' ? <CircularProgress size={16} /> : <SystemUpdateAltOutlinedIcon />}
                  disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  onClick={() => void handleCheckUpdate()}
                >
                  Check for Updates
                </Button>
              )}

              {/* Progress Bar & Status Messages */}
              <Box sx={{ mt: 1.5 }}>
                {updateStatus === 'downloading' && (
                  <Box sx={{ width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Downloading update...
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        {downloadProgress}%
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={downloadProgress} sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                )}

                {updateStatus === 'ready' && (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    Update downloaded! Click restart to apply.
                  </Alert>
                )}

                {updateStatus === 'latest' && (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    You're on the latest version.
                  </Alert>
                )}

                {updateStatus === 'error' && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    Could not check for updates. Check internet connection.
                  </Alert>
                )}
              </Box>
            </Box>
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
                value={settings.serverMode}
                exclusive
                onChange={(_e, val) => val && setSettings((s) => s && ({ ...s, serverMode: val as ServerMode }))}
                sx={{ gap: 1, flexWrap: 'wrap', width: '100%' }}
              >
                {([
                  { value: 'local', icon: <LaptopOutlinedIcon />, label: 'Standalone', desc: 'Only this machine, no sharing' },
                  { value: 'lan-server', icon: <DnsOutlinedIcon />, label: 'LAN Server', desc: 'Share data with other machines' },
                  { value: 'lan-client', icon: <DevicesOutlinedIcon />, label: 'LAN Client', desc: 'Connect to another machine' },
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
                      borderColor: settings.serverMode === value
                        ? `${theme.palette.primary.main} !important`
                        : 'divider !important',
                      bgcolor: settings.serverMode === value
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

            {settings.serverMode !== 'lan-client' && (
              <>
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
                  onChange={(e) => setSettings((s) => s && ({ ...s, lanPort: Number(e.target.value) }))}
                  size="small"
                  sx={{ maxWidth: 180 }}
                  helperText="Default: 3333"
                />
              </>
            )}

            {settings.serverMode === 'lan-client' && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<DevicesOutlinedIcon />}>
                  <Typography variant="body2" fontWeight={600}>LAN Client mode</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Scan for a server on your network, or enter the server URL manually.</Typography>
                </Alert>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={scanning ? <CircularProgress size={14} /> : <WifiTetheringOutlinedIcon />}
                    disabled={scanning}
                    onClick={() => void handleScan()}
                  >
                    Scan Network
                  </Button>
                  {discovered.length > 0 && (
                    <Typography variant="caption" color="text.secondary">{discovered.length} server(s) found</Typography>
                  )}
                </Stack>

                {discovered.length > 0 && (
                  <Stack spacing={0.5}>
                    {discovered.map((s) => (
                      <Chip
                        key={s.ip}
                        label={`${s.name} — http://${s.ip}:${s.port}`}
                        size="small"
                        clickable
                        onClick={() => {
                          setSettings((prev) => prev && ({ ...prev, clientApiUrl: `http://${s.ip}:${s.port}` }));
                          setTestResult(null);
                        }}
                        sx={{ fontFamily: 'monospace', justifyContent: 'flex-start' }}
                      />
                    ))}
                  </Stack>
                )}

                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label="Server URL"
                    size="small"
                    fullWidth
                    placeholder="http://192.168.1.x:3333"
                    value={settings.clientApiUrl}
                    onChange={(e) => { setSettings((s) => s && ({ ...s, clientApiUrl: e.target.value })); setTestResult(null); }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                    disabled={!settings.clientApiUrl || testing}
                    onClick={() => void handleTestConnection()}
                  >
                    {testing ? <CircularProgress size={14} /> : 'Test'}
                  </Button>
                </Stack>

                {testResult !== null && (
                  <Alert severity={testResult ? 'success' : 'error'}>
                    {testResult ? 'Connection successful!' : 'Could not reach server. Check the URL and firewall.'}
                  </Alert>
                )}
              </Stack>
            )}

            <Divider />

            <Stack direction="row" alignItems="center" spacing={2}>
              <Button variant="contained" onClick={() => void handleSave()}>
                Save Settings
              </Button>
              {saved && (
                <Alert severity="success" sx={{ py: 0.5 }}>
                  {settings.serverMode !== prevMode ? 'Saved! Restarting app...' : 'Saved!'}
                </Alert>
              )}
            </Stack>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}
