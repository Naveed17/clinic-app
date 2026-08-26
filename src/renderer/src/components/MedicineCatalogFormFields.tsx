import {
  Field,
  Input,
  Select,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMemo } from 'react';
import type { Medicine } from '@/types/medicine';
import { findCatalogDuplicate, formatMedicineDisplayName } from '@shared/medicineCatalog';
import { DEFAULT_MEDICINE_TYPE, MEDICINE_TYPES, medicineTypeUsesMg } from '@shared/medicineTypes';

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

interface Props {
  name: string;
  type: string;
  mg: string;
  price: string;
  medicines: Medicine[];
  excludeId?: string;
  onNameChange: (name: string) => void;
  onTypeChange: (type: string) => void;
  onMgChange: (mg: string) => void;
  onPriceChange: (price: string) => void;
  onSelectExisting?: (medicine: Medicine) => void;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
});

export function MedicineCatalogFormFields({
  name,
  type,
  mg,
  price,
  medicines,
  excludeId,
  onNameChange,
  onTypeChange,
  onMgChange,
  onPriceChange,
  onSelectExisting,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const showMg = medicineTypeUsesMg(type || DEFAULT_MEDICINE_TYPE);

  const catalogDuplicate = useMemo(
    () => findCatalogDuplicate(medicines, name, showMg && mg.trim() ? Number(mg) : null, excludeId),
    [medicines, name, mg, showMg, excludeId],
  );

  const applyExisting = (med: Medicine) => {
    onNameChange(med.name);
    onTypeChange(med.type);
    onMgChange(med.mg != null ? String(med.mg) : '');
    onPriceChange(String(med.price));
    onSelectExisting?.(med);
  };

  return (
    <div className={styles.container}>
      {catalogDuplicate && (
        <div style={{ padding: '8px 12px', background: '#fff4ce', borderRadius: '4px', border: '1px solid #f7630c' }}>
          <Text weight="semibold" size={200} style={{ color: '#8a3707' }}>
            Identical medicine exists: <strong>{formatMedicineDisplayName(catalogDuplicate.name, catalogDuplicate.mg)}</strong> ({money(catalogDuplicate.price)})
          </Text>
          {onSelectExisting && (
            <button
              type="button"
              onClick={() => applyExisting(catalogDuplicate)}
              style={{ display: 'block', marginTop: '4px', background: 'none', border: 'none', color: '#0078d4', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              Use existing details & price
            </button>
          )}
        </div>
      )}

      <Field label="Medicine Name" hint="Type medicine name">
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Panadol"
        />
      </Field>

      <Field label="Type">
        <Select
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            onTypeChange(next);
            if (!medicineTypeUsesMg(next)) onMgChange('');
          }}
        >
          {MEDICINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      {showMg && (
        <Field label="Strength (mg)" hint="Optional — e.g. 500">
          <Input
            type="number"
            value={mg}
            onChange={(e) => onMgChange(e.target.value)}
            placeholder="500"
          />
        </Field>
      )}

      <Field label="Price (Rs.)">
        <Input
          type="number"
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          placeholder="0"
        />
      </Field>
    </div>
  );
}

export function medicineCatalogLabel(m: Pick<Medicine, 'name' | 'mg'>): string {
  return formatMedicineDisplayName(m.name, m.mg);
}
