import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { tokenChargedFee } from '@shared/tokenFee';

function money(v: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);
}

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
  const fee = parseFloat(consultationFee) || 0;
  const discount = Math.min(parseFloat(feeDiscount) || 0, fee);
  const payable = tokenChargedFee(fee, discount);
  const followUp = priorVisitsThisWeek > 0;

  function applyHalf(): void {
    onDiscountChange(String(Math.round((fee / 2) * 100) / 100));
  }

  return (
    <Stack spacing={compact ? 1 : 1.5}>
      {followUp ? (
        <Alert
          severity="info"
          sx={{
            alignItems: 'center',
            '& .MuiAlert-action': { flexShrink: 0, pt: 0, pl: 1.5 },
            '& .MuiAlert-message': { pr: 1 },
          }}
          action={
            fee > 0 ? (
              <Button
                color="inherit"
                size="small"
                onClick={applyHalf}
                sx={{ whiteSpace: 'nowrap', minWidth: 'max-content', flexShrink: 0 }}
              >
                Half fee
              </Button>
            ) : undefined
          }
        >
          This patient already visited this doctor this week. You can apply a follow-up discount.
        </Alert>
      ) : null}
      <Stack direction={compact ? 'column' : 'row'} spacing={1.5}>
        <TextField
          label="Consultation fee"
          type="number"
          fullWidth
          size={compact ? 'small' : 'medium'}
          value={consultationFee}
          onChange={(e) => onFeeChange(e.target.value)}
          slotProps={{
            htmlInput: { min: 0, step: 'any' },
            input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> },
          }}
        />
        <TextField
          label="Discount"
          type="number"
          fullWidth
          size={compact ? 'small' : 'medium'}
          value={feeDiscount}
          onChange={(e) => onDiscountChange(e.target.value)}
          helperText={followUp ? '2nd visit this week' : 'Optional follow-up discount'}
          slotProps={{
            htmlInput: { min: 0, max: fee, step: 'any' },
            input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> },
          }}
        />
      </Stack>
      {discount > 0 ? (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Payable: Rs. {money(payable)}
            {discount > 0 ? ` (discount Rs. ${money(discount)})` : ''}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
