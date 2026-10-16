import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { MuiTelInput, type MuiTelInputCountry, type MuiTelInputInfo, type MuiTelInputProps } from 'mui-tel-input';
import { toPhoneDigits } from '@shared/whatsappPhone';
import {
  Popper,
  Paper,
  Box,
  Typography,
  Chip,
  ClickAwayListener,
} from '@mui/material';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

export interface DistinctPhoneItem {
  phone: string;
  formattedPhone: string;
  patientName: string;
  address?: string | null;
  count: number;
}

export type PhoneInputFieldProps = Omit<
  MuiTelInputProps,
  'value' | 'onChange' | 'defaultCountry' | 'forceCallingCode'
> & {
  value?: string | null;
  onChange: (digits: string) => void;
  /** ISO country when the field is empty. Default PK. */
  defaultCountry?: MuiTelInputCountry;
  /** Whether to show autocomplete dropdown of previously saved phone numbers */
  enableAutocomplete?: boolean;
  /** Called when a saved patient phone is selected from the dropdown */
  onSelectOption?: (option: DistinctPhoneItem) => void;
};

function digitsOf(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Stored 92300… / 97150… → +92300… / +97150… when hydrating from outside the input. */
function toTelValue(raw: string | null | undefined, defaultCountry: MuiTelInputCountry): string {
  const n = digitsOf(raw);
  if (!n) return '';
  const parsed =
    parsePhoneNumberFromString(`+${n}`) || parsePhoneNumberFromString(n, defaultCountry);
  if (parsed?.number && digitsOf(parsed.number) === n) return parsed.number;
  if (n.startsWith('0')) {
    try {
      return `+${getCountryCallingCode(defaultCountry)}${n.replace(/^0+/, '')}`;
    } catch {
      return `+${n}`;
    }
  }
  return `+${n}`;
}

/**
 * Country-aware phone input. Emits digits-only E.164 without '+'
 * using the calling code of the selected flag (PK → 92, AE → 971, US → 1, …).
 * Supports autocomplete dropdown of previously saved numbers when enableAutocomplete is true.
 */
export function PhoneInputField({
  value,
  onChange,
  defaultCountry = 'PK',
  fullWidth = true,
  MenuProps,
  enableAutocomplete = false,
  onSelectOption,
  ...rest
}: PhoneInputFieldProps): JSX.Element {
  const incoming = digitsOf(value);
  const [display, setDisplay] = useState(() => toTelValue(value, defaultCountry));
  const lastEmitted = useRef(incoming);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const debouncedSearch = useDebounce(display, 150);

  useEffect(() => {
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    setDisplay(toTelValue(value, defaultCountry));
  }, [incoming, value, defaultCountry]);

  // Dynamically fetch saved phone numbers with automatic fallback
  const { data: rawOptions = [] } = useQuery<DistinctPhoneItem[]>({
    queryKey: ['patient-distinct-phones', debouncedSearch],
    queryFn: async () => {
      // 1. Try dedicated getPhones API
      try {
        if (window.clinic?.patients?.getPhones) {
          const res = await window.clinic.patients.getPhones(debouncedSearch);
          if (Array.isArray(res) && res.length > 0) return res;
        }
      } catch {
        // Fallback to tokens.patients below
      }

      // 2. Resilient fallback using existing window.clinic.tokens.patients
      try {
        if (window.clinic?.tokens?.patients) {
          const list = await window.clinic.tokens.patients(debouncedSearch);
          if (Array.isArray(list)) {
            const phoneMap = new Map<string, DistinctPhoneItem>();
            for (const p of list) {
              const raw = String(p.phone || '').trim();
              if (!raw || raw.length < 5) continue;
              const d = raw.replace(/\D/g, '');
              let formatted = raw;
              if (d.startsWith('92') && d.length === 12) {
                formatted = `0${d.slice(2, 5)} ${d.slice(5)}`;
              } else if (d.startsWith('0') && d.length === 11) {
                formatted = `${d.slice(0, 4)} ${d.slice(4)}`;
              }
              const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
              if (phoneMap.has(raw)) {
                phoneMap.get(raw)!.count++;
              } else {
                phoneMap.set(raw, {
                  phone: raw,
                  formattedPhone: formatted,
                  patientName: name || 'Patient',
                  address: p.address || null,
                  count: 1,
                });
              }
            }
            return Array.from(phoneMap.values());
          }
        }
      } catch {
        // Return empty if neither is accessible
      }

      return [];
    },
    enabled: Boolean(enableAutocomplete),
    staleTime: 30 * 1000,
  });

  // Filter options based on typed input
  const filteredOptions = useMemo(() => {
    if (!enableAutocomplete || !rawOptions.length) return [];
    const q = display.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '').replace(/^92/, '').replace(/^0+/, '');

    // If empty or just country code, show top recent saved numbers
    if (!q || q === '+92' || q === '+' || q === '+92 ') {
      return rawOptions.slice(0, 30);
    }

    return rawOptions
      .filter((opt) => {
        const optDigits = opt.phone.replace(/\D/g, '').replace(/^92/, '').replace(/^0+/, '');
        const optName = opt.patientName.toLowerCase();
        const optAddress = (opt.address || '').toLowerCase();
        const optFormatted = opt.formattedPhone.toLowerCase();
        return (
          (qDigits && optDigits.includes(qDigits)) ||
          optFormatted.includes(q) ||
          optName.includes(q) ||
          optAddress.includes(q)
        );
      })
      .slice(0, 30);
  }, [enableAutocomplete, display, rawOptions]);

  const handleSelect = (option: DistinctPhoneItem) => {
    const formattedTel = toTelValue(option.phone, defaultCountry);
    setDisplay(formattedTel);
    const out = toPhoneDigits(option.phone, '92');
    lastEmitted.current = out;
    onChange(out);
    onSelectOption?.(option);
    setOpen(false);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={containerRef} sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        <MuiTelInput
          {...rest}
          fullWidth={fullWidth}
          defaultCountry={defaultCountry}
          forceCallingCode
          disableFormatting
          focusOnSelectCountry
          preferredCountries={['PK', 'US', 'GB', 'AE', 'SA']}
          MenuProps={{ disableAutoFocusItem: true, sx: { zIndex: 2500 }, ...MenuProps }}
          value={display}
          onFocus={() => {
            if (enableAutocomplete) setOpen(true);
          }}
          onClick={() => {
            if (enableAutocomplete) setOpen(true);
          }}
          onChange={(next, info: MuiTelInputInfo) => {
            setDisplay(next);
            if (enableAutocomplete) setOpen(true);
            const cc = info.countryCallingCode || '';
            const out = toPhoneDigits(next, cc);
            lastEmitted.current = out;
            onChange(out);
          }}
        />

        {enableAutocomplete && open && filteredOptions.length > 0 && (
          <Popper
            open={open && filteredOptions.length > 0}
            anchorEl={containerRef.current}
            placement="bottom-start"
            sx={{
              zIndex: 2600,
              width: containerRef.current ? containerRef.current.clientWidth : '100%',
            }}
          >
            <Paper
              elevation={8}
              sx={{
                mt: 0.5,
                maxHeight: 260,
                overflowY: 'auto',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                bgcolor: 'background.paper',
              }}
            >
              {filteredOptions.map((opt) => (
                <Box
                  key={opt.phone}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    py: 1.25,
                    px: 1.75,
                    cursor: 'pointer',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <PhoneOutlinedIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }} noWrap>
                        {opt.formattedPhone}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                        noWrap
                      >
                        {opt.patientName}
                        {opt.address ? ` • ${opt.address}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                  {opt.count > 1 && (
                    <Chip
                      label={`${opt.count} saved`}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ fontSize: '0.7rem', height: 20, flexShrink: 0 }}
                    />
                  )}
                </Box>
              ))}
            </Paper>
          </Popper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
