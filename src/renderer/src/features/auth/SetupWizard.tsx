import { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, List, ListItemButton,
  ListItemText, Paper, Stack, Step, StepLabel, Stepper,
  TextField, Typography, useTheme,
} from '@mui/material';
import LaptopOutlinedIcon from '@mui/icons-material/LaptopOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import WifiTetheringOutlinedIcon from '@mui/icons-material/WifiTetheringOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';

type Mode = 'local' | 'lan-server' | 'lan-client';

const STEPS = ['Welcome', 'Machine Role', 'Done'];

export function SetupWizard({ onDone }: { onDone: () => void }): React.JSX.Element {
  const theme = useTheme();

  const [step, setStep] = useState(0);
  const [clinicName, setClinicName] = useState('');
  const [mode, setMode] = useState<Mode>('local');
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleScan() {
    setScanning(true);
    setDiscovered([]);
    const list = await window.clinic?.settings.scan();
    setDiscovered(list ?? []);
    setScanning(false);
  }

  async function handleFinish() {
    setSaving(true);
    setError('');
    const url = selectedUrl || manualUrl;

    if (mode === 'lan-client' && !url) {
      setError('Please select or enter a server URL.');
      setSaving(false);
      return;
    }

    await window.clinic?.settings.save({
      clinicName: clinicName.trim() || 'Clinic',
      serverMode: mode,
      ...(mode === 'lan-client' ? { clientApiUrl: url } : {}),
      setupDone: true,
    });

    onDone();
    // Relaunch so main process applies serverMode (backend bind / client skip)
    if (window.clinic?.settings.relaunch) {
      await window.clinic.settings.relaunch();
    } else {
      window.location.reload();
    }
  }

  const roles: { value: Mode; icon: React.ReactNode; label: string; desc: string }[] = [
    { value: 'local', icon: <LaptopOutlinedIcon />, label: 'Standalone', desc: 'Single machine, no network sharing' },
    { value: 'lan-server', icon: <DnsOutlinedIcon />, label: 'LAN Server', desc: 'This machine hosts the database' },
    { value: 'lan-client', icon: <DevicesOutlinedIcon />, label: 'LAN Client', desc: 'Connect to another machine' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 520 }}>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalHospitalOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography fontWeight={800} fontSize={20}>CareFlow Setup</Typography>
        </Stack>

        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6">Welcome to CareFlow</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Let's set up your clinic in a few steps.
              </Typography>
            </Box>
            <TextField
              label="Clinic Name"
              placeholder="e.g. Care Clinic"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && clinicName.trim() && setStep(1)}
              fullWidth
              autoFocus
            />
            <Button variant="contained" disabled={!clinicName.trim()} onClick={() => setStep(1)}>
              Next
            </Button>
          </Stack>
        )}

        {/* Step 1: Machine Role */}
        {step === 1 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6">Machine Role</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                How will this machine be used?
              </Typography>
            </Box>

            <Stack spacing={1}>
              {roles.map(({ value, icon, label, desc }) => {
                const selected = mode === value;
                return (
                  <ListItemButton
                    key={value}
                    selected={selected}
                    onClick={() => { setMode(value); setSelectedUrl(''); setDiscovered([]); setError(''); }}
                    sx={{
                      borderRadius: `${theme.shape.borderRadius}px`,
                      border: '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? `${theme.palette.primary.main}14` : 'transparent',
                      '&.Mui-selected': { bgcolor: `${theme.palette.primary.main}14` },
                      '&.Mui-selected:hover': { bgcolor: `${theme.palette.primary.main}1f` },
                    }}
                  >
                    <Box sx={{ mr: 1.5, color: selected ? 'primary.main' : 'text.secondary', display: 'flex' }}>{icon}</Box>
                    <ListItemText
                      primary={<Typography fontWeight={selected ? 700 : 400} variant="body2">{label}</Typography>}
                      secondary={desc}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                    {selected && <CheckCircleOutlineIcon color="primary" fontSize="small" />}
                  </ListItemButton>
                );
              })}
            </Stack>

            {/* LAN Client: scan panel */}
            {mode === 'lan-client' && (
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Find server on network:</Typography>
                  <Button
                    size="small"
                    startIcon={scanning ? <CircularProgress size={12} color="inherit" /> : <WifiTetheringOutlinedIcon />}
                    disabled={scanning}
                    onClick={() => void handleScan()}
                  >
                    {scanning ? 'Scanning...' : 'Scan'}
                  </Button>
                </Stack>

                {discovered.length > 0 && (
                  <List disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: `${theme.shape.borderRadius}px`, overflow: 'hidden' }}>
                    {discovered.map((s) => {
                      const url = `http://${s.ip}:${s.port}`;
                      const sel = selectedUrl === url;
                      return (
                        <ListItemButton
                          key={s.ip}
                          selected={sel}
                          onClick={() => { setSelectedUrl(url); setManualUrl(''); }}
                          sx={{
                            '&.Mui-selected': { bgcolor: `${theme.palette.primary.main}14` },
                            '&.Mui-selected:hover': { bgcolor: `${theme.palette.primary.main}1f` },
                          }}
                        >
                          <DnsOutlinedIcon sx={{ mr: 1.5, fontSize: 18, color: sel ? 'primary.main' : 'text.secondary' }} />
                          <ListItemText
                            primary={s.name}
                            secondary={url}
                            primaryTypographyProps={{ fontSize: 13, fontWeight: sel ? 700 : 400 }}
                            secondaryTypographyProps={{ fontFamily: 'monospace', fontSize: 11 }}
                          />
                          {sel && <CheckCircleOutlineIcon color="primary" fontSize="small" />}
                        </ListItemButton>
                      );
                    })}
                  </List>
                )}

                {discovered.length === 0 && !scanning && (
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    No servers found. Click Scan or enter URL manually.
                  </Typography>
                )}

                <TextField
                  label="Or enter server URL manually"
                  placeholder="http://192.168.1.x:3333"
                  size="small"
                  value={manualUrl}
                  onChange={(e) => { setManualUrl(e.target.value); setSelectedUrl(''); }}
                />
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setStep(0)}>Back</Button>
              <Button variant="contained" sx={{ flex: 1 }} onClick={() => setStep(2)}>Next</Button>
            </Stack>
          </Stack>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: `${theme.palette.success.main}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
            <Box>
              <Typography variant="h6">All Set!</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                <strong>{clinicName}</strong> is configured as{' '}
                <strong>{mode === 'local' ? 'Standalone' : mode === 'lan-server' ? 'LAN Server' : 'LAN Client'}</strong>.
              </Typography>
              {mode === 'lan-client' && (selectedUrl || manualUrl) && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                  {selectedUrl || manualUrl}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} width="100%">
              <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
              <Button variant="contained" sx={{ flex: 1 }} disabled={saving} onClick={() => void handleFinish()}>
                {saving ? <CircularProgress size={20} color="inherit" /> : 'Finish & Launch'}
              </Button>
            </Stack>
          </Stack>
        )}

      </Paper>
    </Box>
  );
}
