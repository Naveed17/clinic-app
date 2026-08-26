import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Avatar, Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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

export function formatTokenLabel(tokenNumber: number | null | undefined): string {
  return tokenNumber != null ? `#${String(tokenNumber).padStart(3, '0')}` : 'No token';
}

export function AppointmentVisitList({
  appointments,
  currentId,
  onOpen,
  onPrint,
  printingId,
  showNotes = false,
  maxHeight,
}: {
  appointments: Appointment[];
  currentId?: string;
  onOpen?: (appointment: Appointment) => void;
  onPrint: (appointment: Appointment) => void;
  printingId?: string | null;
  showNotes?: boolean;
  maxHeight?: number;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Stack spacing={1} sx={{ p: 2, maxHeight, overflowY: maxHeight ? 'auto' : undefined }}>
      {appointments.map((a) => {
        const selected = currentId === a.id;
        return (
          <Box
            key={a.id}
            onClick={onOpen ? () => onOpen(a) : undefined}
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
              {a.tokenNumber != null ? String(a.tokenNumber).padStart(3, '0') : <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />}
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
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.15 }}>
                    Dr. {a.provider.firstName} {a.provider.lastName}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                  <Chip
                    label={formatTokenLabel(a.tokenNumber)}
                    size="small"
                    color={a.tokenNumber != null ? 'warning' : 'default'}
                    variant={a.tokenNumber != null ? 'outlined' : 'filled'}
                    sx={{ ...chipSx, fontWeight: 800, borderRadius: 1, fontFamily: 'monospace' }}
                  />
                  <Chip
                    label={a.status.replace('_', ' ')}
                    size="small"
                    color={statusColor[a.status] ?? 'default'}
                    sx={{ ...chipSx, fontWeight: 700, borderRadius: 1 }}
                  />
                  <Tooltip title={a.tokenNumber != null || a.tokenId ? 'Print token' : 'No token for this visit'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!a.tokenNumber && !a.tokenId}
                        loading={printingId === a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrint(a);
                        }}
                        sx={{ borderRadius: 1 }}
                      >
                        <PrintOutlinedIcon sx={{ fontSize: 18 }} />
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
