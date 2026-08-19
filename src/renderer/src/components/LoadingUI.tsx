import { Box, LinearProgress, Paper, Skeleton, Stack, TableCell, TableRow } from '@mui/material';
import { tableSx } from '@/components/TableUI';

export function TableRowsSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }): React.JSX.Element {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} sx={tableSx.row}>
          {Array.from({ length: cols }, (_, c) => (
            <TableCell key={c}>
              <Skeleton
                variant="rounded"
                height={c === 0 ? 22 : 14}
                width={c === 0 ? '72%' : `${40 + ((i + c) % 4) * 12}%`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }): React.JSX.Element {
  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
      {Array.from({ length: count }, (_, i) => (
        <Paper
          key={i}
          elevation={0}
          sx={{ p: 3, borderRadius: '24px', border: '1px solid', borderColor: 'divider' }}
        >
          <Skeleton variant="text" width={88} height={40} />
          <Skeleton variant="text" width={150} height={22} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width={110} height={16} />
        </Paper>
      ))}
    </Box>
  );
}

export function ListCardsSkeleton({ count = 5 }: { count?: number }): React.JSX.Element {
  return (
    <Stack spacing={1.2}>
      {Array.from({ length: count }, (_, i) => (
        <Paper
          key={i}
          elevation={0}
          sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="58%" height={20} />
              <Skeleton variant="text" width="38%" height={16} />
            </Box>
            <Skeleton variant="rounded" width={64} height={22} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function CalendarSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ flex: 1, minHeight: 0, p: 3, width: '100%' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
        <Skeleton variant="rounded" width={168} height={28} />
        <Box sx={{ flex: 1 }} />
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="circular" width={32} height={32} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} variant="text" height={18} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Box>
    </Box>
  );
}

export function FetchingBar({ show }: { show: boolean }): React.JSX.Element | null {
  if (!show) return null;
  return (
    <LinearProgress
      sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2, borderRadius: 0 }}
    />
  );
}
