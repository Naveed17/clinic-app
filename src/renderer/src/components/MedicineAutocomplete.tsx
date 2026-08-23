import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import { Autocomplete, Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Medicine } from '@/types/medicine';
import { MedicinePickerDialog } from './MedicinePickerDialog';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { formatMedicineDisplayName } from '@shared/medicineCatalog';

interface Props {
  value: string;
  onChange: (name: string, price: number) => void;
  label?: string;
  size?: 'small' | 'medium';
}

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

export function MedicineAutocomplete({ value, onChange, label = 'Medicine', size = 'medium' }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const catalogOn = useLicense().can('manageMedicines');

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.clinic.medicines.search(''),
    enabled: catalogOn,
  });

  const selected = useMemo(
    () => medicines.find((m) => formatMedicineDisplayName(m.name, m.mg) === value) ?? null,
    [medicines, value],
  );

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return medicines.slice(0, 50);
    return medicines.filter((m) => {
      const labelText = formatMedicineDisplayName(m.name, m.mg).toLowerCase();
      return labelText.includes(q) || m.name.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [medicines, inputValue]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  if (!catalogOn) {
    return (
      <TextField
        label={label}
        size={size}
        value={value}
        onChange={(e) => onChange(e.target.value, 0)}
      />
    );
  }

  return (
    <>
      <Autocomplete
        freeSolo
        options={filtered}
        getOptionLabel={(m) => (typeof m === 'string' ? m : formatMedicineDisplayName(m.name, m.mg))}
        value={selected}
        inputValue={inputValue}
        onInputChange={(_, next, reason) => {
          if (reason === 'reset') return;
          setInputValue(next);
          if (reason === 'input') {
            const match = medicines.find((m) => formatMedicineDisplayName(m.name, m.mg).toLowerCase() === next.trim().toLowerCase());
            onChange(next, match ? Number(match.price) : 0);
          }
        }}
        onChange={(_, med) => {
          if (typeof med === 'string') {
            onChange(med, 0);
            setInputValue(med);
          } else if (med) {
            const labelText = formatMedicineDisplayName(med.name, med.mg);
            onChange(labelText, Number(med.price));
            setInputValue(labelText);
          } else {
            onChange('', 0);
            setInputValue('');
          }
        }}
        filterOptions={(x) => x}
        isOptionEqualToValue={(o, v) => o.id === v.id}
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
            label={label}
            size={size}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {params.InputProps.endAdornment}
                  <Tooltip title="Add new medicine">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => setAddOpen(true)}>
                      <MedicationOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ),
            }}
          />
        )}
      />
      <MedicinePickerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(med) => {
          void qc.invalidateQueries({ queryKey: ['medicines'] });
          const labelText = formatMedicineDisplayName(med.name, med.mg);
          setInputValue(labelText);
          onChange(labelText, Number(med.price));
        }}
      />
    </>
  );
}
