import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { MuiTelInput, type MuiTelInputCountry, type MuiTelInputInfo, type MuiTelInputProps } from 'mui-tel-input';
import { toPhoneDigits } from '@shared/whatsappPhone';

export type PhoneInputFieldProps = Omit<
  MuiTelInputProps,
  'value' | 'onChange' | 'defaultCountry' | 'forceCallingCode'
> & {
  value?: string | null;
  onChange: (digits: string) => void;
  /** ISO country when the field is empty. Default PK. */
  defaultCountry?: MuiTelInputCountry;
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
 */
export function PhoneInputField({
  value,
  onChange,
  defaultCountry = 'PK',
  fullWidth = true,
  MenuProps,
  ...rest
}: PhoneInputFieldProps): JSX.Element {
  const incoming = digitsOf(value);
  const [display, setDisplay] = useState(() => toTelValue(value, defaultCountry));
  const lastEmitted = useRef(incoming);

  useEffect(() => {
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    setDisplay(toTelValue(value, defaultCountry));
  }, [incoming, value, defaultCountry]);

  return (
    <MuiTelInput
      {...rest}
      fullWidth={fullWidth}
      defaultCountry={defaultCountry}
      forceCallingCode
      disableFormatting
      focusOnSelectCountry
      preferredCountries={['PK', 'US', 'GB', 'AE', 'SA']}
      MenuProps={{ disableAutoFocusItem: true, sx: { zIndex: 2000 }, ...MenuProps }}
      value={display}
      onChange={(next, info: MuiTelInputInfo) => {
        setDisplay(next);
        const cc = info.countryCallingCode || '';
        // Use the typed string, not info.numberValue — that is often just +92
        // until the national number is complete, which wipes digits as you type.
        const out = toPhoneDigits(next, cc);
        lastEmitted.current = out;
        onChange(out);
      }}
    />
  );
}
