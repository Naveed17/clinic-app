import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
  FormDialogTitle,
  SubmitButton,
} from '@/components/DialogUI';
import { LAB_TEST_OPTIONS } from './labTestCatalog';

export function OrderLabDialog({
  open,
  patientId,
  patientName,
  orderedById,
  tokenId,
  onClose,
}: {
  open: boolean;
  patientId: string;
  patientName: string;
  orderedById: string;
  tokenId?: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const [test, setTest] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.lab.create({
        patientId,
        orderedById,
        tokenId: tokenId || undefined,
        test,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lab-orders'] }),
        qc.invalidateQueries({ queryKey: ['lab-orders-token'] }),
      ]);
      setTest('');
      setNotes('');
      onClose();
    },
    meta: { toast: 'Lab order sent', errorToast: 'Could not send lab order.' },
  });

  function handleClose(): void {
    if (mutation.isPending) return;
    setTest('');
    setNotes('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Order lab test" subtitle={`${patientName} — sent to the laboratory queue.`} />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Test</InputLabel>
            <Select label="Test" value={test} onChange={(e) => setTest(String(e.target.value))}>
              {LAB_TEST_OPTIONS.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes (optional)"
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={handleClose} sx={dialogCancelBtnSx}>
          Cancel
        </Button>
        <SubmitButton
          disabled={!test}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Send to lab
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
