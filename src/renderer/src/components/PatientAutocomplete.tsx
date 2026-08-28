import { useMemo, useState } from 'react';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import {
  Autocomplete,
  Avatar,
  Box,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import type { TokenPerson } from '@/types/token';
import { dateOfBirthToAge } from '@shared/patientAge';

export interface PatientAutocompleteProps {
  value?: string | TokenPerson | null;
  onChange: (patientId: string, patient: TokenPerson | null) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  onBlur?: () => void;
}

export function PatientAutocomplete({
  value,
  onChange,
  label = 'Search patient',
  placeholder = 'Search patient by name, phone or MR#',
  error = false,
  helperText,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  onBlur,
}: PatientAutocompleteProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);

  const { data: patients = [], isLoading, isFetching } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
    staleTime: 60_000,
  });

  const isSearching = isFetching || isLoading || query.trim() !== debouncedQuery.trim();

  const selectedPatient = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    return patients.find((p) => p.id === value) ?? null;
  }, [patients, value]);

  const filteredPatients = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 50);
    return patients
      .filter((p) => {
        const name = `${p.firstName} ${p.lastName}`.toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const mr = (p.mrNumber || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || mr.includes(q);
      })
      .slice(0, 50);
  }, [patients, debouncedQuery]);

  return (
    <Autocomplete
      options={filteredPatients}
      loading={isSearching}
      loadingText="Searching patients..."
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      getOptionLabel={(p) => `${p.firstName} ${p.lastName}`}
      filterOptions={(x) => x}
      onInputChange={(_, val, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setQuery(val);
        }
      }}
      value={selectedPatient}
      onChange={(_, p) => onChange(p?.id ?? '', p)}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      renderOption={(props, option) => {
        const initials = `${option.firstName?.[0] || ''}${option.lastName?.[0] || ''}`.toUpperCase() || 'P';
        const dob = (option as { dateOfBirth?: string | Date | null }).dateOfBirth;
        const age = option.age ?? (dob ? dateOfBirthToAge(dob) : null);
        return (
          <Box
            component="li"
            {...props}
            key={option.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5 }}
          >
            <Avatar
              src={option.avatar || undefined}
              sx={{
                width: 36,
                height: 36,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography fontSize={14} fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {option.firstName} {option.lastName}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, ml: 1 }}>
                  <PhoneOutlinedIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                  <Typography
                    fontSize={12.5}
                    color="primary.main"
                    fontWeight={700}
                    noWrap
                  >
                    {option.phone || 'No Phone'}
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {option.mrNumber && (
                  <Typography fontSize={11.5} color="text.secondary" fontWeight={600} noWrap>
                    {option.mrNumber}
                  </Typography>
                )}
                {option.gender && (
                  <Typography fontSize={11.5} color="text.secondary" noWrap>
                    • {option.gender}
                  </Typography>
                )}
                {age != null && (
                  <Typography fontSize={11.5} color="text.secondary" noWrap>
                    • {age} yrs
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => {
        const initials = selectedPatient
          ? `${selectedPatient.firstName?.[0] || ''}${selectedPatient.lastName?.[0] || ''}`.toUpperCase()
          : '';
        return (
          <TextField
            {...params}
            label={label}
            placeholder={selectedPatient ? '' : placeholder}
            error={error}
            helperText={helperText}
            fullWidth={fullWidth}
            onBlur={onBlur}
            InputProps={{
              ...params.InputProps,
              startAdornment: selectedPatient ? (
                <>
                  <Avatar
                    src={selectedPatient.avatar || undefined}
                    sx={{
                      width: 26,
                      height: 26,
                      fontSize: 10,
                      fontWeight: 700,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      ml: 0.5,
                      mr: 0.5,
                    }}
                  >
                    {initials}
                  </Avatar>
                  {params.InputProps.startAdornment}
                </>
              ) : (
                params.InputProps.startAdornment
              ),
              endAdornment: (
                <>
                  {isSearching ? <CircularProgress color="primary" size={18} sx={{ mr: 1 }} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        );
      }}
    />
  );
}
