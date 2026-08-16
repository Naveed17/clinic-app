import {
  Button, Dialog, DialogActions, DialogContent, Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
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
    meta: { toast: 'Supplier created', errorToast: 'Failed to save supplier.' },
  });

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Add Supplier" subtitle="Add a supplier for purchase orders." />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <TextField label="Supplier name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Company (optional)" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth />
          <PhoneInputField label="Phone (optional)" value={phone} onChange={setPhone} />
          <TextField label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton disabled={!name.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Add Supplier
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
