import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  IconButton, Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_QUERY_KEYS, money } from './inventoryUtils';

interface LineItem {
  key: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: Date | null;
  quantity: number;
  unitPrice: number;
  salePrice: number;
}

function emptyLine(): LineItem {
  return {
    key: crypto.randomUUID(),
    medicineId: '',
    batchNumber: '',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    quantity: 1,
    unitPrice: 0,
    salePrice: 0,
  };
}

interface Props {
  onClose: () => void;
}

export function PurchaseDialog({ onClose }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery<InventorySupplier[]>({
    queryKey: ['inventory-suppliers'],
    queryFn: () => window.clinic.inventory.suppliers.list(),
  });
  const { data: medicines = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-medicines'],
    queryFn: () => window.clinic.inventory.medicines.list(),
  });

  const [invoiceNumber, setInvoiceNumber] = useState(`PO-${Date.now().toString().slice(-6)}`);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [error, setError] = useState('');

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.inventory.purchases.create({
        invoiceNumber: invoiceNumber.trim(),
        supplierId,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          medicineId: i.medicineId,
          batchNumber: i.batchNumber.trim(),
          expiryDate: i.expiryDate!.toISOString(),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          purchasePrice: i.unitPrice,
          salePrice: i.salePrice,
        })),
      }),
    onSuccess: async () => {
      await Promise.all(INVENTORY_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create purchase.'),
    meta: { toast: 'Purchase created', errorToast: 'Failed to create purchase.' },
  });

  const canSave =
    invoiceNumber.trim() &&
    supplierId &&
    items.length > 0 &&
    items.every((i) => i.medicineId && i.batchNumber.trim() && i.expiryDate && i.quantity > 0);

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="New Purchase Order" subtitle="Record stock received from a supplier." />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Typography color="error" variant="caption">{error}</Typography>}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} fullWidth autoFocus />
            <Autocomplete
              options={suppliers}
              getOptionLabel={(s) => s.companyName ? `${s.name} (${s.companyName})` : s.name}
              value={selectedSupplier}
              onChange={(_, v) => setSupplierId(v?.id ?? '')}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Supplier" fullWidth />}
            />
          </Box>
          <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>Items</Typography>
            <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setItems((p) => [...p, emptyLine()])}>
              Add line
            </Button>
          </Stack>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={1.5}>
              {items.map((item) => {
                const med = medicines.find((m) => m.id === item.medicineId) ?? null;
                return (
                  <Box key={item.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr auto' } }}>
                        <Autocomplete
                          options={medicines}
                          getOptionLabel={(m) => m.name}
                          value={med}
                          onChange={(_, v) => updateItem(item.key, { medicineId: v?.id ?? '' })}
                          isOptionEqualToValue={(a, b) => a.id === b.id}
                          renderInput={(params) => <TextField {...params} label="Medicine" size="small" />}
                        />
                        <TextField
                          label="Batch #"
                          size="small"
                          value={item.batchNumber}
                          onChange={(e) => updateItem(item.key, { batchNumber: e.target.value })}
                        />
                        <IconButton
                          color="error"
                          disabled={items.length === 1}
                          onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' } }}>
                        <DatePicker
                          label="Expiry"
                          value={item.expiryDate}
                          onChange={(v) => updateItem(item.key, { expiryDate: v })}
                          slotProps={{ textField: { size: 'small', fullWidth: true } }}
                        />
                        <TextField
                          label="Qty"
                          type="number"
                          size="small"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        />
                        <TextField
                          label="Unit cost"
                          type="number"
                          size="small"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                        />
                        <TextField
                          label="Sale price"
                          type="number"
                          size="small"
                          value={item.salePrice}
                          onChange={(e) => updateItem(item.key, { salePrice: parseFloat(e.target.value) || 0 })}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" textAlign="right">
                        Line: {money(item.quantity * item.unitPrice)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </LocalizationProvider>

          <Typography fontWeight={800} textAlign="right">Total: {money(total)}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton disabled={!canSave} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save Purchase
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
