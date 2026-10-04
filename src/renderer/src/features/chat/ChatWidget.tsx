import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Badge, Box, Fab, IconButton, Paper, Tooltip, Zoom } from '@mui/material';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ChatWorkspace } from './ChatWorkspace';

export interface ChatWidgetProps {
  open?: boolean;
  onClose?: () => void;
  hideFab?: boolean;
  onUnreadChange?: (unread: number) => void;
}

export function ChatWidget({
  open: controlledOpen,
  onClose,
  hideFab = false,
  onUnreadChange,
}: ChatWidgetProps = {}): React.JSX.Element | null {
  const { user } = useAuth();
  const { can } = useLicense();
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;

  const handleClose = () => {
    if (onClose) onClose();
    if (!isControlled) setInternalOpen(false);
  };

  const handleToggle = () => {
    if (open) {
      handleClose();
    } else {
      if (!isControlled) setInternalOpen(true);
    }
  };

  const handleUnreadChange = (count: number) => {
    setUnread(count);
    onUnreadChange?.(count);
  };

  if (!user || !can('chat') || location.pathname === '/chat') return null;

  return (
    <>
      <Paper
        elevation={12}
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 92,
          width: { xs: 'calc(100vw - 32px)', sm: 360 },
          height: { xs: 'min(560px, calc(100vh - 130px))', sm: 520 },
          zIndex: 1450,
          overflow: 'hidden',
          borderRadius: '12px',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label="Close chat"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              color: 'rgba(255, 255, 255, 0.9)',
              bgcolor: 'rgba(0, 0, 0, 0.2)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.4)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <ChatWorkspace variant="widget" onUnreadChange={handleUnreadChange} />
        </Box>
      </Paper>
      {!hideFab && (
        <Zoom in>
          <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1400 }}>
            <Tooltip title={open ? 'Close chat' : 'Staff chat'} placement="left">
              <Badge
                overlap="circular"
                badgeContent={open ? 0 : unread}
                color="error"
                max={9}
                sx={{
                  '& .MuiBadge-badge': {
                    zIndex: 9999,
                    pointerEvents: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                  },
                }}
              >
                <Fab
                  color="primary"
                  onClick={handleToggle}
                  sx={{
                    zIndex: 1,
                    boxShadow: '0 12px 28px rgba(22, 163, 74, 0.35)',
                  }}
                >
                  {open ? <CloseIcon /> : <ChatOutlinedIcon />}
                </Fab>
              </Badge>
            </Tooltip>
          </Box>
        </Zoom>
      )}
    </>
  );
}
