import { useState, type ReactNode } from 'react';
import { IconButton, Tooltip, CircularProgress, Typography, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import SyncDisabledOutlinedIcon from '@mui/icons-material/SyncDisabledOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import SyncProblemOutlinedIcon from '@mui/icons-material/SyncProblemOutlined';
import { useSync } from '@/context/SyncContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { showAppToast } from './AppToast';

export function SyncBadge(): React.JSX.Element | null {
  const theme = useTheme();
  const { isOnline } = useDatabaseMode();
  const { status, isSyncing, syncNow } = useSync();
  const [animating, setAnimating] = useState(false);

  // In offline-first mode, SyncBadge displays cloud/peer sync status
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
          type: isOnline ? 'error' : 'success',
          message: isOnline
            ? (res.error || 'Cloud not reachable. Working offline.')
            : (status.peerName ? `Synced with local peer (${status.peerName})` : 'Local Database active. Data is safely stored on this PC.'),
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
    if (status.state === 'synced') {
      const timeStr = status.lastSyncTime
        ? new Date(status.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';
      const cleanPeer = (status.peerName || '').replace(/\s*\(Neon\)/i, '').trim();
      const isPeerCloud = !cleanPeer || cleanPeer.toLowerCase() === 'cloud';
      const displayLabel = isOnline
        ? 'Cloud Synced'
        : (!isPeerCloud && cleanPeer ? `Synced: ${cleanPeer}` : 'Local Synced');
      const peerText = isPeerCloud ? 'Cloud' : (cleanPeer || (isOnline ? 'Cloud' : 'local clinic network'));
      return {
        label: displayLabel,
        color: theme.palette.success.main,
        bgColor: 'transparent',
        borderColor: 'transparent',
        icon: <CloudDoneOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <CloudDoneOutlinedIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              Synced with {peerText} at {timeStr} • Click to sync now
            </Typography>
          </Stack>
        ),
      };
    }

    if (status.state === 'error' && !animating) {
      return {
        label: 'Sync Retry',
        color: theme.palette.warning.main,
        bgColor: 'transparent',
        borderColor: 'transparent',
        icon: <SyncProblemOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <ErrorOutlineIcon sx={{ fontSize: 16, color: theme.palette.warning.light }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              {status.message || 'Connection issue'} • Click to retry sync
            </Typography>
          </Stack>
        ),
      };
    }

    if (status.state === 'offline' && !animating) {
      if (!isOnline) {
        const hasPeer = Boolean(status.peerName);
        return {
          label: hasPeer ? `Local: ${status.peerName}` : 'Local Mode',
          color: theme.palette.success.main,
          bgColor: 'transparent',
          borderColor: 'transparent',
          icon: hasPeer ? <LanOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} /> : <StorageOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
          tooltip: (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
              <StorageOutlinedIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
              <Typography variant="caption" sx={{ fontSize: 12 }}>
                {hasPeer
                  ? `Connected to local clinic network (${status.peerName}). All data is saved and synced locally.`
                  : 'Operating in Local Database Mode. All clinic data is stored securely on this PC/LAN.'}
              </Typography>
            </Stack>
          ),
        };
      }

      // Online Cloud Mode, but cloud is temporarily unreachable
      return {
        label: 'Cloud Offline',
        color: theme.palette.text.secondary,
        bgColor: 'transparent',
        borderColor: 'transparent',
        icon: <CloudOffOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <WifiOffOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              Cloud database not reachable. Working offline locally. Changes will auto-sync when internet is restored.
            </Typography>
          </Stack>
        ),
      };
    }

    if (isSyncing || animating) {
      const pct = status.progress?.percent;
      const showPct = typeof pct === 'number' && pct > 5 && pct < 100;
      const labelText = showPct ? `Syncing ${pct}%` : 'Syncing...';
      const tooltipText = status.progress?.label || status.message || (isOnline ? 'Exchanging changes with cloud...' : 'Syncing with local clinic network...');
      return {
        label: labelText,
        color: theme.palette.info.main,
        bgColor: 'transparent',
        borderColor: 'transparent',
        icon: <CircularProgress size={20} thickness={4} color="inherit" />,
        tooltip: (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
            <CircularProgress size={14} thickness={4} color="inherit" />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              {tooltipText}
            </Typography>
          </Stack>
        ),
      };
    }

    return {
      label: isOnline ? 'Cloud Sync' : 'Local Mode',
      color: isOnline ? theme.palette.primary.main : theme.palette.success.main,
      bgColor: 'transparent',
      borderColor: 'transparent',
      icon: isOnline ? <CloudDoneOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} /> : <StorageOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
      tooltip: (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
          {isOnline ? <CloudDoneOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} /> : <StorageOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} />}
          <Typography variant="caption" sx={{ fontSize: 12 }}>
            {isOnline ? 'Cloud Sync active. Click to sync now.' : 'Local Database active. All data is saved on this PC.'}
          </Typography>
        </Stack>
      ),
    };
  };

  const display = getStatusDisplay();

  return (
    <Tooltip title={display.tooltip} arrow placement="bottom">
      <IconButton
        onClick={() => void handleManualSync()}
        size="small"
        sx={{
          color: display.color,
        }}
      >
        {display.icon}
      </IconButton>
    </Tooltip>
  );
}
