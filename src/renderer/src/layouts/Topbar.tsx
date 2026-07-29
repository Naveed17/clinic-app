import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useColorMode } from '@/app/colorMode';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { getNavItems } from './navigation';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps): React.JSX.Element {
  const { mode, toggleColorMode } = useColorMode();
  const isDarkMode = mode === 'dark';
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const navItems = user ? getNavItems(user.role, modules) : [];
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [bellAnchor, setBellAnchor] = useState<HTMLElement | null>(null);
  const [avatarAnchor, setAvatarAnchor] = useState<HTMLElement | null>(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  async function handleChangePassword() {
    if (!pwNew || pwNew.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match.'); return; }
    setPwLoading(true); setPwError('');
    const result = await window.clinic?.auth.changePassword(user!.id, pwCurrent, pwNew);
    setPwLoading(false);
    if (result?.ok) { setPwSuccess(true); setTimeout(() => { setPwDialogOpen(false); setPwSuccess(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }, 1500); }
    else { setPwError(result?.error ?? 'Failed to change password.'); }
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const activeIndex = navItems.findIndex((item) => item.path === location.pathname);

  useEffect(() => {
    void realtimeService.connect();
    const unsubscribe = realtimeService.onNotification((n: RealtimeNotification) => {
      setNotificationCount((c) => c + 1);
      setNotifications((prev) => [n, ...prev].slice(0, 50));
    });
    return () => { unsubscribe(); };
  }, []);

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{
        zIndex: 1,
        border: 'none',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.72),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 3,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 48, md: 52 }, gap: 2, px: { xs: 3, md: 1 } }} >
        {/* Mobile menu */}
        < IconButton
          aria-label="Open navigation"
          edge="start"
          onClick={onMenuClick}
          sx={{ display: { md: 'none' }, mr: 0 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Scrollable nav tabs */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, justifyContent: 'center', minWidth: 0 }}>
          <Tabs
            value={activeIndex < 0 ? false : activeIndex}
            onChange={(_, i) => navigate(navItems[i].path)}
            variant={user?.role === 'admin' ? 'scrollable' : 'fullWidth'}
            centered={user?.role !== 'admin'}
            scrollButtons={false}

            sx={{
              width: '100%',
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              borderRadius: 99,
              p: '4px',
              minHeight: 0,
              '& .MuiTabs-indicator': {
                height: '100%',
                borderRadius: 99,
                bgcolor: 'background.paper',
                boxShadow: theme.shadows[2],
                zIndex: 0,
              },
              '& .MuiTabs-scrollButtons': { borderRadius: 99 },
            }}
          >
            {navItems.map((item) => (
              <Tab
                key={item.path}
                label={item.label}
                disableRipple
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  minHeight: 0,
                  px: 2.2,
                  py: 0.85,
                  borderRadius: 99,
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': { fontWeight: 700, color: 'text.primary' },
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          <Box
            onClick={openSearch}
            sx={{
              display: { xs: 'none', lg: 'flex' },
              alignItems: 'center',
              gap: 1,
              width: 200,
              px: 1.5,
              py: 1.2,
              borderRadius: 99,
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              cursor: 'pointer',
              '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.09) },
              transition: 'background 0.15s',
            }}
          >
            <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" color="text.disabled" sx={{ flex: 1, fontSize: 13 }}>Search…</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, bgcolor: alpha(theme.palette.text.primary, 0.08), px: 0.7, py: 0.2, borderRadius: 1 }}>Ctrl K</Typography>
          </Box>
          <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
          <Tooltip title={isDarkMode ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleColorMode} size="small">
              {isDarkMode ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={(e) => setBellAnchor(e.currentTarget)}>
            <Badge badgeContent={notificationCount} color="error" max={99}>
              <NotificationsNoneOutlinedIcon fontSize="small" />
            </Badge>
          </IconButton>

          <Popover
            open={Boolean(bellAnchor)}
            anchorEl={bellAnchor}
            onClose={() => setBellAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { width: 320, borderRadius: 2, mt: 1 } } }}
          >
            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
              {notifications.length > 0 && (
                <Button
                  size="small"
                  startIcon={<DoneAllIcon fontSize="small" />}
                  onClick={() => { setNotifications([]); setNotificationCount(0); }}
                  sx={{ fontSize: '0.72rem' }}
                >
                  Clear all
                </Button>
              )}
            </Box>
            <Divider />
            {notifications.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.disabled">No notifications.</Typography>
              </Box>
            ) : (
              <List dense disablePadding sx={{
                maxHeight: 360, overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
              }}>
                {notifications.map((n) => (
                  <ListItem key={n.id} divider alignItems="flex-start"
                    sx={{ gap: 1, '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%', mt: 0.8, flexShrink: 0,
                      bgcolor: n.kind === 'success' ? 'success.main' : n.kind === 'warning' ? 'warning.main' : n.kind === 'error' ? 'error.main' : 'primary.main',
                    }} />
                    <ListItemText
                      primary={n.title}
                      secondary={n.message}
                      slotProps={{
                        primary: { style: { fontWeight: 600, fontSize: '0.82rem' } },
                        secondary: { style: { fontSize: '0.75rem' } },
                      }}
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, mt: 0.5 }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Popover>
          <Chip
            label={user?.role ?? ''}
            size="small"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              textTransform: 'capitalize',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              fontWeight: 700,
              fontSize: 11,
              height: 22,
            }}
          />
          <Tooltip title={user?.name ?? ''}>
            <Avatar
              sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={(e) => setAvatarAnchor(e.currentTarget)}
            >
              {user?.avatar ?? 'U'}
            </Avatar>
          </Tooltip>

          <Menu anchorEl={avatarAnchor} open={Boolean(avatarAnchor)} onClose={() => setAvatarAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 180 } } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{user?.role}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAvatarAnchor(null); setPwDialogOpen(true); }} sx={{ fontSize: 14, }}>
              <LockOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Change Password
            </MenuItem>
            <MenuItem onClick={() => { setAvatarAnchor(null); handleLogout(); }} sx={{ color: 'error.main', fontSize: 14, }}>
              <LogoutOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>

          <Dialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Change Password</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {pwSuccess && <Alert severity="success">Password changed successfully!</Alert>}
                {pwError && <Alert severity="error">{pwError}</Alert>}
                <TextField label="Current Password" type="password" fullWidth value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
                <TextField label="New Password" type="password" fullWidth value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
                <TextField label="Confirm New Password" type="password" fullWidth value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setPwDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" disabled={pwLoading} onClick={() => void handleChangePassword()}>Save</Button>
            </DialogActions>
          </Dialog>
          <Tooltip title="Logout">
            <IconButton size="small" onClick={handleLogout} sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <LogoutOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar >
  );
}
