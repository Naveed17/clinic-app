import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const CATEGORIES = ['General', 'Antibiotic', 'Painkiller', 'Vitamin', 'Antacid', 'Antidiabetic', 'Antihypertensive', 'Syrup', 'Drop', 'Other'];
const UNITS = ['Tablet', 'Capsule', 'Syrup (ml)', 'Injection', 'Sachet', 'Strip', 'Bottle', 'Piece', 'Other'];

const schema = z.object({
  name:         z.string().min(1, 'Name required'),
  price:        z.coerce.number().min(0, 'Price must be ≥ 0'),
  category:     z.string().min(1),
  unit:         z.string().min(1),
  stock:        z.coerce.number().int().min(0, 'Stock must be ≥ 0'),
  reorderLevel: z.coerce.number().int().min(0),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  medicine?: PharmacyMedicine | null;
  onClose: () => void;
}

export function StockDialog({ medicine, onClose }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const isEdit = Boolean(medicine?.id);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name:         medicine?.name         ?? '',
      price:        medicine?.price        ?? 0,
      category:     medicine?.category     ?? 'General',
      unit:         medicine?.unit         ?? 'Tablet',
      stock:        medicine?.stock        ?? 0,
      reorderLevel: medicine?.reorderLevel ?? 10,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      window.clinic.pharmacy.medicines.upsert({ id: medicine?.id, ...data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pharmacy-medicines'] });
      void qc.invalidateQueries({ queryKey: ['pharmacy-low-stock'] });
      onClose();
    },
  });

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>{isEdit ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Controller name="name" control={control} render={({ field }) => (
            <TextField {...field} label="Medicine Name" error={!!errors.name} helperText={errors.name?.message} fullWidth autoFocus />
          )} />

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <Controller name="category" control={control} render={({ field }) => (
              <TextField {...field} select label="Category" fullWidth>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="unit" control={control} render={({ field }) => (
              <TextField {...field} select label="Unit" fullWidth>
                {UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </TextField>
            )} />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Controller name="price" control={control} render={({ field }) => (
              <TextField {...field} label="Price (Rs.)" type="number"
                error={!!errors.price} helperText={errors.price?.message}
                fullWidth inputProps={{ min: 0, step: 0.5 }} />
            )} />
            <Controller name="stock" control={control} render={({ field }) => (
              <TextField {...field} label="Current Stock" type="number"
                error={!!errors.stock} helperText={errors.stock?.message}
                fullWidth inputProps={{ min: 0 }} />
            )} />
            <Controller name="reorderLevel" control={control} render={({ field }) => (
              <TextField {...field} label="Reorder Level" type="number"
                error={!!errors.reorderLevel} helperText={errors.reorderLevel?.message}
                fullWidth inputProps={{ min: 0 }} />
            )} />
          </Box>

          {mutation.isError && (
            <Typography color="error" variant="caption">Failed to save. Please try again.</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          onClick={handleSubmit(d => mutation.mutate(d))}
        >
          {isEdit ? 'Save Changes' : 'Add Medicine'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
