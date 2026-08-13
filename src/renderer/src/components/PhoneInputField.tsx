import type { JSX } from 'react';
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

function digitsOnly(raw: string | null | undefined): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  // Undo PK prefix accidentally stacked on a US E.164 number (+92 +1 555…).
  if (/^921\d{10}$/.test(n)) n = n.slice(2);
  // Legacy local values saved before this field existed (0300…, 300…).
  if (n.startsWith('0')) n = `92${n.replace(/^0+/, '')}`;
  else if (/^3\d{9}$/.test(n)) n = `92${n}`;
  return n;
}

/** Infer flag/calling code from stored digits so PK default does not stack on +1. */
function inferCountry(digits: string, fallback: MuiTelInputCountry): MuiTelInputCountry {
  if (!digits) return fallback;
  if (digits.startsWith('92')) return 'PK';
  if (digits.startsWith('971')) return 'AE';
  if (digits.startsWith('966')) return 'SA';
  if (digits.startsWith('44')) return 'GB';
  if (digits.startsWith('1')) return 'US';
  return fallback;
}

/** Stored 92300… / 1555… → +92300… / +1555… for the input. */
function toTelValue(raw: string | null | undefined): string {
  const digits = digitsOnly(raw);
  if (!digits) return '';
  return `+${digits}`;
}

/**
 * Pakistan-first phone input. Emits digits-only E.164 without '+' (e.g. 923001234567).
 * Country flag follows the number (US test 1555… shows +1, not +92 +1).
 */
export function PhoneInputField({
  value,
  onChange,
  defaultCountry = 'PK',
  fullWidth = true,
  ...rest
}: PhoneInputFieldProps): JSX.Element {
  const digits = digitsOnly(value);
  const country = inferCountry(digits, defaultCountry);

  return (
    <MuiTelInput
      {...rest}
      fullWidth={fullWidth}
      defaultCountry={country}
      forceCallingCode
      preferredCountries={['PK', 'US', 'GB', 'AE', 'SA']}
      value={toTelValue(value)}
      onChange={(next, info: MuiTelInputInfo) => {
        const e164 = info.numberValue || next;
        const out = toWhatsAppNumber(e164) || digitsOnly(e164);
        // Clearing the field leaves the forced calling code behind — treat that as empty.
        onChange(out === (info.countryCallingCode ?? '') ? '' : out);
      }}
    />
  );
}
