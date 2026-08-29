import React from 'react';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
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
  defaultDoctorFee,
  priorVisitsThisWeek = 0,
  compact = false,
  disabled = false,
}: {
  consultationFee: string;
  feeDiscount: string;
  onFeeChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
  defaultDoctorFee?: number | string;
  priorVisitsThisWeek?: number;
  compact?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const fee = parseFloat(consultationFee) || 0;
  const discount = Math.min(parseFloat(feeDiscount) || 0, fee);
  const payable = tokenChargedFee(fee, discount);
  const followUp = priorVisitsThisWeek > 0;
  const isFree = fee === 0 || (fee > 0 && discount >= fee);
  const isHalf = fee > 0 && discount > 0 && discount < fee;

  const selectedMode = isFree ? 'free' : isHalf ? 'half' : 'paid';

  function handleModeChange(_e: React.MouseEvent<HTMLElement>, mode: string | null): void {
    if (!mode || disabled) return;
    if (mode === 'free') {
      onFeeChange('0');
      onDiscountChange('0');
    } else if (mode === 'paid') {
      const base =
        defaultDoctorFee !== undefined && defaultDoctorFee !== ''
          ? String(Number(defaultDoctorFee) || 0)
          : fee > 0
            ? String(fee)
            : '2000';
      onFeeChange(base);
      onDiscountChange('0');
    } else if (mode === 'half') {
      if (fee > 0) {
        onDiscountChange(String(Math.round((fee / 2) * 100) / 100));
      }
    }
  }

  function applyHalf(): void {
    if (fee > 0 && !disabled) {
      onDiscountChange(String(Math.round((fee / 2) * 100) / 100));
    }
  }

  return (
    <Stack spacing={1.25}>
      {disabled && (
        <Alert
          severity="info"
          icon={<LockOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            py: 0.25,
            px: 1.5,
            fontSize: 12,
            fontWeight: 600,
            bgcolor: alpha(theme.palette.info.main, 0.08),
            borderRadius: 1.5,
          }}
        >
          Select a doctor first to enable fee options.
        </Alert>
      )}

      {followUp && !disabled && (
        <Alert
          severity="info"
          sx={{
            alignItems: 'center',
            py: 0.25,
            '& .MuiAlert-action': { flexShrink: 0, pt: 0, pl: 1.5 },
            '& .MuiAlert-message': { pr: 1, fontSize: 12 },
          }}
          action={
            fee > 0 ? (
              <Button
                color="inherit"
                size="small"
                onClick={applyHalf}
                sx={{ whiteSpace: 'nowrap', minWidth: 'max-content', flexShrink: 0, fontWeight: 700, fontSize: 11 }}
              >
                Half fee
              </Button>
            ) : undefined
          }
        >
          Patient visited this doctor this week ({priorVisitsThisWeek} prior visit).
        </Alert>
      )}

      {/* Minimalistic & Compact Inline Fee Option Segmented Bar */}
      <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="space-between">
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
          Fee Option
        </Typography>

        <ToggleButtonGroup
          exclusive
          value={selectedMode}
          onChange={handleModeChange}
          disabled={disabled}
          sx={{
            height: 28,
            p: '2px',
            borderRadius: '999px',
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            gap: '2px',
            maxWidth: 280,
            ml: 'auto',
            '& .MuiToggleButtonGroup-grouped': {
              border: 'none !important',
              borderRadius: '999px !important',
              px: 1.25,
              py: 0,
              height: '100%',
              fontSize: 11.5,
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.15s ease',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              '&.Mui-disabled': {
                opacity: 0.4,
              },
            },
          }}
        >
          <ToggleButton
            value="paid"
            sx={{
              '&.Mui-selected': {
                bgcolor: `${theme.palette.primary.main} !important`,
                color: `${theme.palette.primary.contrastText} !important`,
                fontWeight: '700 !important',
              },
            }}
          >
            Paid Visit
          </ToggleButton>

          <ToggleButton
            value="free"
            sx={{
              '&.Mui-selected': {
                bgcolor: `${theme.palette.success.main} !important`,
                color: `${theme.palette.success.contrastText} !important`,
                fontWeight: '700 !important',
              },
            }}
          >
            Free Checkup
          </ToggleButton>

          {fee > 0 && (
            <ToggleButton
              value="half"
              sx={{
                '&.Mui-selected': {
                  bgcolor: `${theme.palette.warning.main} !important`,
                  color: `${theme.palette.warning.contrastText} !important`,
                  fontWeight: '700 !important',
                },
              }}
            >
              50% Off
            </ToggleButton>
          )}
        </ToggleButtonGroup>
      </Stack>

      <Stack direction={compact ? 'column' : 'row'} spacing={1.5}>
        <TextField
          label="Consultation fee"
          type="number"
          fullWidth
          disabled={disabled}
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
          disabled={disabled}
          size={compact ? 'small' : 'medium'}
          value={feeDiscount}
          onChange={(e) => onDiscountChange(e.target.value)}
          helperText={followUp ? '2nd visit this week' : undefined}
          slotProps={{
            htmlInput: { min: 0, max: fee, step: 'any' },
            input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> },
          }}
        />
      </Stack>

      {(discount > 0 || isFree) && !disabled && (
        <Box sx={{ mt: -0.5 }}>
          <Typography variant="caption" color={isFree ? 'success.main' : 'text.secondary'} fontWeight={700} sx={{ fontSize: 11.5 }}>
            {isFree ? 'Free Checkup (Payable: Rs. 0)' : `Payable: Rs. ${money(payable)} (Discount Rs. ${money(discount)})`}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
