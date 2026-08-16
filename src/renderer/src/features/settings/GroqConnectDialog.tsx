import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  FormDialogTitle,
  SubmitButton,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogFormSx,
  dialogPaperProps,
} from '@/components/DialogUI';

const GROQ_KEYS_URL = 'https://console.groq.com/keys';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

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
      onClose={connecting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={dialogPaperProps}
    >
      <Box component="form" noValidate onSubmit={(e) => void handleSubmit(e)} sx={dialogFormSx}>
        <FormDialogTitle title="Connect Groq" />
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Button
              variant="outlined"
              startIcon={<OpenInNewOutlinedIcon />}
              disabled={connecting}
              onClick={() => window.open(GROQ_KEYS_URL, '_blank', 'noopener,noreferrer')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Open Groq Console
            </Button>
            <TextField
              label="Groq API key"
              size="small"
              fullWidth
              required
              type="password"
              autoComplete="off"
              placeholder="gsk_..."
              disabled={connecting}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              helperText="Create a key at console.groq.com/keys, then paste it here."
            />
            <TextField
              label="Model"
              size="small"
              fullWidth
              disabled={connecting}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              helperText={`Default: ${DEFAULT_MODEL}`}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={connecting} sx={dialogCancelBtnSx}>
            Cancel
          </Button>
          <SubmitButton type="submit" loading={connecting} startIcon={<AutoAwesomeOutlinedIcon />}>
            Connect
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
