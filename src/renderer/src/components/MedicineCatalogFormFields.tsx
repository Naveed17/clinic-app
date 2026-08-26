import {
  Alert,
  Autocomplete,
  Box,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import type { Medicine } from '@/types/medicine';
import { findCatalogDuplicate, formatMedicineDisplayName } from '@shared/medicineCatalog';
import { DEFAULT_MEDICINE_TYPE, MEDICINE_TYPES, medicineTypeUsesMg } from '@shared/medicineTypes';

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

interface Props {
  name: string;
  type: string;
  mg: string;
  price: string;
  medicines: Medicine[];
  excludeId?: string;
  onNameChange: (name: string) => void;
  onTypeChange: (type: string) => void;
  onMgChange: (mg: string) => void;
  onPriceChange: (price: string) => void;
  onSelectExisting?: (medicine: Medicine) => void;
}

export function MedicineCatalogFormFields({
  name,
  type,
  mg,
  price,
  medicines,
  excludeId,
  onNameChange,
  onTypeChange,
  onMgChange,
  onPriceChange,
  onSelectExisting,
}: Props): React.JSX.Element {
  const showMg = medicineTypeUsesMg(type);
  const mgNum = showMg && mg.trim() ? parseInt(mg, 10) : null;

  const filteredMedicines = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return medicines.slice(0, 50);
    return medicines.filter((m) => {
      const label = formatMedicineDisplayName(m.name, m.mg).toLowerCase();
      return m.name.toLowerCase().includes(q) || label.includes(q);
    }).slice(0, 50);
  }, [medicines, name]);

  const existingMatch = useMemo(
    () => findCatalogDuplicate(medicines, name, mgNum, excludeId),
    [medicines, name, mgNum, excludeId],
  );

  function applyExisting(med: Medicine): void {
    onNameChange(med.name);
    onTypeChange(med.type || DEFAULT_MEDICINE_TYPE);
    onMgChange(med.mg != null ? String(med.mg) : '');
    onPriceChange(String(med.price));
    onSelectExisting?.(med);
  }

  return (
    <Stack spacing={2}>
      {existingMatch && (
        <Alert severity="warning">
          <strong>{formatMedicineDisplayName(existingMatch.name, existingMatch.mg)}</strong> already exists
          ({existingMatch.type}, {money(existingMatch.price)}).
        </Alert>
      )}
      <Autocomplete
        freeSolo
        options={filteredMedicines}
        getOptionLabel={(m) => (typeof m === 'string' ? m : formatMedicineDisplayName(m.name, m.mg))}
        inputValue={name}
        onInputChange={(_, value, reason) => {
          if (reason === 'reset') return;
          onNameChange(value);
        }}
        onChange={(_, med) => {
          if (med && typeof med !== 'string') applyExisting(med);
        }}
        filterOptions={(x) => x}
        renderOption={(props, m) => (
          <Box component="li" {...props} key={m.id}>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={13.5}>{formatMedicineDisplayName(m.name, m.mg)}</Typography>
              <Typography fontSize={11.5} color="text.secondary">
                {m.type}{m.mg != null ? ` · ${m.mg}mg` : ''} · {money(m.price)}
              </Typography>
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Medicine name"
            size="small"
            autoFocus
            helperText="Type to search — existing medicines will appear as you type"
          />
        )}
      />
      <TextField select label="Type" size="small" fullWidth value={type} onChange={(e) => {
        const next = e.target.value;
        onTypeChange(next);
        if (!medicineTypeUsesMg(next)) onMgChange('');
      }}>
        {MEDICINE_TYPES.map((t) => (
          <MenuItem key={t} value={t}>{t}</MenuItem>
        ))}
      </TextField>
      {showMg && (
        <TextField
          label="Strength (mg)"
          size="small"
          type="number"
          fullWidth
          value={mg}
          onChange={(e) => onMgChange(e.target.value)}
          placeholder="e.g. 500"
          InputProps={{ endAdornment: <InputAdornment position="end">mg</InputAdornment> }}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          helperText="Optional — use when same medicine has different strengths (100mg vs 500mg)"
        />
      )}
      <TextField
        label="Price"
        size="small"
        type="number"
        fullWidth
        value={price}
        onChange={(e) => onPriceChange(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
        slotProps={{ htmlInput: { min: 0, step: 'any' } }}
      />
    </Stack>
  );
}

export function medicineCatalogLabel(m: Pick<Medicine, 'name' | 'mg'>): string {
  return formatMedicineDisplayName(m.name, m.mg);
}
