import React, { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

export interface AddressAutocompleteProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  minRows?: number;
  multiline?: boolean;
}

export function AddressAutocomplete({
  value = '',
  onChange,
  label = 'Address',
  placeholder = 'e.g. Chak 124 GB, Model Town, Lahore',
  error = false,
  helperText,
  disabled = false,
  fullWidth = true,
  size = 'medium',
}: AddressAutocompleteProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);

  // Dynamically fetch previously used addresses directly from the clinic's local database
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['patient-distinct-addresses', debouncedQuery],
    queryFn: async () => {
      try {
        const results = await window.clinic.patients.getAddresses(debouncedQuery);
        return Array.isArray(results) ? results : [];
      } catch {
        return [];
      }
    },
    staleTime: 30 * 1000,
  });

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={disabled}
      fullWidth={fullWidth}
      options={options}
      value={value || ''}
      onInputChange={(_e, newInputValue, reason) => {
        setQuery(newInputValue);
        if (reason === 'input' || reason === 'clear') {
          onChange(newInputValue);
        }
      }}
      onChange={(_e, selectedValue) => {
        onChange(typeof selectedValue === 'string' ? selectedValue : '');
      }}
      filterOptions={(x) => x} // Backend queryRaw already filters by substring
      renderOption={(props, option) => (
        <Box
          component="li"
          {...props}
          key={option}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            py: 1,
            px: 1.5,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {option}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          size={size}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
