import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Medicine } from '@/types/medicine';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (medicine: Medicine) => void;
}

export function MedicinePickerDialog({ open, onClose, onAdded }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => window.clinic.medicines.create(name.trim(), parseFloat(price) || 0),
    onSuccess: async (med: Medicine) => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      setName(''); setPrice(''); setError('');
      onAdded(med);
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save medicine.'),
  });

  function handleClose() {
    setName(''); setPrice(''); setError('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Add New Medicine</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Medicine name"
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <TextField
            label="Price"
            size="small"
            type="number"
            fullWidth
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Add Medicine
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MedicineUpdatePriceDialog({ medicine, onClose }: { medicine: Medicine; onClose: () => void }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(medicine.price));

  const mutation = useMutation({
    mutationFn: () => window.clinic.medicines.updatePrice(medicine.id, parseFloat(price) || 0),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Update Price — {medicine.name}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 0.5 }}>
          <TextField
            label="New Price"
            size="small"
            type="number"
            fullWidth
            autoFocus
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
