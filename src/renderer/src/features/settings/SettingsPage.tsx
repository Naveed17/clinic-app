import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Stack,
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
import { useUpdate } from '@/context/updateProvider';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense, useRefreshLicenseModules } from '@/features/auth/LicenseModulesContext';
import { PhoneInputField } from '@/components/PhoneInputField';
import { showAppToast } from '@/components/AppToast';
import { WhatsAppCampaignDialog } from '@/features/settings/WhatsAppCampaignDialog';
import { fileToClinicLogoDataUrl } from '@/utils/avatarImage';
import { invalidateClinicLogoCache, notifyClinicBrandChanged, resolveClinicLogoSrc } from '@/utils/clinicBrandLogo';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

type ServerMode = 'local' | 'lan-server' | 'lan-client';

interface Settings {
  serverMode: ServerMode;
  clientApiUrl: string;
  lanPort: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicLogo?: string;
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
  const { can } = useLicense();
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
  const [lanIp, setLanIp] = useState<string>('...');
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');

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
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTest, setAiTest] = useState<{ ok: boolean; error?: string } | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [prevMode, setPrevMode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  async function handleBackup() {
    setBackupLoading(true);
    const result = await window.clinic?.backup.create() as { ok?: boolean; canceled?: boolean; path?: string; mode?: string; error?: string } | undefined;
    setBackupLoading(false);
    if (result?.canceled) return;
    if (result?.ok) {
      const extra = result.mode === 'full' ? ' (database + documents)' : result.mode === 'db' ? ' (database only)' : '';
      showAppToast({ type: 'success', message: `Backup saved${extra}` });
    } else {
      showAppToast({ type: 'error', message: result?.error ?? 'Backup failed.' });
    }
  }

  async function handleRestore() {
    setRestoreLoading(true);
    const result = await window.clinic?.backup.restore() as { ok?: boolean; canceled?: boolean; mode?: string; error?: string } | undefined;
    setRestoreLoading(false);
    if (result?.canceled) return;
    if (result?.ok) {
      showAppToast({ type: 'success', message: 'Restore successful. Please restart the app.' });
    } else {
      showAppToast({ type: 'error', message: result?.error ?? 'Restore failed.' });
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
        clinicLogo: '',
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
      invalidateClinicLogoCache();
      notifyClinicBrandChanged();
      await refreshDatabaseMode();
      setPrevMode(settings.serverMode);

      if (needsRelaunch) {
        showAppToast({ type: 'success', message: 'Settings saved — restarting…' });
        setTimeout(() => {
          void window.clinic?.settings.relaunch?.();
        }, 900);
      } else {
        showAppToast({ type: 'success', message: 'Settings saved' });
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

  async function handleTestAi(): Promise<void> {
    if (!settings) return;
    setAiTesting(true);
    setAiTest(null);
    try {
      await window.clinic.settings.save(settings);
      const result = await window.clinic.ai.test();
      setAiTest(result);
    } catch (err) {
      setAiTest({ ok: false, error: err instanceof Error ? err.message : 'Test failed.' });
    } finally {
      setAiTesting(false);
    }
  }

  useEffect(() => {
    void refreshLicenseModules();
  }, [refreshLicenseModules]);

  useEffect(() => {
    if (settingsTab === 'ai' && !can('ai')) setSettingsTab('general');
    if (settingsTab === 'whatsapp' && !can('whatsapp')) setSettingsTab('general');
  }, [can, settingsTab]);

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
        <Stack spacing={2} sx={{ py: 2 }}>
          <Skeleton variant="rounded" height={48} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />
        </Stack>
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
            {can('ai') && (
              <Tab
                value="ai"
                icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="AI"
              />
            )}
            {can('whatsapp') && (
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {isOnline
                    ? 'Name, contact, and logo on prints. Saved to the cloud so every online PC shares the same clinic profile.'
                    : 'Name, contact, and logo on prints, receipts, and the app sidebar.'}
                </Typography>
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
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                      Clinic logo
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: '#fff',
                          overflow: 'hidden',
                          p: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          component="img"
                          src={resolveClinicLogoSrc(settings.clinicLogo)}
                          alt="Clinic logo"
                          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ImageOutlinedIcon />}
                            onClick={() => logoInputRef.current?.click()}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                          >
                            {settings.clinicLogo ? 'Change' : 'Upload'}
                          </Button>
                          {settings.clinicLogo ? (
                            <Button
                              size="small"
                              onClick={() => { setSettings((s) => s && ({ ...s, clinicLogo: '' })); setLogoError(''); }}
                              sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                              Use CareFlow
                            </Button>
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Optional. If you skip this, the CareFlow logo stays everywhere.
                        </Typography>
                        {logoError ? (
                          <Typography variant="caption" color="error" display="block">{logoError}</Typography>
                        ) : null}
                      </Box>
                    </Stack>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        void fileToClinicLogoDataUrl(file)
                          .then((dataUrl) => {
                            setLogoError('');
                            setSettings((s) => s && ({ ...s, clinicLogo: dataUrl }));
                          })
                          .catch((err: unknown) => {
                            setLogoError(err instanceof Error ? err.message : 'Unable to use that image.');
                          });
                      }}
                    />
                  </Box>
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

          {settingsTab === 'ai' && can('ai') && (
            <Box sx={{ maxWidth: 520 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>AI Assist (add-on)</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Paid add-on. Prescription drafts and history summaries use CareFlow&apos;s hosted model.
                Clinics without this add-on do not see AI buttons.
              </Typography>
              <Stack spacing={2}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  This clinic&apos;s license includes the AI add-on. No API key is stored on this PC.
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    disabled={aiTesting}
                    onClick={() => void handleTestAi()}
                  >
                    {aiTesting ? 'Testing…' : 'Test connection'}
                  </Button>
                  {aiTest && (
                    <Alert severity={aiTest.ok ? 'success' : 'error'} sx={{ py: 0.25, flex: 1 }}>
                      {aiTest.ok ? 'CareFlow AI is ready.' : aiTest.error}
                    </Alert>
                  )}
                </Stack>
              </Stack>
            </Box>
          )}

          {settingsTab === 'whatsapp' && can('whatsapp') && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <WhatsAppIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>WhatsApp Cloud API (add-on)</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Paid add-on for in-app send, documents, and campaigns from CareFlow&apos;s shared number.
                Without this add-on, WhatsApp still opens WhatsApp Web (wa.me) as usual.
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 520, mb: 3 }}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  This clinic&apos;s license includes the WhatsApp Cloud API add-on. No Meta token is stored on this PC.
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    disabled={waTesting}
                    onClick={() => void handleTestWhatsApp()}
                  >
                    {waTesting ? 'Testing…' : 'Test connection'}
                  </Button>
                  {waTest && (
                    <Alert severity={waTest.ok ? 'success' : 'error'} sx={{ py: 0.25, flex: 1 }}>
                      {waTest.ok
                        ? `CareFlow WhatsApp ready${waTest.name ? ` — ${waTest.name}` : ''}${waTest.phone ? ` (${waTest.phone})` : ''}`
                        : waTest.error}
                    </Alert>
                  )}
                </Stack>
              </Stack>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Campaign
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Choose a doctor and visit date, then write text or add an image. The message is sent to every patient with a WhatsApp number.
              </Typography>
              <Button
                variant="contained"
                startIcon={<CampaignOutlinedIcon />}
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
          </Stack>
        </Stack>
      )}

      <WhatsAppCampaignDialog
        open={waCampaignOpen}
        onClose={() => setWaCampaignOpen(false)}
        clinicName={settings?.clinicName || ''}
        enabled={can('whatsapp')}
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