import { Field } from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { TimePicker, type TimePickerProps } from '@fluentui/react-timepicker-compat';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

export interface FluentDateFieldProps {
  label: string;
  value: Date | null | undefined;
  onSelectDate: (date: Date | null | undefined) => void;
  placeholder?: string;
  required?: boolean;
  validationMessage?: string;
  validationState?: 'error' | 'warning' | 'success' | 'none';
  disabled?: boolean;
  className?: string;
}

export function FluentDateField({
  label,
  value,
  onSelectDate,
  placeholder = 'Select a date...',
  required,
  validationMessage,
  validationState,
  disabled,
  className,
}: FluentDateFieldProps): React.JSX.Element {
  return (
    <Field
      label={label}
      required={required}
      validationMessage={validationMessage}
      validationState={validationState}
      className={className}
    >
      <DatePicker
        placeholder={placeholder}
        value={value ?? null}
        onSelectDate={onSelectDate}
        formatDate={(date) => (date ? dayjs(date).format('DD/MM/YYYY') : '')}
        disabled={disabled}
        allowTextInput
      />
    </Field>
  );
}

export interface FluentTimeFieldProps {
  label: string;
  selectedTime: Date | null | undefined;
  onTimeChange: TimePickerProps['onTimeChange'];
  value?: string;
  placeholder?: string;
  required?: boolean;
  validationMessage?: string;
  validationState?: 'error' | 'warning' | 'success' | 'none';
  disabled?: boolean;
  freeform?: boolean;
  dateAnchor?: Date;
  className?: string;
}

export function FluentTimeField({
  label,
  selectedTime,
  onTimeChange,
  value,
  placeholder = 'Select a time...',
  required,
  validationMessage,
  validationState,
  disabled,
  freeform = true,
  dateAnchor,
  className,
}: FluentTimeFieldProps): React.JSX.Element {
  return (
    <Field
      label={label}
      required={required}
      validationMessage={validationMessage}
      validationState={validationState}
      className={className}
    >
      <TimePicker
        placeholder={placeholder}
        selectedTime={selectedTime ?? null}
        onTimeChange={onTimeChange}
        value={value}
        disabled={disabled}
        freeform={freeform}
        dateAnchor={dateAnchor}
      />
    </Field>
  );
}

/** Storage / API: YYYY-MM-DD via dayjs (no @date-io). */
export function formatDateIso(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return dayjs(date).format('YYYY-MM-DD');
}

export function parseDateIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = dayjs(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return d.isValid() ? d.toDate() : null;
}

/** Helper text node for Field-less layouts. */
export function DateFieldHint({ children }: { children: ReactNode }): React.JSX.Element {
  return <>{children}</>;
}
