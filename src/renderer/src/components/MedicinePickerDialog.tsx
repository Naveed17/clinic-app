import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  InputAdornment,
  TextField,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Medicine } from '@/types/medicine';
import { MedicineCatalogFormFields } from '@/components/MedicineCatalogFormFields';
import { findCatalogDuplicate } from '@shared/medicineCatalog';
import { medicineTypeUsesMg } from '@shared/medicineTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (medicine: Medicine) => void;
}

export function MedicinePickerDialog({ open, onClose, onAdded }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('Tab');
  const [mg, setMg] = useState('');
  const [error, setError] = useState('');

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.clinic.medicines.search(''),
    enabled: open,
  });

  const mgNum = medicineTypeUsesMg(type) && mg.trim() ? parseInt(mg, 10) : null;
  const existingMatch = findCatalogDuplicate(medicines, name, mgNum);

  const mutation = useMutation({
    mutationFn: () => window.clinic.medicines.create(name.trim(), parseFloat(price) || 0, type, mgNum),
    onSuccess: async (med: Medicine) => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      setName(''); setPrice(''); setType('Tab'); setMg(''); setError('');
      onAdded(med);
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save medicine.'),
    meta: { toast: 'Medicine added', errorToast: 'Could not save medicine.' },
  });

  function handleClose() {
    setName(''); setPrice(''); setType('Tab'); setMg(''); setError('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Add New Medicine" subtitle="Search existing medicines or add a new one." />
      <DialogContent sx={dialogContentSx}>
        <Box sx={{ mt: 0.5 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <MedicineCatalogFormFields
            name={name}
            type={type}
            mg={mg}
            price={price}
            medicines={medicines}
            onNameChange={setName}
            onTypeChange={setType}
            onMgChange={setMg}
            onPriceChange={setPrice}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={handleClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton
          startIcon={<AddOutlinedIcon />}
          disabled={!name.trim() || Boolean(existingMatch)}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Add Medicine
        </SubmitButton>
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
    meta: { toast: 'Price updated', errorToast: 'Unable to update price.' },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle title={`Update Price — ${medicine.name}`} subtitle="Set the new sale price for this medicine." />
      <DialogContent sx={dialogContentSx}>
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
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
