import {
  Button,
  Combobox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  makeStyles,
  shorthands,
} from '@fluentui/react-components';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import { DoctorAvatar, avatarFallbackFromRole } from '@/components/DoctorAvatar';
import {
  CheckCircleOutlineIcon,
  DnsOutlinedIcon,
  LaptopOutlinedIcon,
  PersonOutlineOutlinedIcon,
  VisibilityOffOutlinedIcon,
  VisibilityOutlinedIcon,
  WifiTetheringIcon,
} from '@/icons/fluent';

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

type LoginDirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
};

const LAST_LOGIN_EMAIL_KEY = 'clinic-last-login-email';

function roleLabel(role: string): string {
  return String(role || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    marginLeft: '16px',
    marginRight: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(10,20,40,0.55)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    boxShadow: '0 8px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
    ...shorthands.padding('36px'),
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '12px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    ...shorthands.padding('3px', '10px'),
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  logoBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(22,163,74,0.45)',
    overflow: 'hidden',
    ...shorthands.padding('4px'),
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  brandName: {
    fontWeight: 800,
    fontSize: '22px',
    color: '#fff',
    lineHeight: 1.1,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
  },
  title: {
    fontWeight: 800,
    fontSize: '28px',
    color: '#fff',
    marginBottom: '4px',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '24px',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  glassField: {
    '& input, & .fui-Input, & .fui-Combobox': {
      color: '#fff',
    },
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  },
  optionMeta: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
  },
  optionEmail: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
  },
  optionRole: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    whiteSpace: 'nowrap',
  },
  loginBtn: {
    width: '100%',
    borderRadius: '12px',
    paddingTop: '12px',
    paddingBottom: '12px',
    fontWeight: 700,
    fontSize: '16px',
    backgroundImage: 'linear-gradient(90deg, #0f766e 0%, #16a34a 100%)',
    boxShadow: '0 4px 24px rgba(15,118,110,0.45)',
    border: 'none',
    color: '#fff',
  },
  lanBox: {
    marginTop: '24px',
  },
  divider: {
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '16px',
  },
  connectedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  serverList: {
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  serverItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    ...shorthands.padding('8px', '12px'),
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
  },
  serverItemSelected: {
    backgroundColor: 'rgba(15,118,110,0.25)',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  scanRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muted: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
  },
});

