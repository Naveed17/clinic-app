import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import { Autocomplete, Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Medicine } from '@/types/medicine';
import { MedicinePickerDialog } from './MedicinePickerDialog';
import { useLicense } from '@/features/auth/LicenseModulesContext';

interface Props {
  value: string;
  onChange: (name: string, price: number) => void;
  label?: string;
  size?: 'small' | 'medium';
}

export function MedicineAutocomplete({ value, onChange, label = 'Medicine', size = 'medium' }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const catalogOn = useLicense().can('manageMedicines');

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.clinic.medicines.search(''),
    enabled: catalogOn,
  });

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

  const selected = medicines.find((m) => m.name === value) ?? null;

  return (
    <>
      <Autocomplete
        options={medicines}
        getOptionLabel={(m) => m.name}
        value={selected}
        onChange={(_, med) => {
          if (med) onChange(med.name, Number(med.price));
          else onChange('', 0);
        }}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderOption={(props, m) => (
          <Box component="li" {...props} key={m.id}>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={13.5}>{m.name}</Typography>
              <Typography fontSize={11.5} color="text.secondary">
                Rs. {Number(m.price).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
          onChange(med.name, Number(med.price));
        }}
      />
    </>
  );
}
