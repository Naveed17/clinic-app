import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { INVENTORY_QUERY_KEYS, MOVEMENT_TYPES } from './inventoryUtils';

interface Props {
  onClose: () => void;
}

export function MovementDialog({ onClose }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { data: batches = [] } = useQuery<InventoryBatch[]>({
    queryKey: ['inventory-batches'],
    queryFn: () => window.clinic.inventory.batches.list(),
  });

  const [batchId, setBatchId] = useState('');
  const [type, setType] = useState<(typeof MOVEMENT_TYPES)[number]['value']>('ADJUSTMENT');
  const [qtyInput, setQtyInput] = useState('1');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => batches.find((b) => b.id === batchId) ?? null, [batches, batchId]);

  const mutation = useMutation({
    mutationFn: () => {
      const abs = Math.abs(parseInt(qtyInput, 10) || 0);
      if (abs <= 0) throw new Error('Quantity must be greater than 0.');
      const signed =
        type === 'PURCHASE' || type === 'RETURN' || type === 'ADJUSTMENT'
          ? (type === 'ADJUSTMENT' ? (parseInt(qtyInput, 10) || 0) : abs)
          : -abs;
      return window.clinic.inventory.movements.record({
        batchId,
        type,
        quantity: signed,
        reference: reference.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all(INVENTORY_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to record movement.'),
    meta: { toast: 'Stock movement recorded', errorToast: 'Failed to record movement.' },
  });

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Record Stock Movement" subtitle="Adjust, purchase, or deduct stock for a batch." />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <Autocomplete
            options={batches}
            getOptionLabel={(b) => `${b.medicine?.name ?? 'Medicine'} · ${b.batchNumber} (qty ${b.quantity})`}
            value={selected}
            onChange={(_, v) => setBatchId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Batch" fullWidth autoFocus />}
          />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)} fullWidth>
              {MOVEMENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={type === 'ADJUSTMENT' ? 'Quantity (+/−)' : 'Quantity'}
              type="number"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              fullWidth
              helperText={type === 'ADJUSTMENT' ? 'Use negative to reduce stock' : undefined}
            />
          </Box>
          <TextField label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton disabled={!batchId} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Record
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
