import { Label, Radio, RadioGroup } from '@fluentui/react-components';

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

interface GenderRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
}

export function GenderRadioGroup({
  value,
  onChange,
  label = 'Gender',
  optional = false,
}: GenderRadioGroupProps): React.JSX.Element {
  return (
    <div>
      <Label size="small" weight="semibold">
        {optional ? `${label} (optional)` : label}
      </Label>
      <RadioGroup
        layout="horizontal"
        value={value}
        onChange={(_e, data) => onChange(data.value)}
      >
        {GENDER_OPTIONS.map((g) => (
          <Radio key={g} value={g} label={g} />
        ))}
      </RadioGroup>
    </div>
  );
}
