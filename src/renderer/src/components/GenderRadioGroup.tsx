import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';

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
    <FormControl>
      <FormLabel sx={{ fontSize: 13.5, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
        {optional ? `${label} (optional)` : label}
      </FormLabel>
      <RadioGroup
        row
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ gap: { xs: 0, sm: 1 } }}
      >
        {GENDER_OPTIONS.map((g) => (
          <FormControlLabel
            key={g}
            value={g}
            control={<Radio size="small" />}
            label={g}
            sx={{ '& .MuiFormControlLabel-label': { fontSize: 13.5 } }}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
