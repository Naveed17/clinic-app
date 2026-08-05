import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_QUERY_KEYS } from './inventoryUtils';

interface Props {
  onClose: () => void;
}

export function CategoryDialog({ onClose }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.inventory.categories.create({
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all(INVENTORY_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create category.'),
  });

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <DialogTitle>Add Category</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <TextField label="Category name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          Add Category
        </Button>
      </DialogActions>
    </Dialog>
  );
}
