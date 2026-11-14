import { useState, type ReactNode } from 'react';
import { IconButton, Tooltip, CircularProgress, Typography, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SyncDisabledOutlinedIcon from '@mui/icons-material/SyncDisabledOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import SyncProblemOutlinedIcon from '@mui/icons-material/SyncProblemOutlined';
import { useSync, type SyncStatus } from '@/context/SyncContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { showAppToast } from './AppToast';

type PeerKind = 'cloud' | 'lan' | 'none';

/** Where the last sync attempt went — derived from the main-process status, not from license mode. */
function peerKindOf(status: SyncStatus): PeerKind {
  if (status.peerName === 'Cloud' || /^https:\/\//i.test(status.peerUrl || '')) return 'cloud';
  if (status.peerUrl) return 'lan';
  return 'none';
}

function lanPeerLabel(status: SyncStatus): string {
  const name = (status.peerName || '').trim();
  if (name && name.toLowerCase() !== 'cloud') return name;
  return (status.peerUrl || '').replace(/^https?:\/\//i, '') || 'LAN server';
}

function formatTime(ms: number | null): string {
  return ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now';
}

/**
 * Offline-first sync indicator. Data always lives on this PC (or the LAN server);
 * the badge only reports background sync with the LAN server and/or the cloud.
 */
export function SyncBadge(): React.JSX.Element | null {
  const theme = useTheme();
  const { isOnline } = useDatabaseMode();
  const { status, isSyncing, syncNow } = useSync();
  const [animating, setAnimating] = useState(false);

  const handleManualSync = async () => {
    if (isSyncing || animating) return;
    setAnimating(true);
    try {
      const res = await syncNow();
      const latest = ((await window.clinic?.sync?.status?.().catch(() => null)) as SyncStatus | null) ?? status;
      const kind = peerKindOf(latest);
      const target = kind === 'cloud' ? 'cloud' : kind === 'lan' ? lanPeerLabel(latest) : null;

      if (!res.ok) {
        showAppToast({
          type: 'error',
          message:
            (res.error || (target ? `${target} not reachable.` : 'Sync failed.')) +
            ' Working offline — changes are saved on this PC and will sync automatically.',
        });
        return;
      }
      if (!target) {
        showAppToast({
          type: 'success',
          message: 'Local Mode: all data is saved on this PC. No LAN server or cloud to sync with.',
        });
        return;
      }
      const count = res.recordsSynced || 0;
      showAppToast({
        type: 'success',
        message:
          count > 0
            ? `Synced ${count} record${count === 1 ? '' : 's'} with ${target}`
            : `Up to date with ${target}`,
      });
    } finally {
      setAnimating(false);
    }
  };

  const tip = (icon: ReactNode, text: string): ReactNode => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
      {icon}
      <Typography variant="caption" sx={{ fontSize: 12 }}>
        {text}
      </Typography>
    </Stack>
  );

  const getStatusDisplay = (): { color: string; icon: ReactNode; tooltip: ReactNode } => {
    const kind = peerKindOf(status);

    // 1. Sync in progress
    if (isSyncing || animating || status.state === 'syncing') {
      const pct = status.progress?.percent;
      const showPct = typeof pct === 'number' && pct > 5 && pct < 100;
      const text =
        status.progress?.label ||
        status.message ||
        (kind === 'lan' ? 'Syncing with LAN server...' : 'Syncing with cloud...');
      return {
        color: theme.palette.info.main,
        icon: <CircularProgress size={20} thickness={4} color="inherit" />,
        tooltip: tip(<CircularProgress size={14} thickness={4} color="inherit" />, showPct ? `${text} (${pct}%)` : text),
      };
    }

    // 2. Last sync succeeded
    if (status.state === 'synced' && kind !== 'none') {
      const time = formatTime(status.lastSyncTime);
      if (kind === 'cloud') {
        return {
          color: theme.palette.success.main,
          icon: <CloudDoneOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
          tooltip: tip(
            <CloudDoneOutlinedIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />,
            `Synced with cloud at ${time}. Data is saved on this PC and backed up online. Click to sync now.`,
          ),
        };
      }
      return {
        color: theme.palette.success.main,
        icon: <LanOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: tip(
          <LanOutlinedIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />,
          `Synced with ${lanPeerLabel(status)} at ${time}. Click to sync now.`,
        ),
      };
    }

    // 3. Last sync failed (server error) — data is still safe locally
    if (status.state === 'error') {
      return {
        color: theme.palette.warning.main,
        icon: <SyncProblemOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: tip(
          <SyncProblemOutlinedIcon sx={{ fontSize: 16, color: theme.palette.warning.light }} />,
          `${status.message || 'Sync failed'}. Data is saved on this PC. Click to retry.`,
        ),
      };
    }

    // 4. Peer not reachable (no internet / LAN server down)
    if (status.state === 'offline' && kind === 'cloud') {
      return {
        color: theme.palette.warning.main,
        icon: <CloudOffOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: tip(
          <CloudOffOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} />,
          'Cloud not reachable. Working offline on this PC — changes will sync automatically when internet is back.',
        ),
      };
    }
    if (status.state === 'offline' && kind === 'lan') {
      return {
        color: theme.palette.warning.main,
        icon: <SyncDisabledOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: tip(
          <SyncDisabledOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} />,
          `${lanPeerLabel(status)} not reachable. Working offline on this PC — changes will sync when the LAN server is back.`,
        ),
      };
    }

    // 5. Nothing synced yet / no sync target
    if (isOnline) {
      return {
        color: theme.palette.primary.main,
        icon: <CloudOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
        tooltip: tip(
          <CloudOutlinedIcon sx={{ fontSize: 16, color: 'inherit' }} />,
          'Cloud sync is on. Data is saved on this PC and syncs to the cloud in the background. Click to sync now.',
        ),
      };
    }
    return {
      color: theme.palette.success.main,
      icon: <StorageOutlinedIcon fontSize="small" sx={{ color: 'inherit' }} />,
      tooltip: tip(
        <StorageOutlinedIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />,
        'Local Mode. All clinic data is stored on this PC.',
      ),
    };
  };

  const display = getStatusDisplay();

  return (
    <Tooltip title={display.tooltip} arrow placement="bottom">
      <IconButton onClick={() => void handleManualSync()} size="small" sx={{ color: display.color }}>
        {display.icon}
      </IconButton>
    </Tooltip>
  );
}
