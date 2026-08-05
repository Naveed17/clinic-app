import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_QUERY_KEYS } from './inventoryUtils';

interface Props {
  onClose: () => void;
}

export function SupplierDialog({ onClose }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.inventory.suppliers.create({
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all(INVENTORY_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save supplier.'),
  });

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Add Supplier</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <TextField label="Supplier name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Company (optional)" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth />
          <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          <TextField label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          Add Supplier
        </Button>
      </DialogActions>
    </Dialog>
  );
}
