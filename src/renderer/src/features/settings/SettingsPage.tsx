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
  Snackbar,
} from '@mui/material';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import LaptopOutlinedIcon from '@mui/icons-material/LaptopOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import BackupOutlinedIcon from '@mui/icons-material/BackupOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import SystemUpdateAltOutlinedIcon from '@mui/icons-material/SystemUpdateAltOutlined';
import WifiTetheringOutlinedIcon from '@mui/icons-material/WifiTetheringOutlined';
import { useUpdate } from '@/context/updateProvider';
import { useAuth } from '@/features/auth/AuthContext';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Context Hook Integration for Global Auto-Updater State
  const {
    progress: downloadProgress,
    isChecking,
    isDownloading,
    isReady: isUpdateReady,
    error: updateError,
    checkForUpdates,
    installUpdate
  } = useUpdate();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [lanIp, setLanIp] = useState<string>('...');
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Update States & Notifications
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [toastMessage, setToastMessage] = useState<{ msg: string; severity: 'info' | 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    void window.clinic?.update?.getVersion?.().then((ver: string) => {
      if (ver) setCurrentVersion(ver);
    });
  }, []);

  // Listen to Context downloading & error state changes dynamically
  useEffect(() => {
    if (isUpdateReady) {
      setToastMessage({
        msg: 'Update downloaded successfully! Click "Restart & Install Update".',
        severity: 'success',
      });
    }
  }, [isUpdateReady]);

  useEffect(() => {
    if (updateError) {
      setToastMessage({
        msg: `Update Error: ${updateError}`,
        severity: 'error',
      });
      setUpdateStatus('error');
    }
  }, [updateError]);

  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
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

  // Update Check & Download Handlers
  async function handleCheckUpdate() {
    try {
      setUpdateStatus('checking');
      setToastMessage({ msg: 'Checking for updates...', severity: 'info' });

      const res = await checkForUpdates();

      if (res === 'available' || (typeof res === 'object' && res?.updateInfo)) {
        setUpdateStatus('available');
        setToastMessage({ msg: 'New update found! Downloading in background...', severity: 'info' });
      } else if (res === 'latest') {
        setUpdateStatus('latest');
        setToastMessage({ msg: `You are on the latest version (v${currentVersion}).`, severity: 'success' });
      } else if (typeof res === 'object' && res?.error) {
        setUpdateStatus('error');
        setToastMessage({ msg: `Update check failed: ${res.error}`, severity: 'error' });
      } else {
        setUpdateStatus('latest');
        setToastMessage({ msg: `App is up to date (v${currentVersion}).`, severity: 'info' });
      }
    } catch (err: any) {
      console.error('Failed to check or download update:', err);
      setUpdateStatus('error');
      setToastMessage({
        msg: err?.message || 'Error occurred while checking update.',
        severity: 'error'
      });
    } finally {
      setTimeout(() => {
        setUpdateStatus((current) => (current === 'checking' ? 'idle' : current));
      }, 4000);
    }
  }

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => {
      setSettings(s);
      setPrevMode(s.serverMode);
      if (s.serverMode === 'lan-client' && s.clientApiUrl) {
        void window.clinic?.settings.testConnection(s.clientApiUrl).then((ok) => setConnectionOk(ok ?? false));
      }
    }).catch(() => {
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

  if (!isAdmin) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          width: '100%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            maxWidth: 480,
            width: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
          }}
        >
          <Typography variant="h6" fontWeight={700} textAlign="center" sx={{ mb: 0.5 }}>
            Software Update
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            Check for software updates and install the latest version of CareFlow.
          </Typography>

          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary">Current Version:</Typography>
            <Chip label={`v${currentVersion}`} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600, height: 22 }} />
          </Stack>

          <Box sx={{ width: '100%' }}>
            {isUpdateReady ? (
              <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                startIcon={<SystemUpdateAltOutlinedIcon />}
                onClick={installUpdate}
              >
                Restart & Install Update
              </Button>
            ) : (
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={(updateStatus === 'checking' || isChecking) ? <CircularProgress size={16} /> : <SystemUpdateAltOutlinedIcon />}
                disabled={updateStatus === 'checking' || isChecking || isDownloading}
                onClick={() => void handleCheckUpdate()}
              >
                {(updateStatus === 'checking' || isChecking) ? 'Checking...' : 'Check for Updates'}
              </Button>
            )}

            {/* Downloading Linear Progress */}
            {isDownloading && (
              <Box sx={{ width: '100%', mt: 2.5 }}>
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
          </Box>

          {/* Primary Notification Toast / Snackbar for Updates & Dynamic Errors */}
          <Snackbar
            open={Boolean(toastMessage)}
            autoHideDuration={4000}
            onClose={() => setToastMessage(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            {toastMessage ? (
              <Alert severity={toastMessage.severity} onClose={() => setToastMessage(null)}>
                {toastMessage.msg}
              </Alert>
            ) : undefined}
          </Snackbar>
        </Paper>
      </Box>
    );
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
          {/* Left Side: Clinic Info, Backup & App Update */}
          <Box sx={{ width: 280, flexShrink: 0 }}>
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
            <Stack direction="row" gap={1.5} flexWrap="wrap">
              <Button variant="outlined" size="small" startIcon={backupLoading ? <CircularProgress size={14} /> : <BackupOutlinedIcon />} disabled={backupLoading} onClick={() => void handleBackup()}>
                Create Backup
              </Button>
              <Button variant="outlined" size="small" color="warning" startIcon={restoreLoading ? <CircularProgress size={14} /> : <RestoreOutlinedIcon />} disabled={restoreLoading} onClick={() => void handleRestore()}>
                Restore Backup
              </Button>
            </Stack>
            {backupStatus && <Alert severity={backupStatus.type} sx={{ mt: 2 }}>{backupStatus.msg}</Alert>}

            <Divider sx={{ my: 2 }} />

            {/* App Update Section */}
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>App Update</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Check if a newer version is available on GitHub.</Typography>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Current Version:</Typography>
              <Chip label={`v${currentVersion}`} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600, height: 22 }} />
            </Stack>

            <Box sx={{ width: '100%' }}>
              {isUpdateReady ? (
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<SystemUpdateAltOutlinedIcon />}
                  onClick={installUpdate}
                >
                  Restart & Install Update
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={(updateStatus === 'checking' || isChecking) ? <CircularProgress size={16} /> : <SystemUpdateAltOutlinedIcon />}
                  disabled={updateStatus === 'checking' || isChecking || isDownloading}
                  onClick={() => void handleCheckUpdate()}
                >
                  {(updateStatus === 'checking' || isChecking) ? 'Checking...' : 'Check for Updates'}
                </Button>
              )}

              {/* Downloading Linear Progress */}
              {isDownloading && (
                <Box sx={{ width: '100%', mt: 2 }}>
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
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Right Side: Network Settings */}
          <Stack spacing={3} flex={1}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Network Settings</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Configure how this machine connects to the clinic network.
              </Typography>
              {settings.serverMode === 'lan-client' && connectionOk === false && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  LAN server unreachable. App has fallen back to local mode. Please check the server URL and save again.
                </Alert>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Machine Role</Typography>
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

      {/* Primary Notification Toast / Snackbar for Updates & Dynamic Errors */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toastMessage ? (
          <Alert severity={toastMessage.severity} onClose={() => setToastMessage(null)} >
            {toastMessage.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Paper>
  );
}