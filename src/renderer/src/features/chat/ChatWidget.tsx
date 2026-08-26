import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Badge, Box, Fab, Paper, Tooltip, Zoom } from '@mui/material';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ChatWorkspace } from './ChatWorkspace';

export function ChatWidget(): React.JSX.Element | null {
  const { user } = useAuth();
  const { can } = useLicense();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

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
          zIndex: 1400,
          overflow: 'hidden',
          borderRadius: '12px',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        <ChatWorkspace variant="widget" onUnreadChange={setUnread} />
      </Paper>
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
                onClick={() => setOpen((value) => !value)}
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
    </>
  );
}
