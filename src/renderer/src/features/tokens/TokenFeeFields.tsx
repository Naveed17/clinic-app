import { Button, Field, Input, MessageBar, MessageBarActions, MessageBarBody, Text, makeStyles, tokens } from '@fluentui/react-components';
import { tokenChargedFee } from '@shared/tokenFee';

function money(v: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);
}

const useStyles = makeStyles({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  stackCompact: {
    gap: tokens.spacingVerticalS,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalM,
  },
  rowCompact: {
    flexDirection: 'column',
  },
  payable: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
});

export function TokenFeeFields({
  consultationFee,
  feeDiscount,
  onFeeChange,
  onDiscountChange,
  priorVisitsThisWeek = 0,
  compact = false,
}: {
  consultationFee: string;
  feeDiscount: string;
  onFeeChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
  priorVisitsThisWeek?: number;
  compact?: boolean;
}): React.JSX.Element {
  const styles = useStyles();
  const fee = parseFloat(consultationFee) || 0;
  const discount = Math.min(parseFloat(feeDiscount) || 0, fee);
  const payable = tokenChargedFee(fee, discount);
  const followUp = priorVisitsThisWeek > 0;

  function applyHalf(): void {
    onDiscountChange(String(Math.round((fee / 2) * 100) / 100));
  }

  return (
    <div className={`${styles.stack}${compact ? ` ${styles.stackCompact}` : ''}`}>
      {followUp ? (
        <MessageBar intent="info">
          <MessageBarBody>
            This patient already visited this doctor this week. You can apply a follow-up discount.
          </MessageBarBody>
          {fee > 0 ? (
            <MessageBarActions>
              <Button size="small" appearance="transparent" onClick={applyHalf}>
                Half fee
              </Button>
            </MessageBarActions>
          ) : null}
        </MessageBar>
      ) : null}
      <div className={`${styles.row}${compact ? ` ${styles.rowCompact}` : ''}`}>
        <Field label="Consultation fee" style={{ flex: 1 }}>
          <Input
            type="number"
            min={0}
            value={consultationFee}
            onChange={(_, d) => onFeeChange(d.value)}
            contentBefore={<Text size={200}>Rs.</Text>}
          />
        </Field>
        <Field
          label="Discount"
          hint={followUp ? '2nd visit this week' : 'Optional follow-up discount'}
          style={{ flex: 1 }}
        >
          <Input
            type="number"
            min={0}
            max={fee}
            value={feeDiscount}
            onChange={(_, d) => onDiscountChange(d.value)}
            contentBefore={<Text size={200}>Rs.</Text>}
          />
        </Field>
      </div>
      {discount > 0 ? (
        <Text className={styles.payable}>
          Payable: Rs. {money(payable)}
          {discount > 0 ? ` (discount Rs. ${money(discount)})` : ''}
        </Text>
      ) : null}
    </div>
  );
}
