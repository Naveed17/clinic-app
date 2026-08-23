import { useState } from 'react';
import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import {
  CheckCircleOutlineIcon,
  DevicesOutlinedIcon,
  DnsOutlinedIcon,
  LaptopOutlinedIcon,
  WifiTetheringOutlinedIcon,
} from '@/icons/fluent';

type Mode = 'local' | 'lan-server' | 'lan-client';

const STEPS_LOCAL = ['Welcome', 'Machine Role', 'Done'];
const STEPS_ONLINE = ['Welcome', 'Done'];

function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalL,
  },
  card: {
    padding: tokens.spacingVerticalXXL,
    width: '100%',
    maxWidth: '520px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow8,
  },
  brandRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  logoBox: {
    width: '38px',
    height: '38px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: '#fff',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '3px',
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  brandTitle: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '20px',
  },
  stepper: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
    flexWrap: 'wrap',
  },
  stepItem: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepActive: {
    color: tokens.colorBrandForeground1,
  },
  stepDone: {
    color: tokens.colorNeutralForeground2,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXXS,
  },
  roleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  roleBtn: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    font: 'inherit',
  },
  roleBtnSelected: {
    border: `1px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  roleIcon: {
    color: tokens.colorNeutralForeground2,
    display: 'flex',
  },
  roleIconSelected: {
    color: tokens.colorBrandForeground1,
  },
  roleMeta: {
    flex: 1,
    minWidth: 0,
  },
  scanHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serverList: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  serverItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    width: '100%',
    border: 'none',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
  },
  serverItemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
  },
  flex1: {
    flex: 1,
  },
  centerStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    textAlign: 'center',
  },
  successIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: tokens.colorPaletteGreenBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorPaletteGreenForeground1,
  },
  fullWidth: {
    width: '100%',
  },
});

export function SetupWizard({ onDone }: { onDone: () => void }): React.JSX.Element {
  const styles = useStyles();
  const brandLogo = useClinicBrandLogo();

  const [step, setStep] = useState(0);
  const [clinicName, setClinicName] = useState('');
  const [mode, setMode] = useState<Mode>('local');
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number; name: string }[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const { isOnline: onlineMode } = useDatabaseMode();

  const serverUrl = normalizeServerUrl(selectedUrl || manualUrl);
  const steps = onlineMode ? STEPS_ONLINE : STEPS_LOCAL;
  const stepperIndex = onlineMode ? (step >= 2 ? 1 : 0) : step;

  async function handleScan() {
    setScanning(true);
    setDiscovered([]);
    setError('');
    try {
      const list = await window.clinic?.settings.scan();
      setDiscovered(list ?? []);
    } catch {
      setError('Network scan failed. Enter the server URL manually.');
    } finally {
      setScanning(false);
    }
  }

  async function handleRoleNext() {
    setError('');

    if (mode !== 'lan-client') {
      setStep(2);
      return;
    }

    if (!serverUrl) {
      setError('Please select or enter a server URL.');
      return;
    }

    setTesting(true);
    try {
      const ok = await window.clinic?.settings.testConnection(serverUrl);
      if (!ok) {
        setError(
          'Could not reach server. Check the URL, firewall, and that the LAN server is running.',
        );
        return;
      }
      if (!selectedUrl) setManualUrl(serverUrl);
      else setSelectedUrl(serverUrl);
      setStep(2);
    } catch {
      setError('Connection test failed. Check the URL and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError('');

    try {
      if (!onlineMode && mode === 'lan-client') {
        if (!serverUrl) {
          setError('Please select or enter a server URL.');
          setStep(1);
          return;
        }
        const ok = await window.clinic?.settings.testConnection(serverUrl);
        if (!ok) {
          setError('Could not reach server. Go back and verify the connection.');
          setStep(1);
          return;
        }
      }

      await window.clinic?.settings.save({
        clinicName: clinicName.trim() || 'Clinic',
        serverMode: onlineMode ? 'local' : mode,
        clientApiUrl: !onlineMode && mode === 'lan-client' ? serverUrl : '',
        setupDone: true,
      });

      onDone();
      if (window.clinic?.settings.relaunch) {
        await window.clinic.settings.relaunch();
      } else {
        window.location.reload();
      }
    } catch {
      setError('Failed to save setup. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const roles: { value: Mode; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      value: 'local',
      icon: <LaptopOutlinedIcon />,
      label: 'Standalone',
      desc: 'Single machine, no network sharing',
    },
    {
      value: 'lan-server',
      icon: <DnsOutlinedIcon />,
      label: 'LAN Server',
      desc: 'This machine hosts the database',
    },
    {
      value: 'lan-client',
      icon: <DevicesOutlinedIcon />,
      label: 'LAN Client',
      desc: 'Connect to another machine',
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <div className={styles.logoBox}>
            <img src={brandLogo} alt="Clinic" className={styles.logo} />
          </div>
          <Text className={styles.brandTitle}>CareFlow Setup</Text>
        </div>

        <div className={styles.stepper}>
          {steps.map((label, i) => (
            <Text
              key={label}
              className={`${styles.stepItem} ${
                i === stepperIndex ? styles.stepActive : i < stepperIndex ? styles.stepDone : ''
              }`}
            >
              {i + 1}. {label}
            </Text>
          ))}
        </div>

        {step === 0 && (
          <div className={styles.stack}>
            <div>
              <Title3>Welcome to CareFlow</Title3>
              <Text className={styles.muted} block>
                Let&apos;s set up your clinic in a few steps.
              </Text>
            </div>
            <Field label="Clinic Name">
              <Input
                placeholder="e.g. Care Clinic"
                value={clinicName}
                onChange={(_, d) => setClinicName(d.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && clinicName.trim() && setStep(onlineMode ? 2 : 1)
                }
                autoFocus
              />
            </Field>
            <Button
              appearance="primary"
              disabled={!clinicName.trim()}
              onClick={() => setStep(onlineMode ? 2 : 1)}
            >
              Next
            </Button>
          </div>
        )}

        {step === 1 && !onlineMode && (
          <div className={styles.stack}>
            <div>
              <Title3>Machine Role</Title3>
              <Text className={styles.muted} block>
                How will this machine be used?
              </Text>
            </div>

            <div className={styles.roleList}>
              {roles.map(({ value, icon, label, desc }) => {
                const selected = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.roleBtn} ${selected ? styles.roleBtnSelected : ''}`}
                    onClick={() => {
                      setMode(value);
                      setSelectedUrl('');
                      setDiscovered([]);
                      setError('');
                    }}
                  >
                    <span className={`${styles.roleIcon} ${selected ? styles.roleIconSelected : ''}`}>
                      {icon}
                    </span>
                    <span className={styles.roleMeta}>
                      <Text weight={selected ? 'semibold' : 'regular'} block>
                        {label}
                      </Text>
                      <Text size={200} className={styles.muted}>
                        {desc}
                      </Text>
                    </span>
                    {selected ? (
                      <CheckCircleOutlineIcon
                        style={{ fontSize: 18, color: 'var(--colorBrandForeground1)' }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {mode === 'lan-client' && (
              <div className={styles.stack}>
                <div className={styles.scanHeader}>
                  <Text size={200} className={styles.muted}>
                    Find server on network:
                  </Text>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={
                      scanning ? <Spinner size="tiny" /> : <WifiTetheringOutlinedIcon />
                    }
                    disabled={testing}
                    onClick={() => void handleScan()}
                  >
                    {scanning ? 'Scanning...' : 'Scan'}
                  </Button>
                </div>

                {discovered.length > 0 && (
                  <div className={styles.serverList}>
                    {discovered.map((s) => {
                      const url = `http://${s.ip}:${s.port}`;
                      const sel = selectedUrl === url;
                      return (
                        <button
                          key={s.ip}
                          type="button"
                          className={`${styles.serverItem} ${sel ? styles.serverItemSelected : ''}`}
                          onClick={() => {
                            setSelectedUrl(url);
                            setManualUrl('');
                            setError('');
                          }}
                        >
                          <DnsOutlinedIcon style={{ fontSize: 18 }} />
                          <span className={styles.roleMeta}>
                            <Text weight={sel ? 'semibold' : 'regular'} size={300} block>
                              {s.name}
                            </Text>
                            <Text className={styles.mono}>{url}</Text>
                          </span>
                          {sel ? <CheckCircleOutlineIcon style={{ fontSize: 18 }} /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {discovered.length === 0 && !scanning && (
                  <Text size={200} className={styles.muted} style={{ textAlign: 'center' }}>
                    No servers found. Click Scan or enter URL manually.
                  </Text>
                )}

                <Field label="Or enter server URL manually">
                  <Input
                    placeholder="http://192.168.1.x:3333"
                    value={manualUrl}
                    onChange={(_, d) => {
                      setManualUrl(d.value);
                      setSelectedUrl('');
                      setError('');
                    }}
                  />
                </Field>
              </div>
            )}

            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            ) : null}

            <div className={styles.row}>
              <Button appearance="secondary" disabled={testing} onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                appearance="primary"
                className={styles.flex1}
                disabled={scanning || testing}
                icon={testing ? <Spinner size="tiny" /> : undefined}
                onClick={() => void handleRoleNext()}
              >
                {mode === 'lan-client' ? 'Test & Next' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.centerStack}>
            <div className={styles.successIcon}>
              <CheckCircleOutlineIcon style={{ fontSize: 40 }} />
            </div>
            <div>
              <Title3>All Set!</Title3>
              <Text className={styles.muted} block>
                <strong>{clinicName}</strong> is configured as{' '}
                <strong>
                  {onlineMode
                    ? 'Online Database (cloud)'
                    : mode === 'local'
                      ? 'Standalone'
                      : mode === 'lan-server'
                        ? 'LAN Server'
                        : 'LAN Client'}
                </strong>
                .
              </Text>
              {mode === 'lan-client' && serverUrl ? (
                <Text className={styles.mono} block>
                  {serverUrl}
                </Text>
              ) : null}
            </div>
            {error ? (
              <MessageBar intent="error" className={styles.fullWidth}>
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            ) : null}
            <div className={`${styles.row} ${styles.fullWidth}`}>
              <Button
                appearance="secondary"
                disabled={saving}
                onClick={() => {
                  setError('');
                  setStep(onlineMode ? 0 : 1);
                }}
              >
                Back
              </Button>
              <Button
                appearance="primary"
                className={styles.flex1}
                disabled={saving}
                icon={saving ? <Spinner size="tiny" /> : undefined}
                onClick={() => void handleFinish()}
              >
                Finish & Launch
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
