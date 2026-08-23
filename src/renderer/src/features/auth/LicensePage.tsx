import { useState } from 'react';
import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { LockOutlinedIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    padding: '40px',
    width: '420px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  icon: {
    color: tokens.colorBrandForeground1,
    fontSize: '48px',
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
});

export function LicensePage({ onActivated }: { onActivated: () => void }): React.JSX.Element {
  const styles = useStyles();
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
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.header}>
          <LockOutlinedIcon className={styles.icon} style={{ fontSize: 48 }} />
          <Title2>License Activation</Title2>
          <Text className={styles.subtitle}>Enter your license key to activate CareFlow.</Text>
        </div>

        <div className={styles.form}>
          {error ? (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          ) : null}

          <Field label="License Key">
            <Input
              placeholder="CLINIC-XXXX-XXXX-XXXX"
              value={key}
              onChange={(_, d) => setKey(d.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && !loading && void handleActivate()}
              autoFocus
              disabled={loading}
              style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
            />
          </Field>

          <Button
            appearance="primary"
            size="large"
            disabled={loading || !key.trim()}
            onClick={() => void handleActivate()}
            icon={loading ? <Spinner size="tiny" /> : undefined}
          >
            {loading ? 'Activating…' : 'Activate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
