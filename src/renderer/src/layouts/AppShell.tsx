import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ChatWidget } from '@/features/chat/ChatWidget';

export function AppShell(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1, overflow: 'hidden' }}>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 99 },
          }}
        >
          <Box sx={{ px: 2, pt: 2, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
            <Topbar onMenuClick={() => setMobileOpen(true)} />
          </Box>
          <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 3, lg: 3 }, py: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 99 },
          }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
      <ChatWidget />
    </Box>
  );
}
