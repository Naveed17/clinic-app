import { Field, Input, makeStyles, tokens } from '@fluentui/react-components';

interface Props {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  field: {
    flex: 1,
  },
});

export function DateRangePickerField({ dateFrom, dateTo, onChange }: Props): React.JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Field label="From Date" className={styles.field}>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
        />
      </Field>
      <Field label="To Date" className={styles.field}>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
        />
      </Field>
    </div>
  );
}
