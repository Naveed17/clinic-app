import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';

interface SaleItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
}

interface Patient { id: string; firstName: string; lastName: string; mrNumber: string; }

interface Props {
  /** Pre-fill from prescription (token page integration) */
  prefillItems?: { medicineName: string }[];
  onClose: () => void;
  onSaved: (sale: PharmacySale) => void;
}

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

export function SaleDialog({ prefillItems, onClose, onSaved }: Props): React.JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [notes, setNotes] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  // Load medicines for autocomplete
  const { data: medicines = [] } = useQuery<PharmacyMedicine[]>({
    queryKey: ['pharmacy-medicines'],
    queryFn: () => window.clinic.pharmacy.medicines.list(),
  });

  // Load patients for autocomplete
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients-simple'],
    queryFn: async () => {
      const res = await window.clinic.patients.list({ page: 1, pageSize: 500, search: patientSearch });
      return (res as { data: Patient[] }).data ?? [];
    },
  });

  // Pre-fill from prescription
  useEffect(() => {
    if (!prefillItems?.length) return;
    const filled: SaleItem[] = prefillItems.map(pi => {
      const found = medicines.find(m => m.name.toLowerCase() === pi.medicineName.toLowerCase());
      return {
        medicineId:   found?.id ?? '',
        medicineName: found?.name ?? pi.medicineName,
        quantity:     1,
        unitPrice:    found?.price ?? 0,
      };
    });
    setItems(filled);
  }, [prefillItems, medicines]);

  const addItem = () => {
    setItems(prev => [...prev, { medicineId: '', medicineName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<SaleItem>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const selectMedicine = (idx: number, med: PharmacyMedicine | null) => {
    if (!med) return;
    updateItem(idx, { medicineId: med.id, medicineName: med.name, unitPrice: med.price });
  };

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const isValid = items.length > 0 && items.every(i => i.medicineId && i.quantity > 0);

  const mutation = useMutation({
    mutationFn: () => window.clinic.pharmacy.sales.create({
      patientId: selectedPatient?.id ?? null,
      tokenId:   null,
      soldById:  user!.id,
      saleDate:  today,
      notes:     notes.trim() || null,
      items,
    }),
    onSuccess: (sale) => {
      void qc.invalidateQueries({ queryKey: ['pharmacy-medicines'] });
      void qc.invalidateQueries({ queryKey: ['pharmacy-sales'] });
      onSaved(sale as PharmacySale);
    },
  });

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>New Sale</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {/* Patient (optional) */}
          <Autocomplete
            options={patients}
            getOptionLabel={p => `${p.firstName} ${p.lastName} (${p.mrNumber})`}
            value={selectedPatient}
            onChange={(_, v) => setSelectedPatient(v)}
            onInputChange={(_, v) => setPatientSearch(v)}
            renderInput={params => <TextField {...params} label="Patient (optional)" placeholder="Search by name or MR…" />}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />

          <Divider />

          {/* Items */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography fontWeight={600} fontSize={14}>Medicines</Typography>
              <Button size="small" startIcon={<AddOutlinedIcon />} onClick={addItem}>Add</Button>
            </Stack>

            {items.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No items added. Click "Add" to start.
              </Typography>
            )}

            <Stack spacing={1.5}>
              {items.map((item, idx) => (
                <Grid container spacing={1.5} alignItems="center" key={idx}>
                  <Grid item xs={5}>
                    <Autocomplete
                      options={medicines}
                      getOptionLabel={m => `${m.name} (Stock: ${m.stock})`}
                      value={medicines.find(m => m.id === item.medicineId) ?? null}
                      onChange={(_, v) => selectMedicine(idx, v)}
                      renderInput={params => <TextField {...params} label="Medicine" size="small" />}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      label="Qty" type="number" size="small" fullWidth
                      value={item.quantity}
                      onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      label="Price" type="number" size="small" fullWidth
                      value={item.unitPrice}
                      onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                      inputProps={{ min: 0, step: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <Typography fontSize={13} fontWeight={600} textAlign="right">
                      {money(item.quantity * item.unitPrice)}
                    </Typography>
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Stack>
          </Box>

          {items.length > 0 && (
            <>
              <Divider />
              <Stack direction="row" justifyContent="flex-end">
                <Typography fontWeight={700} fontSize={16}>
                  Total: {money(total)}
                </Typography>
              </Stack>
            </>
          )}

          <TextField
            label="Notes (optional)" multiline rows={2}
            value={notes} onChange={e => setNotes(e.target.value)}
          />

          {mutation.isError && (
            <Typography color="error" variant="caption">Failed to save sale. Try again.</Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          disabled={!isValid || mutation.isPending}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Save Sale
        </Button>
      </DialogActions>
    </Dialog>
  );
}
