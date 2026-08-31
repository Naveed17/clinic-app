import { useMemo, useState } from 'react';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import {
  Autocomplete,
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import type { TokenPerson } from '@/types/token';
import { dateOfBirthToAge } from '@shared/patientAge';
import { PatientDialog, type PatientFormValues } from '@/features/patients/PatientDialog';
import type { Patient } from '@/types/patient';

const ADD_NEW_ID = '__ADD_NEW_PATIENT__';

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
  autoFocus?: boolean;
  allowAddNew?: boolean;
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
  autoFocus = false,
  allowAddNew = true,
  onBlur,
}: PatientAutocompleteProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addInitialValues, setAddInitialValues] = useState<Partial<PatientFormValues>>({});
  const [recentlyCreated, setRecentlyCreated] = useState<TokenPerson | null>(null);

  const { data: patients = [], isLoading, isFetching } = useQuery<TokenPerson[]>({
    queryKey: ['token-patients'],
    queryFn: () => window.clinic.tokens.patients(),
    staleTime: 60_000,
  });

  const isSearching = isFetching || isLoading || query.trim() !== debouncedQuery.trim();

  const selectedPatient = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    const found = patients.find((p) => p.id === value);
    if (found) return found;
    if (recentlyCreated && recentlyCreated.id === value) return recentlyCreated;
    return null;
  }, [patients, value, recentlyCreated]);

  const addNewOption: TokenPerson = useMemo(() => {
    const trimmed = query.trim();
    return {
      id: ADD_NEW_ID,
      firstName: trimmed ? `+ Add "${trimmed}" as new patient…` : '+ Add new patient…',
      lastName: '',
      phone: '',
      mrNumber: '',
    } as unknown as TokenPerson;
  }, [query]);

  const filteredPatients = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const list = !q
      ? patients.slice(0, 50)
      : patients
          .filter((p) => {
            const last = p.lastName ?? '';
            const name = `${p.firstName ?? ''} ${last}`.trim().toLowerCase();
            const phone = (p.phone || '').toLowerCase();
            const mr = (p.mrNumber || '').toLowerCase();
            return name.includes(q) || phone.includes(q) || mr.includes(q);
          })
          .slice(0, 50);

    if (allowAddNew) {
      return [addNewOption, ...list];
    }
    return list;
  }, [patients, debouncedQuery, allowAddNew, addNewOption]);

  const handleOpenAdd = (nameHint?: string) => {
    const raw = (nameHint ?? query).trim();
    const parts = raw ? raw.split(/\s+/) : [];
    setAddInitialValues({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
    });
    setAddDialogOpen(true);
  };

  return (
    <>
      <Autocomplete
        options={filteredPatients}
        loading={isSearching}
        loadingText="Searching patients..."
        disabled={disabled}
        fullWidth={fullWidth}
        size={size}
        getOptionLabel={(p) => {
          if (p.id === ADD_NEW_ID) {
            return p.firstName;
          }
          const last = p.lastName ?? '';
          return `${p.firstName ?? ''} ${last}`.trim();
        }}
        filterOptions={(x) => x}
        onInputChange={(_, val, reason) => {
          if (reason === 'input' || reason === 'clear') {
            setQuery(val);
          }
        }}
        value={selectedPatient}
        onChange={(_, p) => {
          if (!p) {
            onChange('', null);
            return;
          }
          if (p.id === ADD_NEW_ID) {
            handleOpenAdd(query);
            return;
          }
          onChange(p.id, p);
        }}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderOption={(props, option) => {
          if (option.id === ADD_NEW_ID) {
            return (
              <Box
                component="li"
                {...props}
                key={option.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.25,
                  px: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  color: 'primary.main',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.16) + ' !important',
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    flexShrink: 0,
                  }}
                >
                  <PersonAddAlt1OutlinedIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Typography fontSize={13.5} fontWeight={700} color="primary.main">
                  {option.firstName}
                </Typography>
              </Box>
            );
          }

          const firstChar = option.firstName?.[0] || '';
          const lastChar = (option.lastName && option.lastName !== 'null') ? option.lastName[0] : '';
          const initials = `${firstChar}${lastChar}`.toUpperCase() || 'P';
          const dob = (option as { dateOfBirth?: string | Date | null }).dateOfBirth;
          const age = option.age ?? (dob ? dateOfBirthToAge(dob) : null);
          const optionLast = option.lastName ?? '';
          const fullName = `${option.firstName ?? ''} ${optionLast}`.trim();
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
                    {fullName}
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
          const firstChar = selectedPatient?.firstName?.[0] || '';
          const lastChar = (selectedPatient?.lastName && selectedPatient.lastName !== 'null')
            ? selectedPatient.lastName[0]
            : '';
          const initials = `${firstChar}${lastChar}`.toUpperCase();
          return (
            <TextField
              {...params}
              label={label}
              placeholder={selectedPatient ? '' : placeholder}
              error={error}
              helperText={helperText}
              fullWidth={fullWidth}
              autoFocus={autoFocus}
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
                    {isSearching ? <CircularProgress color="primary" size={18} sx={{ mr: 0.5 }} /> : null}
                    {allowAddNew && (
                      <Tooltip title="Add new patient" arrow>
                        <IconButton
                          size="small"
                          aria-label="Add new patient"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdd();
                          }}
                          sx={{
                            p: 0.5,
                            mr: 0.25,
                            color: 'primary.main',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) },
                          }}
                        >
                          <PersonAddAlt1OutlinedIcon sx={{ fontSize: 19 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          );
        }}
      />

      {allowAddNew && (
        <PatientDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          initialValues={addInitialValues}
          zIndex={1400}
          onCreated={(created: Patient) => {
            const tokenPerson: TokenPerson = {
              id: created.id,
              firstName: created.firstName,
              lastName: created.lastName ?? '',
              phone: created.phone ?? '',
              mrNumber: created.mrNumber ?? '',
              avatar: null,
              gender: created.gender ?? null,
              age: created.age ?? null,
              dateOfBirth: created.dateOfBirth ?? null,
            } as unknown as TokenPerson;
            setRecentlyCreated(tokenPerson);
            onChange(created.id, tokenPerson);
            setQuery('');
          }}
        />
      )}
    </>
  );
}
