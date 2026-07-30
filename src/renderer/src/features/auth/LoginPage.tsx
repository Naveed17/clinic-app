import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/* ── Animated galaxy canvas ── */
function GalaxyCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.3,
      alpha: Math.random(),
      speed: Math.random() * 0.008 + 0.003,
      dir: Math.random() > 0.5 ? 1 : -1,
    }));

    const orbs = [
      { x: 0.15, y: 0.25, r: 320, color: '20,180,120' },
      { x: 0.82, y: 0.6, r: 280, color: '80,60,200' },
      { x: 0.5, y: 0.85, r: 240, color: '0,140,255' },
      { x: 0.7, y: 0.1, r: 200, color: '160,40,220' },
    ];

    let raf: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#050a14';
      ctx.fillRect(0, 0, w, h);
      orbs.forEach((o) => {
        const grd = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r);
        grd.addColorStop(0, `rgba(${o.color},0.18)`);
        grd.addColorStop(1, `rgba(${o.color},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      });
      stars.forEach((s) => {
        s.alpha += s.speed * s.dir;
        if (s.alpha >= 1 || s.alpha <= 0.1) s.dir *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  );
}

/* ── Login Page ── */
export function LoginPage(): React.JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(() => {
    const message = sessionStorage.getItem('clinic-auth-error') || '';
    sessionStorage.removeItem('clinic-auth-error');
    return message;
  });
  const [loading, setLoading] = useState(false);

  // Server discovery
  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => {
      if (s.serverMode === 'lan-client' && s.clientApiUrl) setConnected(true);
    });
    const unsub = window.clinic?.settings.onServerFound((server) => {
      setDiscovered((prev) => prev.find((s) => s.ip === server.ip) ? prev : [...prev, server]);
    });
    return () => unsub?.();
  }, []);

  function handleScan() {
    setScanning(true);
    setDiscovered([]);
    void window.clinic?.settings.scan().then((list) => {
      setDiscovered(list);
      setScanning(false);
    });
  }

  async function handleConnect() {
    if (!selectedUrl) return;
    setConnecting(true);
    setConnectError('');
    try {
      await window.clinic?.settings.save({ serverMode: 'lan-client', clientApiUrl: selectedUrl });
      setConnected(true);
      setServerPanelOpen(false);
    } catch {
      setConnectError('Could not save settings.');
    } finally {
      setConnecting(false);
    }
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (result === true) {
      navigate('/dashboard', { replace: true });
    } else if (typeof result === 'string') {
      setError(result);
    } else {
      setError('Invalid email or password.');
    }
  };

  const glassField = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1,
      bgcolor: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(8px)',
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' },
      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255,255,255,0.9)' },
    input: { color: '#fff', '&::placeholder': { color: 'rgba(255,255,255,0.4)' } },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <GalaxyCanvas />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          mx: 2,
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.18)',
          bgcolor: 'rgba(10,20,40,0.55)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: '0 8px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          p: { xs: 3.5, sm: 4.5 },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 1,
            padding: '1px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.04) 50%, rgba(100,200,255,0.15) 100%)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
        }}
      >
        {/* Logo */}
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 3 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(15,118,110,0.6)' }}>
            <LocalHospitalOutlinedIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize={22} color="#fff" lineHeight={1.1}>CareFlow</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Clinic Management</Typography>
          </Box>
        </Stack>

        <Typography variant="h4" fontWeight={800} color="#fff" sx={{ mb: 0.5 }}>Login</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', mb: 3, fontSize: 14 }}>
          Welcome back, please login to your account
        </Typography>

        <Stack spacing={2}>
          {error && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(211,47,47,0.2)', color: '#ff8a80', border: '1px solid rgba(211,47,47,0.35)', '& .MuiAlert-icon': { color: '#ff8a80' } }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
            fullWidth
            sx={glassField}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <PersonOutlineOutlinedIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
            fullWidth
            sx={glassField}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw((v) => !v)} edge="end" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
                      {showPw ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            onClick={() => void handleLogin()}
            sx={{
              borderRadius: 3,
              py: 1.5,
              fontWeight: 700,
              fontSize: 16,
              background: 'linear-gradient(90deg, #0f766e 0%, #16a34a 100%)',
              boxShadow: '0 4px 24px rgba(15,118,110,0.45)',
              '&:hover': { background: 'linear-gradient(90deg, #0d6460 0%, #15803d 100%)', transform: 'translateY(-1px)' },
              '&:active': { transform: 'translateY(0)' },
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : 'Login'}
          </Button>
        </Stack>

        {/* Connect to LAN Server */}
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
          {connected ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleOutlineIcon sx={{ color: '#4ade80', fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: '#4ade80' }}>Connected to clinic server</Typography>
              <Button size="small" sx={{ ml: 'auto !important', color: 'rgba(255,255,255,0.4)', fontSize: 11 }} onClick={() => { setConnected(false); setServerPanelOpen(true); }}>
                Change
              </Button>
            </Stack>
          ) : (
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<WifiTetheringIcon />}
              onClick={() => setServerPanelOpen((v) => !v)}
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', borderRadius: 2, '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              Connect to Clinic Server (LAN)
            </Button>
          )}

          <Collapse in={serverPanelOpen}>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Available servers on network:</Typography>
                <Button size="small" startIcon={scanning ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <WifiTetheringIcon />} onClick={handleScan} disabled={scanning} sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  {scanning ? 'Scanning...' : 'Scan'}
                </Button>
              </Stack>

              {discovered.length > 0 ? (
                <List disablePadding sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {discovered.map((server) => {
                    const url = `http://${server.ip}:${server.port}`;
                    const sel = selectedUrl === url;
                    return (
                      <ListItemButton key={server.ip} selected={sel} onClick={() => setSelectedUrl(url)} sx={{ py: 1, bgcolor: sel ? 'rgba(15,118,110,0.25)' : 'rgba(255,255,255,0.04)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(15,118,110,0.25)' } }}>
                        <DnsOutlinedIcon sx={{ color: sel ? '#4ade80' : 'rgba(255,255,255,0.3)', fontSize: 18, mr: 1.5 }} />
                        <ListItemText
                          primary={server.name}
                          secondary={url}
                          primaryTypographyProps={{ color: '#fff', fontSize: 13, fontWeight: sel ? 700 : 400 }}
                          secondaryTypographyProps={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        {sel && <CheckCircleOutlineIcon sx={{ color: '#4ade80', fontSize: 18 }} />}
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', display: 'block', py: 1 }}>
                  {scanning ? 'Looking for servers...' : 'No servers found. Click Scan.'}
                </Typography>
              )}

              {connectError && (
                <Alert severity="error" sx={{ bgcolor: 'rgba(211,47,47,0.2)', color: '#ff8a80', border: '1px solid rgba(211,47,47,0.35)', '& .MuiAlert-icon': { color: '#ff8a80' }, py: 0.5 }}>
                  {connectError}
                </Alert>
              )}

              <Button fullWidth variant="contained" size="small" disabled={!selectedUrl || connecting} onClick={() => void handleConnect()} sx={{ borderRadius: 2, background: 'linear-gradient(90deg,#0f766e,#16a34a)', fontWeight: 700 }}>
                {connecting ? 'Connecting...' : 'Connect & Save'}
              </Button>
            </Stack>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );
}
