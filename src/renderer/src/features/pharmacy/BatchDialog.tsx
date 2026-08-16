import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_QUERY_KEYS } from './inventoryUtils';

interface Props {
  onClose: () => void;
  defaultMedicineId?: string;
}

export function BatchDialog({ onClose, defaultMedicineId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { data: medicines = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-medicines'],
    queryFn: () => window.clinic.inventory.medicines.list(),
  });

  const [medicineId, setMedicineId] = useState(defaultMedicineId ?? '');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [salePrice, setSalePrice] = useState('0');
  const [quantity, setQuantity] = useState('0');
  const [error, setError] = useState('');

  const selected = medicines.find((m) => m.id === medicineId) ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.inventory.batches.create({
        medicineId,
        batchNumber: batchNumber.trim(),
        expiryDate: expiryDate!.toISOString(),
        purchasePrice: parseFloat(purchasePrice) || 0,
        salePrice: parseFloat(salePrice) || 0,
        quantity: Math.max(0, parseInt(quantity, 10) || 0),
      }),
    onSuccess: async () => {
      await Promise.all(INVENTORY_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create batch.'),
    meta: { toast: 'Batch created', errorToast: 'Failed to create batch.' },
  });

  const canSave = !!medicineId && batchNumber.trim() && !!expiryDate;

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Add Batch" subtitle="Record a new stock batch with expiry and pricing." />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <Autocomplete
            options={medicines}
            getOptionLabel={(m) => m.name}
            value={selected}
            onChange={(_, v) => setMedicineId(v?.id ?? '')}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Medicine" fullWidth autoFocus />}
          />
          <TextField label="Batch number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} fullWidth />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Expiry date"
              value={expiryDate}
              onChange={(v) => setExpiryDate(v)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
            <TextField label="Purchase price" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} fullWidth inputProps={{ min: 0, step: 0.5 }} />
            <TextField label="Sale price" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} fullWidth inputProps={{ min: 0, step: 0.5 }} />
            <TextField label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} fullWidth inputProps={{ min: 0 }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton disabled={!canSave} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Add Batch
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
