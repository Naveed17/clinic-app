import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { AutoAwesomeOutlinedIcon, OpenInNewOutlinedIcon } from '@/icons/fluent';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';

const GROQ_KEYS_URL = 'https://console.groq.com/keys';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  hint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

export function GroqConnectDialog({
  open,
  connecting,
  initialKey,
  initialModel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  connecting: boolean;
  initialKey?: string;
  initialModel?: string;
  onClose: () => void;
  onSubmit: (values: { apiKey: string; model: string }) => void | Promise<void>;
}): React.JSX.Element {
  const styles = useStyles();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setApiKey(initialKey || '');
    setModel(initialModel || DEFAULT_MODEL);
    setError(null);
  }, [open, initialKey, initialModel]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      setError('Paste your Groq API key.');
      return;
    }
    setError(null);
    await onSubmit({ apiKey: key, model: model.trim() || DEFAULT_MODEL });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open && !connecting) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <form className={styles.form} noValidate onSubmit={(e) => void handleSubmit(e)}>
          <FormDialogTitle title="Connect Groq" />
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                <Button
                  appearance="outline"
                  icon={<OpenInNewOutlinedIcon />}
                  disabled={connecting}
                  onClick={() => window.open(GROQ_KEYS_URL, '_blank', 'noopener,noreferrer')}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Open Groq Console
                </Button>
                <Field
                  label="Groq API key"
                  required
                  hint="Create a key at console.groq.com/keys, then paste it here."
                >
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="gsk_..."
                    disabled={connecting}
                    value={apiKey}
                    onChange={(_, d) => setApiKey(d.value)}
                  />
                </Field>
                <Field label="Model" hint={`Default: ${DEFAULT_MODEL}`}>
                  <Input
                    disabled={connecting}
                    value={model}
                    onChange={(_, d) => setModel(d.value)}
                  />
                </Field>
                {error && (
                  <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actions}>
            <Button appearance="secondary" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <SubmitButton type="submit" loading={connecting} icon={<AutoAwesomeOutlinedIcon />}>
              Connect
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
