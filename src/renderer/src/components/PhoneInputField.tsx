import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Field } from '@fluentui/react-components';
import PhoneInput, {
  getCountryCallingCode,
  type Country,
} from 'react-phone-number-input';
import { toPhoneDigits } from '@shared/whatsappPhone';

export type PhoneInputFieldProps = {
  value?: string | null;
  onChange: (digits: string) => void;
  /** ISO country when the field is empty. Default PK. */
  defaultCountry?: Country;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  validationMessage?: string;
  validationState?: 'error' | 'warning' | 'success' | 'none';
  /** Ignored — MUI-compat */
  size?: string;
  fullWidth?: boolean;
};

function digitsOf(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Stored 92300… → E.164 +92300… for the phone widget. */
function toE164(raw: string | null | undefined): string | undefined {
  const n = digitsOf(raw);
  return n ? `+${n}` : undefined;
}

/**
 * Country-aware phone input (`react-phone-number-input`).
 * Emits digits-only E.164 without '+' (same contract as before).
 */
export function PhoneInputField({
  value,
  onChange,
  defaultCountry = 'PK',
  label,
  required,
  disabled,
  placeholder,
  className,
  validationMessage,
  validationState,
}: PhoneInputFieldProps): JSX.Element {
  const incoming = digitsOf(value);
  const [e164, setE164] = useState<string | undefined>(() => toE164(value));
  const [country, setCountry] = useState<Country>(defaultCountry);
  const lastEmitted = useRef(incoming);

  useEffect(() => {
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    setE164(toE164(value));
  }, [incoming, value]);

  const input = (
    <PhoneInput
      className={['PhoneInputField', className].filter(Boolean).join(' ')}
      international
      defaultCountry={defaultCountry}
      country={country}
      value={e164}
      disabled={disabled}
      placeholder={placeholder ?? 'Enter phone number'}
      onCountryChange={(next) => {
        if (next) setCountry(next);
      }}
      onChange={(next) => {
        const v = next || undefined;
        setE164(v);
        let cc = '';
        try {
          cc = String(getCountryCallingCode(country));
        } catch {
          cc = '';
        }
        const out = toPhoneDigits(v || '', cc);
        lastEmitted.current = out;
        onChange(out);
      }}
    />
  );

  if (!label) return input;

  return (
    <Field
      label={label}
      required={required}
      validationMessage={validationMessage}
      validationState={validationState}
    >
      {input}
    </Field>
  );
}
