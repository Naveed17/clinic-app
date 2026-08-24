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

const GEMINI_KEYS_URL = 'https://aistudio.google.com/app/apikey';
const DEFAULT_MODEL = 'gemini-3.6-flash';

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
      setError('Paste your Gemini API key.');
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
        <FormDialogTitle title="Connect Gemini AI" />
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewOutlinedIcon />}
              disabled={connecting}
              onClick={() => window.open(GEMINI_KEYS_URL, '_blank', 'noopener,noreferrer')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Open Google AI Studio
            </Button>
            <TextField
              label="Gemini API key"
              size="small"
              fullWidth
              required
              type="password"
              autoComplete="off"
              placeholder="AIzaSy..."
              disabled={connecting}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              helperText="Create an API key at aistudio.google.com, then paste it here."
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
