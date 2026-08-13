import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
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
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useUpdate } from '@/context/updateProvider';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules, useRefreshLicenseModules } from '@/features/auth/LicenseModulesContext';
import { PhoneInputField } from '@/components/PhoneInputField';
import { WhatsAppCampaignDialog } from '@/features/settings/WhatsAppCampaignDialog';
import {
  WhatsAppConnectMetaDialog,
  type ConnectMetaFormValues,
} from '@/features/settings/WhatsAppConnectMetaDialog';
import { launchWhatsAppEmbeddedSignup } from '@/features/settings/whatsappEmbeddedSignup';

type ServerMode = 'local' | 'lan-server' | 'lan-client';

interface Settings {
  serverMode: ServerMode;
  clientApiUrl: string;
  lanPort: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  databaseMode?: 'local' | 'online';
  clinicalApiUrl?: string;
  schemaId?: string;
  aiEnabled?: boolean;
  groqApiKey?: string;
  groqModel?: string;
  whatsappEnabled?: boolean;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappDisplayNumber?: string;
}

export function SettingsPage(): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const modules = useLicenseModules();
  const refreshLicenseModules = useRefreshLicenseModules();
  const { isOnline, schemaId, ready: databaseModeReady, refresh: refreshDatabaseMode } = useDatabaseMode();

  // Context Hook Integration for Global Auto-Updater State
  const {
    progress: downloadProgress,
    progressInfo,
    isChecking,
    isDownloading,
    isReady: isUpdateReady,
    error: updateError,
    checkForUpdates,
    installUpdate
  } = useUpdate();

  const downloadIndeterminate =
    isDownloading && (progressInfo.phase === 'starting' || downloadProgress <= 0);
  const downloadStatusText =
    downloadIndeterminate
      ? 'Preparing download…'
      : progressInfo.label
        ? `Downloading ${progressInfo.label}`
        : 'Downloading update...';

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [lanIp, setLanIp] = useState<string>('...');
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const [settingsTab, setSettingsTab] = useState<'general' | 'ai' | 'whatsapp' | 'backup'>('general');
  const [waTesting, setWaTesting] = useState(false);
  const [waTest, setWaTest] = useState<{ ok: boolean; name?: string; phone?: string; error?: string } | null>(null);
  const [waCampaignOpen, setWaCampaignOpen] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waConnectOpen, setWaConnectOpen] = useState(false);
  const [waConnectMsg, setWaConnectMsg] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [embeddedMeta, setEmbeddedMeta] = useState<{ configured: boolean; appId: string; configId: string } | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [prevMode, setPrevMode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  async function handleBackup() {
    setBackupLoading(true); setBackupStatus(null);
    const result = await window.clinic?.backup.create() as { ok?: boolean; canceled?: boolean; path?: string; mode?: string; error?: string } | undefined;
    setBackupLoading(false);
    if (result?.canceled) return;
    if (result?.ok) {
      const extra = result.mode === 'full' ? ' (database + documents)' : result.mode === 'db' ? ' (database only)' : '';
      setBackupStatus({ type: 'success', msg: `Backup saved${extra}: ${result.path ?? ''}` });
    } else {
      setBackupStatus({ type: 'error', msg: result?.error ?? 'Backup failed.' });
    }
  }

  async function handleRestore() {
    setRestoreLoading(true); setBackupStatus(null);
    const result = await window.clinic?.backup.restore() as { ok?: boolean; canceled?: boolean; mode?: string; error?: string } | undefined;
    setRestoreLoading(false);
    if (result?.canceled) return;
    if (result?.ok) {
      const extra = result.mode === 'full' ? ' Database and documents restored.' : ' Database restored.';
      setBackupStatus({ type: 'success', msg: `Restore successful!${extra} Please restart the app.` });
    } else {
      setBackupStatus({ type: 'error', msg: result?.error ?? 'Restore failed.' });
    }
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
    if (!databaseModeReady) return;
    void window.clinic?.settings.get().then((s) => {
      setSettings(s);
      setPrevMode(s.serverMode);
      if (!isOnline && s.serverMode === 'lan-client' && s.clientApiUrl) {
        void window.clinic?.settings.testConnection(s.clientApiUrl).then((ok) => setConnectionOk(ok ?? false));
      }
    }).catch(() => {
      setSettings({
        serverMode: 'local',
        clientApiUrl: '',
        lanPort: 3333,
        clinicName: '',
        clinicAddress: '',
        clinicPhone: '',
        databaseMode: 'local',
        aiEnabled: false,
        groqApiKey: '',
        groqModel: 'llama-3.1-8b-instant',
        whatsappEnabled: false,
        whatsappToken: '',
        whatsappPhoneNumberId: '',
        whatsappDisplayNumber: '',
      });
    });
    void window.clinic?.settings.lanIp().then((ip) => setLanIp(ip));
  }, [databaseModeReady, isOnline]);

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
    setSaving(true);
    try {
      const prev = await window.clinic?.settings.get();
      const needsRelaunch =
        (prevMode !== null && prevMode !== settings.serverMode) ||
        (prev?.lanPort !== settings.lanPort) ||
        (settings.serverMode === 'lan-client' && prev?.clientApiUrl !== settings.clientApiUrl);

      await window.clinic?.settings.save(settings);
      await refreshDatabaseMode();
      setPrevMode(settings.serverMode);

      if (needsRelaunch) {
        setRestarting(true);
        setSaved(true);
        setTimeout(() => {
          void window.clinic?.settings.relaunch?.();
        }, 900);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWhatsApp(): Promise<void> {
    if (!settings) return;
    setWaTesting(true);
    setWaTest(null);
    try {
      await window.clinic.settings.save(settings);
      const result = await window.clinic.whatsapp.test();
      setWaTest(result);
    } catch (err) {
      setWaTest({ ok: false, error: err instanceof Error ? err.message : 'Test failed.' });
    } finally {
      setWaTesting(false);
    }
  }

  useEffect(() => {
    void refreshLicenseModules();
  }, [refreshLicenseModules]);

  useEffect(() => {
    if (settingsTab === 'ai' && modules.ai !== true) setSettingsTab('general');
    if (settingsTab === 'whatsapp' && modules.whatsapp !== true) setSettingsTab('general');
  }, [modules.ai, modules.whatsapp, settingsTab]);

  useEffect(() => {
    if (settingsTab !== 'whatsapp') return;
    void window.clinic.whatsapp.embeddedConfig().then(setEmbeddedMeta).catch(() => {
      setEmbeddedMeta({ configured: false, appId: '', configId: '' });
    });
  }, [settingsTab]);

  async function handleConnectWithMeta(values: ConnectMetaFormValues): Promise<void> {
    if (!settings) return;
    setWaConnectOpen(false);
    setWaConnecting(true);
    setWaConnectMsg(null);
    setWaTest(null);
    try {
      const cfg = embeddedMeta ?? (await window.clinic.whatsapp.embeddedConfig());
      setEmbeddedMeta(cfg);
      if (!cfg.configured) {
        setWaConnectMsg({
          type: 'error',
          msg: 'Set META_APP_ID, META_APP_SECRET, and META_EMBEDDED_CONFIG_ID in .env, then restart the app.',
        });
        return;
      }

      const launched = await launchWhatsAppEmbeddedSignup({
        appId: cfg.appId,
        configId: cfg.configId,
        clinic: {
          clinicName: settings.clinicName,
          clinicAddress: settings.clinicAddress,
          clinicPhone: settings.clinicPhone || settings.whatsappDisplayNumber,
          email: values.email,
          website: values.website,
        },
      });
      if (!launched.ok) {
        setWaConnectMsg({
          type: launched.canceled ? 'info' : 'error',
          msg: launched.error,
        });
        return;
      }

      const exchanged = await window.clinic.whatsapp.embeddedExchange({
        code: launched.code,
        phoneNumberId: launched.session.phoneNumberId,
        wabaId: launched.session.wabaId,
      });
      if (!exchanged.success || !exchanged.token || !exchanged.phoneNumberId) {
        setWaConnectMsg({
          type: 'error',
          msg: exchanged.error || 'Failed to exchange Meta authorization code.',
        });
        return;
      }

      setSettings((s) =>
        s
          ? {
              ...s,
              whatsappEnabled: true,
              whatsappToken: exchanged.token!,
              whatsappPhoneNumberId: exchanged.phoneNumberId!,
              whatsappDisplayNumber:
                exchanged.displayNumber || s.whatsappDisplayNumber || '',
            }
          : s,
      );
      setWaConnectMsg({
        type: 'success',
        msg: 'Connected with Meta — token and Phone Number ID filled. Click Save Settings.',
      });
    } catch (err) {
      setWaConnectMsg({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Connect with Meta failed.',
      });
    } finally {
      setWaConnecting(false);
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
                startIcon={<SystemUpdateAltOutlinedIcon />}
                loading={updateStatus === 'checking' || isChecking}
                disabled={isDownloading}
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
                    {downloadStatusText}
                  </Typography>
                  <Typography variant="caption" color="primary.main" fontWeight={700}>
                    {downloadIndeterminate ? '…' : `${downloadProgress}%`}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant={downloadIndeterminate ? 'indeterminate' : 'determinate'}
                  value={downloadIndeterminate ? undefined : downloadProgress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
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
        height: 'calc(100vh - 20px)',
        maxHeight: 'calc(100vh - 20px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!settings ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={0} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Tabs
            value={settingsTab}
            onChange={(_, v: 'general' | 'ai' | 'whatsapp' | 'backup') => setSettingsTab(v)}
            sx={{
              mb: 3,
              minHeight: 44,
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
              '& .MuiTab-root': {
                minHeight: 44,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 14,
                gap: 0.75,
              },
            }}
          >
            <Tab
              value="general"
              icon={<TuneOutlinedIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="General"
            />
            {modules.ai === true && (
              <Tab
                value="ai"
                icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="AI"
              />
            )}
            {modules.whatsapp === true && (
              <Tab
                value="whatsapp"
                icon={<WhatsAppIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="WhatsApp"
              />
            )}
            <Tab
              value="backup"
              icon={<BackupOutlinedIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Backup & Restore"
            />
          </Tabs>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              pr: 0.5,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 99 },
            }}
          >
          {settingsTab === 'general' && (
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
                  <PhoneInputField
                    label="Phone"
                    size="small"
                    value={settings.clinicPhone}
                    onChange={(digits) => setSettings((s) => s && ({ ...s, clinicPhone: digits }))}
                  />
                </Stack>

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
                      startIcon={<SystemUpdateAltOutlinedIcon />}
                      loading={updateStatus === 'checking' || isChecking}
                      disabled={isDownloading}
                      onClick={() => void handleCheckUpdate()}
                    >
                      {(updateStatus === 'checking' || isChecking) ? 'Checking...' : 'Check for Updates'}
                    </Button>
                  )}

                  {isDownloading && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {downloadStatusText}
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          {downloadIndeterminate ? '…' : `${downloadProgress}%`}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant={downloadIndeterminate ? 'indeterminate' : 'determinate'}
                        value={downloadIndeterminate ? undefined : downloadProgress}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
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
                    {isOnline
                      ? 'This license uses online Postgres — LAN roles are disabled.'
                      : 'Configure how this machine connects to the clinic network.'}
                  </Typography>
                  {isOnline && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                      Online database mode is active
                      {schemaId ? ` (tenant ${schemaId})` : ''}.
                      Clinic data is stored in the shared cloud schema, filtered per license.
                    </Alert>
                  )}
                  {!isOnline && settings?.serverMode === 'lan-client' && connectionOk === false && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      LAN server unreachable. App has fallen back to local mode. Please check the server URL and save again.
                    </Alert>
                  )}
                </Box>

                {isOnline ? null : (
                <>
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
                        startIcon={<WifiTetheringOutlinedIcon />}
                        loading={scanning}
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
                        disabled={!settings.clientApiUrl}
                        loading={testing}
                        onClick={() => void handleTestConnection()}
                      >
                        Test
                      </Button>
                    </Stack>

                    {testResult !== null && (
                      <Alert severity={testResult ? 'success' : 'error'}>
                        {testResult ? 'Connection successful!' : 'Could not reach server. Check the URL and firewall.'}
                      </Alert>
                    )}
                  </Stack>
                )}
                </>
                )}
              </Stack>
            </Stack>
          )}

          {settingsTab === 'ai' && modules.ai === true && (
            <Box sx={{ maxWidth: 480 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>AI Assist (Groq)</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Free Groq API for prescription drafts and patient history summaries. Get a key at console.groq.com — no model install on each PC.
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(settings.aiEnabled)}
                      onChange={(e) => setSettings((s) => s && ({ ...s, aiEnabled: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Enable AI features"
                />
                <TextField
                  label="Groq API key"
                  size="small"
                  fullWidth
                  type="password"
                  autoComplete="off"
                  value={settings.groqApiKey || ''}
                  onChange={(e) => setSettings((s) => s && ({ ...s, groqApiKey: e.target.value }))}
                  disabled={!settings.aiEnabled}
                  placeholder="gsk_..."
                />
                <TextField
                  label="Model"
                  size="small"
                  fullWidth
                  value={settings.groqModel || 'llama-3.1-8b-instant'}
                  onChange={(e) => setSettings((s) => s && ({ ...s, groqModel: e.target.value }))}
                  disabled={!settings.aiEnabled}
                  helperText="Default: llama-3.1-8b-instant"
                />
              </Stack>
            </Box>
          )}

          {settingsTab === 'whatsapp' && modules.whatsapp === true && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <WhatsAppIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>WhatsApp (this clinic)</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Har clinic ki apni Meta Cloud API. Patient add/delete pe number automatically WhatsApp pe lag jata hai / hat jata hai — yahan table nahi.
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 520, mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(settings.whatsappEnabled)}
                      onChange={(e) => setSettings((s) => s && ({ ...s, whatsappEnabled: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Enable WhatsApp for this clinic"
                />

                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={waConnecting ? <CircularProgress size={16} color="inherit" /> : <LoginOutlinedIcon />}
                    disabled={!settings.whatsappEnabled || waConnecting}
                    onClick={() => {
                      setWaConnectMsg(null);
                      setWaConnectOpen(true);
                    }}
                    sx={{ alignSelf: 'flex-start', bgcolor: '#1877F2', '&:hover': { bgcolor: '#166fe5' } }}
                  >
                    {waConnecting ? 'Connecting…' : 'Connect with Meta'}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Connect with Meta = asli number, OTP, card, token. Popup mein existing CareFlow WhatsApp account mat select karo — naya account + naya profile banao.
                  </Typography>
                  {waConnectMsg && (
                    <Alert severity={waConnectMsg.type} onClose={() => setWaConnectMsg(null)} sx={{ py: 0.25 }}>
                      {waConnectMsg.msg}
                    </Alert>
                  )}
                  {embeddedMeta && !embeddedMeta.configured && (
                    <Alert severity="warning" sx={{ py: 0.25 }}>
                      Embedded Signup env missing — manual fields neeche use kar sakte hain.
                    </Alert>
                  )}
                </Stack>

                <PhoneInputField
                  label="Clinic WhatsApp number"
                  size="small"
                  value={settings.whatsappDisplayNumber || ''}
                  onChange={(digits) =>
                    setSettings((s) => s && ({ ...s, whatsappDisplayNumber: digits }))
                  }
                  disabled={!settings.whatsappEnabled}
                  helperText="Flag country code auto. PK → 92300… · US test → 1555… (bina +)"
                />
                <TextField
                  label="Phone Number ID"
                  size="small"
                  fullWidth
                  value={settings.whatsappPhoneNumberId || ''}
                  onChange={(e) => setSettings((s) => s && ({ ...s, whatsappPhoneNumberId: e.target.value }))}
                  disabled={!settings.whatsappEnabled}
                  placeholder="Meta WhatsApp Phone Number ID"
                  helperText="Connect with Meta ke baad auto-fill"
                />
                <TextField
                  label="Access token"
                  size="small"
                  fullWidth
                  type="password"
                  autoComplete="off"
                  value={settings.whatsappToken || ''}
                  onChange={(e) => setSettings((s) => s && ({ ...s, whatsappToken: e.target.value }))}
                  disabled={!settings.whatsappEnabled}
                  helperText="Connect with Meta auto-fill karta hai. Expire ho to button dubara dabao."
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    disabled={!settings.whatsappEnabled || waTesting}
                    onClick={() => void handleTestWhatsApp()}
                  >
                    {waTesting ? 'Testing…' : 'Test connection'}
                  </Button>
                  {waTest && (
                    <Alert severity={waTest.ok ? 'success' : 'error'} sx={{ py: 0.25, flex: 1 }}>
                      {waTest.ok
                        ? `Connected${waTest.name ? ` — ${waTest.name}` : ''}${waTest.phone ? ` (${waTest.phone})` : ''}`
                        : waTest.error}
                    </Alert>
                  )}
                </Stack>
              </Stack>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Campaign
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Doctor + visit date choose karein, text/image likhein — message un tamam patients ko jaye ga jinke WhatsApp numbers hain.
              </Typography>
              <Button
                variant="contained"
                startIcon={<CampaignOutlinedIcon />}
                disabled={!settings.whatsappEnabled}
                onClick={() => setWaCampaignOpen(true)}
              >
                New campaign
              </Button>
            </Box>
          )}

          {settingsTab === 'backup' && (
            <Box sx={{ maxWidth: 560 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <BackupOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>Backup & Restore</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Full backup (.zip) includes the database plus patient/lab documents so images and PDFs work after restore on another PC. Legacy .db-only backups are still supported.
              </Typography>
              {isOnline ? (
                <Alert severity="info">
                  Online database mode — clinic data lives in the cloud (Neon). Local Backup & Restore is disabled because it only copies the offline SQLite file.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" gap={1.5} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      startIcon={<BackupOutlinedIcon />}
                      loading={backupLoading}
                      onClick={() => void handleBackup()}
                    >
                      Create Backup
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<RestoreOutlinedIcon />}
                      loading={restoreLoading}
                      onClick={() => void handleRestore()}
                    >
                      Restore Backup
                    </Button>
                  </Stack>
                  {backupStatus && <Alert severity={backupStatus.type}>{backupStatus.msg}</Alert>}
                </Stack>
              )}
            </Box>
          )}
          </Box>

          <Divider sx={{ my: 3, flexShrink: 0 }} />

          <Stack direction="row" alignItems="center" spacing={2} sx={{ flexShrink: 0 }}>
            <Button variant="contained" loading={saving} onClick={() => void handleSave()}>
              Save Settings
            </Button>
            {saved && (
              <Alert severity="success" sx={{ py: 0.5 }}>
                {restarting ? 'Saved! Restarting app...' : 'Saved!'}
              </Alert>
            )}
          </Stack>
        </Stack>
      )}

      <WhatsAppConnectMetaDialog
        open={waConnectOpen}
        connecting={waConnecting}
        onClose={() => setWaConnectOpen(false)}
        onSubmit={handleConnectWithMeta}
      />

      <WhatsAppCampaignDialog
        open={waCampaignOpen}
        onClose={() => setWaCampaignOpen(false)}
        clinicName={settings?.clinicName || ''}
        enabled={Boolean(settings?.whatsappEnabled)}
      />

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