export function LoginPage(): React.JSX.Element {
  const styles = useStyles();
  const { login } = useAuth();
  const navigate = useNavigate();
  const brandLogo = useClinicBrandLogo();
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState(() => window.localStorage.getItem(LAST_LOGIN_EMAIL_KEY) || '');
  const [users, setUsers] = useState<LoginDirectoryUser[]>([]);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(() => {
    const message = sessionStorage.getItem('clinic-auth-error') || '';
    sessionStorage.removeItem('clinic-auth-error');
    return message;
  });
  const [loading, setLoading] = useState(false);

  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connected, setConnected] = useState(false);
  const [serverMode, setServerMode] = useState<string>('local');
  const { isOnline } = useDatabaseMode();

  useEffect(() => {
    void window.clinic?.auth
      .directory?.()
      .then((list) => {
        if (Array.isArray(list)) setUsers(list);
      })
      .catch(() => {
        setUsers([]);
      });
  }, []);

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => {
      setServerMode(s.serverMode);
      if (s.serverMode === 'lan-client' && s.clientApiUrl) setConnected(true);
    });
    const unsub = window.clinic?.settings.onServerFound((server) => {
      setDiscovered((prev) => (prev.find((s) => s.ip === server.ip) ? prev : [...prev, server]));
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
      await window.clinic?.settings.relaunch?.();
    } catch {
      setConnectError('Could not save settings.');
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
      window.localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim().toLowerCase());
      navigate('/dashboard', { replace: true });
    } else if (typeof result === 'string') {
      setError(result);
    } else {
      setError('Invalid email or password.');
    }
  };

  const selected = users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
  const filteredUsers = (() => {
    const query = email.trim().toLowerCase();
    if (!query) return [];
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query) ||
        roleLabel(user.role).toLowerCase().includes(query),
    );
  })();

  return (
    <div className={styles.root}>
      <GalaxyCanvas />

      <div className={styles.card}>
        {serverMode && (
          <div className={styles.badgeRow}>
            {isOnline && (
              <span
                className={styles.badge}
                style={{
                  backgroundColor: 'rgba(14,165,233,0.2)',
                  border: '1px solid rgba(56,189,248,0.45)',
                  color: '#7dd3fc',
                }}
              >
                <WifiTetheringIcon style={{ fontSize: 13, color: '#38bdf8' }} />
                Online database
              </span>
            )}
            {!isOnline && serverMode === 'lan-server' && (
              <span
                className={styles.badge}
                style={{
                  backgroundColor: 'rgba(15,118,110,0.25)',
                  border: '1px solid rgba(15,118,110,0.5)',
                  color: '#4ade80',
                }}
              >
                <DnsOutlinedIcon style={{ fontSize: 13, color: '#4ade80' }} />
                LAN Server
              </span>
            )}
            {!isOnline && serverMode === 'local' && (
              <span
                className={styles.badge}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                <LaptopOutlinedIcon style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }} />
                Standalone
              </span>
            )}
            {!isOnline && serverMode === 'lan-client' && connected && (
              <span
                className={styles.badge}
                style={{
                  backgroundColor: 'rgba(59,130,246,0.2)',
                  border: '1px solid rgba(59,130,246,0.4)',
                  color: '#60a5fa',
                }}
              >
                <CheckCircleOutlineIcon style={{ fontSize: 13, color: '#60a5fa' }} />
                LAN Client — Connected
              </span>
            )}
            {!isOnline && serverMode === 'lan-client' && !connected && (
              <span
                className={styles.badge}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#f87171',
                }}
              >
                <WifiTetheringIcon style={{ fontSize: 13, color: '#f87171' }} />
                LAN Client — Not Connected
              </span>
            )}
          </div>
        )}

        <div className={styles.brandRow}>
          <div className={styles.logoBox}>
            <img src={brandLogo} alt="Clinic" className={styles.logo} />
          </div>
          <div>
            <div className={styles.brandName}>CareFlow</div>
            <div className={styles.brandSub}>Clinic Management</div>
          </div>
        </div>

        <div className={styles.title}>Login</div>
        <div className={styles.subtitle}>Welcome back, please login to your account</div>

        <div className={styles.form}>
          {error ? (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          ) : null}

          <Field label={<span className={styles.fieldLabel}>Email</span>} className={styles.glassField}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selected ? (
                <DoctorAvatar
                  src={selected.avatar}
                  name={selected.name}
                  size={28}
                  fallback={avatarFallbackFromRole(selected.role)}
                />
              ) : (
                <PersonOutlineOutlinedIcon
                  style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, flexShrink: 0 }}
                />
              )}
              <Combobox
                freeform
                style={{ flex: 1 }}
                value={email}
                placeholder="Email"
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                onOptionSelect={(_, data) => {
                  if (data.optionValue) {
                    setEmail(data.optionValue);
                    window.setTimeout(() => passwordRef.current?.focus(), 0);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
              >
                {filteredUsers.map((option) => (
                  <Option key={option.id} value={option.email} text={option.email}>
                    <div className={styles.optionRow}>
                      <DoctorAvatar
                        src={option.avatar}
                        name={option.name}
                        size={36}
                        fallback={avatarFallbackFromRole(option.role)}
                      />
                      <div className={styles.optionMeta}>
                        <div className={styles.optionName}>{option.name}</div>
                        <div className={styles.optionEmail}>{option.email}</div>
                      </div>
                      <div className={styles.optionRole}>{roleLabel(option.role)}</div>
                    </div>
                  </Option>
                ))}
              </Combobox>
            </div>
          </Field>

          <Field
            label={<span className={styles.fieldLabel}>Password</span>}
            className={styles.glassField}
          >
            <Input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(_, d) => setPassword(d.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
              ref={passwordRef}
              autoComplete="current-password"
              contentAfter={
                <Button
                  appearance="transparent"
                  size="small"
                  icon={
                    showPw ? (
                      <VisibilityOutlinedIcon style={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityOffOutlinedIcon style={{ fontSize: 18 }} />
                    )
                  }
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                />
              }
            />
          </Field>

          <Button
            className={styles.loginBtn}
            size="large"
            disabled={loading}
            icon={loading ? <Spinner size="tiny" /> : undefined}
            onClick={() => void handleLogin()}
          >
            Login
          </Button>
        </div>

        {serverMode === 'lan-client' && (
          <div className={styles.lanBox}>
            <div className={styles.divider} />
            {connected ? (
              <div className={styles.connectedRow}>
                <CheckCircleOutlineIcon style={{ color: '#4ade80', fontSize: 18 }} />
                <Text size={200} style={{ color: '#4ade80' }}>
                  Connected to clinic server
                </Text>
                <Button
                  size="small"
                  appearance="transparent"
                  style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  onClick={() => {
                    setConnected(false);
                    setServerPanelOpen(true);
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                appearance="outline"
                style={{
                  width: '100%',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.6)',
                }}
                icon={<WifiTetheringIcon />}
                onClick={() => setServerPanelOpen((v) => !v)}
              >
                Connect to Clinic Server (LAN)
              </Button>
            )}

            {serverPanelOpen && (
              <div className={styles.panel}>
                <div className={styles.scanRow}>
                  <Text className={styles.muted}>Available servers on network:</Text>
                  <Button
                    size="small"
                    appearance="transparent"
                    icon={scanning ? <Spinner size="tiny" /> : <WifiTetheringIcon />}
                    onClick={handleScan}
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                  >
                    {scanning ? 'Scanning...' : 'Scan'}
                  </Button>
                </div>

                {discovered.length > 0 ? (
                  <div className={styles.serverList}>
                    {discovered.map((server) => {
                      const url = `http://${server.ip}:${server.port}`;
                      const sel = selectedUrl === url;
                      return (
                        <button
                          key={server.ip}
                          type="button"
                          className={`${styles.serverItem} ${sel ? styles.serverItemSelected : ''}`}
                          onClick={() => setSelectedUrl(url)}
                        >
                          <DnsOutlinedIcon
                            style={{
                              color: sel ? '#4ade80' : 'rgba(255,255,255,0.3)',
                              fontSize: 18,
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: sel ? 700 : 400 }}>
                              {server.name}
                            </div>
                            <div
                              style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: 11,
                                fontFamily: 'monospace',
                              }}
                            >
                              {url}
                            </div>
                          </span>
                          {sel ? (
                            <CheckCircleOutlineIcon style={{ color: '#4ade80', fontSize: 18 }} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Text
                    className={styles.muted}
                    style={{ textAlign: 'center', display: 'block', padding: '8px 0' }}
                  >
                    {scanning ? 'Looking for servers...' : 'No servers found. Click Scan.'}
                  </Text>
                )}

                {connectError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{connectError}</MessageBarBody>
                  </MessageBar>
                ) : null}

                <Button
                  appearance="primary"
                  disabled={!selectedUrl || connecting}
                  icon={connecting ? <Spinner size="tiny" /> : undefined}
                  onClick={() => void handleConnect()}
                  style={{
                    width: '100%',
                    backgroundImage: 'linear-gradient(90deg,#0f766e,#16a34a)',
                    fontWeight: 700,
                  }}
                >
                  Connect & Save
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
