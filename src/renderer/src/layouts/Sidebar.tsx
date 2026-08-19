import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import {
  Box,
  Drawer,
  IconButton,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNavItems } from './navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

export const drawerWidth = 60;

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarContents(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const brandLogo = useClinicBrandLogo();
  const navItems = user ? getNavItems(user.role, modules) : [];

  const navBtnSx = (active: boolean) => ({
    width: 44,
    height: 44,
    borderRadius: '12px',
    color: active ? '#fff' : 'text.secondary',
    bgcolor: active ? 'primary.main' : 'transparent',
    boxShadow: active ? '0 4px 12px rgba(22,163,74,0.35)' : 'none',
    transition: 'all 0.18s ease',
    '&:hover': {
      bgcolor: active ? 'primary.main' : alpha(theme.palette.text.primary, 0.06),
      color: active ? '#fff' : 'text.primary',
    },
    '& svg': { fontSize: 20 },
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        py: 2.5,
        gap: 0.5,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '14px',
          bgcolor: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
          overflow: 'hidden',
          p: 0.5,
        }}
      >
        <Box
          component="img"
          src={brandLogo}
          alt="Clinic"
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </Box>

      {/* Nav icons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.path} title={item.label} placement="right">
              <IconButton onClick={() => navigate(item.path)} sx={navBtnSx(isActive)}>
                {item.icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* Bottom icons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
        <Tooltip title="Settings" placement="right">
          <IconButton onClick={() => navigate('/settings')} sx={navBtnSx(location.pathname === '/settings')}>
            <SettingsOutlinedIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Logout" placement="right">
          <IconButton
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            sx={{
              width: 44, height: 44, borderRadius: '12px',
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' },
              '& svg': { fontSize: 20 },
            }}
          >
            <LogoutOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps): React.JSX.Element {
  const theme = useTheme();
  const paperSx = {
    width: drawerWidth,
    boxSizing: 'border-box',
    border: 'none',
    bgcolor: alpha(theme.palette.background.paper, 0.72),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflowX: 'hidden',
    zIndex: 1,
  };

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth + 16 }, flexShrink: { md: 0 }, p: { md: 2 }, pr: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx }}
      >
        <SidebarContents />
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            ...paperSx,
            top: 12,
            left: 12,
            bottom: 12,
            height: 'auto',
          },
        }}
      >
        <SidebarContents />
      </Drawer>
    </Box>
  );
}
