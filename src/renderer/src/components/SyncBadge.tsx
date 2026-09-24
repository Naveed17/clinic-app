import { useState, type ReactNode } from 'react';
import { Button, Tooltip, CircularProgress, Typography, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import SyncDisabledOutlinedIcon from '@mui/icons-material/SyncDisabledOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import { useSync } from '@/context/SyncContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { showAppToast } from './AppToast';

export function SyncBadge(): React.JSX.Element | null {
  const theme = useTheme();
  const { isOnline } = useDatabaseMode();
  const { status, isSyncing, syncNow } = useSync();
  const [animating, setAnimating] = useState(false);

  // If app is configured in Neon cloud mode, local peer sync is not needed
  if (isOnline) {
    return null;
  }

  const handleManualSync = async () => {
    if (isSyncing || animating) return;
    setAnimating(true);
    try {
      const res = await syncNow();
      if (res.ok) {
        const count = res.recordsSynced || 0;
        showAppToast({
          type: 'success',
          message: count > 0 ? `Synced ${count} record${count === 1 ? '' : 's'}` : 'Data is up to date',
        });
      } else {
        showAppToast({
          type: 'error',
          message: res.error || 'Working offline (No clinic peer found)',
        });
      }
    } finally {
      setAnimating(false);
    }
  };

  const getStatusDisplay = (): {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: ReactNode;
    tooltip: ReactNode;
  } => {
    if (isSyncing || animating) {
      const pct = status.progress?.percent;
      const pctText = typeof pct === 'number' && pct > 0 ? ` ${pct}%` : '...';
      const labelText = `Syncing${pctText}`;
      const tooltipText = status.progress?.label || status.message || 'Exchanging changes with clinic peer...';
      return {
        label: labelText,
        color: theme.palette.info.main,
        bgColor: alpha(theme.palette.info.main, 0.12),
        borderColor: alpha(theme.palette.info.main, 0.3),
        icon: <CircularProgress size={13} thickness={4} color="inherit" />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <CircularProgress size={12} thickness={4} color="inherit" />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              {tooltipText}
            </Typography>
          </Stack>
        ),
      };
    }

    if (status.state === 'synced') {
      const timeStr = status.lastSyncTime
        ? new Date(status.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';
      return {
        label: 'Synced',
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.12),
        borderColor: alpha(theme.palette.success.main, 0.3),
        icon: <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 15, color: theme.palette.success.light }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              Synced with {status.peerName || 'clinic'} at {timeStr} • Click to sync now
            </Typography>
          </Stack>
        ),
      };
    }

    if (status.state === 'offline') {
      return {
        label: 'Offline',
        color: theme.palette.text.secondary,
        bgColor: alpha(theme.palette.text.secondary, 0.08),
        borderColor: alpha(theme.palette.text.secondary, 0.2),
        icon: <SyncDisabledOutlinedIcon sx={{ fontSize: 15, color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <WifiOffOutlinedIcon sx={{ fontSize: 15, color: 'inherit' }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              Working offline. All changes are saved locally and will sync when connected to clinic Wi-Fi.
            </Typography>
          </Stack>
        ),
      };
    }

    if (status.state === 'error') {
      return {
        label: 'Sync Retry',
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.12),
        borderColor: alpha(theme.palette.warning.main, 0.3),
        icon: <SyncOutlinedIcon sx={{ fontSize: 15, color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <ErrorOutlineIcon sx={{ fontSize: 15, color: theme.palette.warning.light }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              {status.message || 'Peer connection issue'} • Click to retry sync
            </Typography>
          </Stack>
        ),
      };
    }

    return {
      label: 'Local Sync',
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1),
      borderColor: alpha(theme.palette.primary.main, 0.25),
      icon: <SyncOutlinedIcon sx={{ fontSize: 15, color: 'inherit' }} />,
      tooltip: (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
          <SyncOutlinedIcon sx={{ fontSize: 15, color: 'inherit' }} />
          <Typography variant="caption" sx={{ fontSize: 12 }}>
            Click to sync changes with clinic machine
          </Typography>
        </Stack>
      ),
    };
  };

  const display = getStatusDisplay();

  return (
    <Tooltip title={display.tooltip} arrow>
      <Button
        onClick={() => void handleManualSync()}
        size="small"
        sx={{
          minWidth: 108,
          flexShrink: 0,
          justifyContent: 'center',
          px: 1.2,
          py: 0.5,
          borderRadius: 2,
          textTransform: 'none',
          fontSize: 12,
          fontWeight: 600,
          color: display.color,
          bgcolor: display.bgColor,
          border: '1px solid',
          borderColor: display.borderColor,
          gap: 0.75,
          boxShadow: 'none',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          '&:hover': {
            bgcolor: alpha(display.color, 0.18),
            borderColor: display.color,
          },
        }}
      >
        {display.icon}
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11.5, color: 'inherit', lineHeight: 1 }}>
          {display.label}
        </Typography>
      </Button>
    </Tooltip>
  );
}
