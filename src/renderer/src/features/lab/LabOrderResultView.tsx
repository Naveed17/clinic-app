import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import {
  Box, Chip, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { chipSx } from '@/components/TableUI';
import type { LabOrder } from '@/types/lab';
import { LabReportPrint } from './LabReportPrint';
import {
  flagLabel,
  htmlToPlainText,
  isAbnormal,
  labResultPreview,
  parseLabResult,
} from './labReportPayload';

const labLeftBorder: Record<string, string> = {
  COMPLETED: 'success.main',
  IN_PROGRESS: 'primary.main',
  PENDING: 'warning.main',
  CANCELLED: 'error.main',
};

function ResultBody({ result, notes }: { result: string | null; notes?: string | null }): React.JSX.Element | null {
  const theme = useTheme();
  const payload = parseLabResult(result);
  const noteText = notes?.trim() || '';

  if (!payload) {
    const plain = result?.trim() || '';
    if (!plain && !noteText) return null;
    return (
      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
        {plain ? (
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            Result: {plain}
          </Typography>
        ) : null}
        {noteText ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            {noteText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  const filled = payload.rows.filter((row) => row.value.trim());
  const impression = htmlToPlainText(payload.impressionHtml);

  return (
    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
      {(payload.specimen || payload.method) && (
        <Typography variant="caption" color="text.secondary">
          {[payload.specimen && `Specimen: ${payload.specimen}`, payload.method && `Method: ${payload.method}`]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      )}
      {filled.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) auto',
            gap: 0.5,
            alignItems: 'center',
          }}
        >
          {filled.map((row) => {
            const bad = isAbnormal(row.flag);
            return (
              <Box
                key={row.id}
                sx={{
                  display: 'contents',
                  '& > *': {
                    bgcolor: bad ? alpha(theme.palette.error.main, 0.08) : 'transparent',
                    px: 0.75,
                    py: 0.4,
                    fontSize: 12.5,
                  },
                }}
              >
                <Typography sx={{ fontWeight: 600, borderRadius: '6px 0 0 6px' }}>{row.name}</Typography>
                <Typography sx={{ fontWeight: bad ? 800 : 600 }}>
                  {row.value}
                  {row.unit ? ` ${row.unit}` : ''}
                </Typography>
                <Typography
                  color={bad ? 'error.main' : 'text.secondary'}
                  fontWeight={bad ? 800 : 600}
                  sx={{ borderRadius: '0 6px 6px 0', textAlign: 'right' }}
                >
                  {flagLabel(row.flag) || '—'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          {labResultPreview(result)}
        </Typography>
      )}
      {impression ? (
        <Typography variant="body2" sx={{ fontSize: 13 }}>
          Impression: {impression}
        </Typography>
      ) : null}
      {noteText ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          {noteText}
        </Typography>
      ) : null}
    </Stack>
  );
}

export function LabOrderHistoryCard({ order }: { order: LabOrder }): React.JSX.Element {
  const theme = useTheme();
  const [printOpen, setPrintOpen] = useState(false);
  const canPrint = order.status === 'COMPLETED' && Boolean(order.result?.trim());

  return (
    <>
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.info.main, 0.03),
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: '4px solid',
          borderLeftColor: labLeftBorder[order.status] ?? 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} fontSize={14}>{order.test}</Typography>
            <Typography variant="caption" color="text.secondary">
              Ordered {new Date(order.orderedAt).toLocaleDateString()}
              {order.orderedByName ? ` · ${order.orderedByName}` : ''}
            </Typography>
            <ResultBody result={order.result} notes={order.notes} />
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            {canPrint && (
              <Tooltip title="Print report">
                <IconButton size="small" onClick={() => setPrintOpen(true)}>
                  <PrintOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <Chip
              label={order.status.replace('_', ' ')}
              size="small"
              color={order.status === 'COMPLETED' ? 'success' : order.status === 'IN_PROGRESS' ? 'primary' : order.status === 'CANCELLED' ? 'error' : 'warning'}
              sx={{ ...chipSx, fontWeight: 700, borderRadius: 1 }}
            />
          </Stack>
        </Stack>
      </Box>
      {printOpen && <LabReportPrint order={order} onClose={() => setPrintOpen(false)} />}
    </>
  );
}
