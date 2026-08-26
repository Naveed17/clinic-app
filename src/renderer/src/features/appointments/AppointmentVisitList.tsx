import { CalendarMonthOutlinedIcon, PrintOutlinedIcon } from '@/icons/fluent';
import { alpha, Avatar, Box, Chip, IconButton, Stack, Tooltip, Typography, useTheme } from '@/compat/fluentMui';
import { chipSx } from '@/components/TableUI';
import type { Appointment } from '@/types/appointment';

const statusColor: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'primary',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  NO_SHOW: 'error',
};

const leftBorder: Record<string, string> = {
  SCHEDULED: 'primary.main',
  CHECKED_IN: 'warning.main',
  COMPLETED: 'success.main',
  CANCELLED: 'divider',
  NO_SHOW: 'error.main',
};

interface Props {
  appointments: Appointment[];
  selectedId?: string;
  onOpen?: (appointment: Appointment) => void;
  onPrint: (appointment: Appointment) => void;
  printingId?: string | null;
  showNotes?: boolean;
}

export function formatTokenLabel(tokenNumber: number | null | undefined): string {
  return tokenNumber != null ? `#${String(tokenNumber).padStart(3, '0')}` : 'No token';
}

export function AppointmentVisitList({
  appointments,
  selectedId,
  onOpen,
  onPrint,
  printingId: _printingId,
  showNotes = true,
}: Props): React.JSX.Element {
  const theme = useTheme();

  if (!appointments.length) {
    return (
      <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
        No visits found.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {appointments.map((a) => {
        const selected = selectedId === a.id;
        return (
          <Box
            key={a.id}
            onClick={() => onOpen?.(a)}
            sx={{
              p: 1.5,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              cursor: onOpen ? 'pointer' : 'default',
              bgcolor: selected
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.03),
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              borderLeft: '4px solid',
              borderLeftColor: leftBorder[a.status] ?? 'divider',
              '&:hover': onOpen ? { bgcolor: alpha(theme.palette.primary.main, 0.07) } : undefined,
            }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.warning.main, 0.14),
                color: 'warning.dark',
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'monospace',
              }}
            >
              {a.tokenNumber != null ? String(a.tokenNumber).padStart(3, '0') : <CalendarMonthOutlinedIcon />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize={14} noWrap>
                    {new Date(a.startsAt).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Dr. {a.provider.firstName} {a.provider.lastName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={a.status.replace('_', ' ')}
                    size="small"
                    color={statusColor[a.status] ?? 'default'}
                    sx={{ ...chipSx, fontWeight: 700, borderRadius: 1 }}
                  />
                  <Tooltip title={a.tokenNumber != null || a.tokenId ? 'Print token' : 'No token for this visit'}>
                    <span onClick={(e) => { e.stopPropagation(); onPrint(a); }}>
                      <IconButton
                        size="small"
                        disabled={!a.tokenNumber && !a.tokenId}
                        sx={{ borderRadius: 1 }}
                      >
                        <PrintOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              {showNotes && a.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 13 }}>
                  {a.notes}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
