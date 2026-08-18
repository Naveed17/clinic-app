import type { JSX } from 'react';
import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { MuiTelInput, type MuiTelInputCountry, type MuiTelInputInfo, type MuiTelInputProps } from 'mui-tel-input';
import { toWhatsAppNumber } from '@shared/whatsappPhone';

export type PhoneInputFieldProps = Omit<
  MuiTelInputProps,
  'value' | 'onChange' | 'defaultCountry' | 'forceCallingCode'
> & {
  value?: string | null;
  onChange: (digits: string) => void;
  /** ISO country when the field is empty. Default PK. */
  defaultCountry?: MuiTelInputCountry;
};

/** Stored 92300… / 97150… → +92300… / +97150… for the input. */
function toTelValue(raw: string | null | undefined, defaultCountry: MuiTelInputCountry): string {
  const n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  const parsed =
    parsePhoneNumberFromString(`+${n}`) || parsePhoneNumberFromString(n, defaultCountry);
  if (parsed?.countryCallingCode) return parsed.number;
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
  ...rest
}: PhoneInputFieldProps): JSX.Element {
  return (
    <MuiTelInput
      {...rest}
      fullWidth={fullWidth}
      defaultCountry={defaultCountry}
      forceCallingCode
      preferredCountries={['PK', 'US', 'GB', 'AE', 'SA']}
      value={toTelValue(value, defaultCountry)}
      onChange={(next, info: MuiTelInputInfo) => {
        const e164 = info.numberValue || next;
        const cc = info.countryCallingCode || '';
        const out = toWhatsAppNumber(e164, cc) || '';
        // Clearing the field leaves the forced calling code behind — treat that as empty.
        onChange(out === cc ? '' : out);
      }}
    />
  );
}
