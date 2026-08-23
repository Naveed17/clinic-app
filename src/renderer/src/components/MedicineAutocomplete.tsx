import {
  Button,
  Combobox,
  Field,
  Input,
  Option,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Medicine } from '@/types/medicine';
import { MedicinePickerDialog } from './MedicinePickerDialog';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { MedicationOutlinedIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  optionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  price: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  wrap: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalXS,
    width: '100%',
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
});

interface Props {
  value: string;
  onChange: (name: string, price: number) => void;
  label?: string;
  size?: 'small' | 'medium';
}

export function MedicineAutocomplete({
  value,
  onChange,
  label = 'Medicine',
}: Props): React.JSX.Element {
  const styles = useStyles();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const catalogOn = useLicense().can('manageMedicines');

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.clinic.medicines.search(''),
    enabled: catalogOn,
  });

  if (!catalogOn) {
    return (
      <Field label={label}>
        <Input value={value} onChange={(_, d) => onChange(d.value, 0)} />
      </Field>
    );
  }

  return (
    <>
      <div className={styles.wrap}>
        <Field label={label} className={styles.field}>
          <Combobox
            value={value}
            freeform
            placeholder="Select or type…"
            onChange={(e) => onChange((e.target as HTMLInputElement).value, 0)}
            onOptionSelect={(_, data) => {
              const med = medicines.find((m) => m.name === data.optionValue);
              if (med) onChange(med.name, Number(med.price));
              else if (data.optionText) onChange(data.optionText, 0);
            }}
          >
            {medicines.map((m) => (
              <Option key={m.id} value={m.name} text={m.name}>
                <div className={styles.optionRow}>
                  <Text size={300}>{m.name}</Text>
                  <Text className={styles.price}>
                    Rs.{' '}
                    {Number(m.price).toLocaleString('en-PK', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </div>
              </Option>
            ))}
          </Combobox>
        </Field>
        <Tooltip content="Add new medicine" relationship="label">
          <Button
            appearance="subtle"
            icon={<MedicationOutlinedIcon style={{ fontSize: 18 }} />}
            aria-label="Add new medicine"
            onClick={() => setAddOpen(true)}
          />
        </Tooltip>
      </div>
      <MedicinePickerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(med) => {
          void qc.invalidateQueries({ queryKey: ['medicines'] });
          onChange(med.name, Number(med.price));
        }}
      />
    </>
  );
}
