import { useState, useCallback } from 'react';
import {
  Avatar,
  Button,
  CounterBadge,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar, drawerWidth } from './Sidebar';
import { useAuth } from '@/features/auth/AuthContext';
import { useColorMode } from '@/app/colorMode';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { useEffect } from 'react';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { useMaterials } from '@/theme/MaterialsContext';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import {
  DarkModeOutlinedIcon,
  DoneAllIcon,
  LightModeOutlinedIcon,
  NotificationsNoneOutlinedIcon,
  SearchOutlinedIcon,
} from '@/icons/fluent';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: 'var(--cf-canvas-bg)',
    backgroundImage: 'var(--cf-ambient-glow)',
    backgroundAttachment: 'fixed',
  },
  bodyRow: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  header: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '32px',
    paddingRight: '32px',
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    userSelect: 'none',
    zIndex: 10,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  searchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.7)',
    color: '#64748B',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      color: '#1E293B',
    },
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '4px 12px 4px 4px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
    },
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600' as unknown as number,
    color: '#1E293B',
  },
  mainViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    paddingLeft: '32px',
    paddingRight: '32px',
    paddingBottom: '32px',
    boxSizing: 'border-box',
    position: 'relative',
  },
  notifPopover: {
    width: '320px',
    padding: tokens.spacingVerticalM,
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
});

export function AppShell(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const brandLogo = useClinicBrandLogo();
  const { mode, toggleColorMode } = useColorMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  useEffect(() => {
    const unsub = realtimeService.onNotification((n: RealtimeNotification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    });
    return () => unsub();
  }, []);

  const handleClearNotifications = useCallback(() => {
    setUnreadCount(0);
    setNotifications([]);
  }, []);

  return (
    <div className={styles.root}>
      {/* Sidebar on full height */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main Content Area */}
      <div className={styles.bodyRow}>
        {/* Top Floating Glass Header (Image 3 exact match) */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Search Pill Trigger */}
            <div className={styles.searchBtn} onClick={() => setSearchOpen(true)}>
              <SearchOutlinedIcon style={{ fontSize: 15 }} />
              <span>Search patients, appointments... (Ctrl+K)</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <Popover trapFocus>
              <PopoverTrigger disableButtonEnhancement>
                <Tooltip content="Notifications" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<NotificationsNoneOutlinedIcon style={{ fontSize: 20, color: '#475569' }} />}
                    style={{ position: 'relative', borderRadius: '50%', width: '38px', height: '38px' }}
                  >
                    {unreadCount > 0 && (
                      <CounterBadge
                        count={unreadCount}
                        color="danger"
                        size="small"
                        style={{ position: 'absolute', top: 2, right: 2 }}
                      />
                    )}
                  </Button>
                </Tooltip>
              </PopoverTrigger>
              <PopoverSurface className={styles.notifPopover}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <Text weight="semibold">Notifications</Text>
                  {notifications.length > 0 && (
                    <Button appearance="subtle" size="small" icon={<DoneAllIcon />} onClick={handleClearNotifications}>
                      Clear all
                    </Button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>No new notifications</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {notifications.map((n, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.6)' }}>
                        <Text weight="semibold" size={200}>{n.title}</Text>
                        <Text size={100} block style={{ color: tokens.colorNeutralForeground2 }}>{n.message}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverSurface>
            </Popover>

            <Tooltip content={mode === 'dark' ? 'Light Mode' : 'Dark Mode'} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={mode === 'dark' ? <LightModeOutlinedIcon style={{ fontSize: 20 }} /> : <DarkModeOutlinedIcon style={{ fontSize: 20, color: '#475569' }} />}
                onClick={toggleColorMode}
                style={{ borderRadius: '50%', width: '38px', height: '38px' }}
              />
            </Tooltip>

            {/* Profile Avatar + Name (Image 3 match) */}
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <div className={styles.userBadge}>
                  <Avatar size={28} name={user?.name || 'User'} />
                  <span className={styles.userName}>{user?.name || 'Doctor'}</span>
                </div>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem onClick={() => navigate('/settings')}>Settings</MenuItem>
                  <MenuItem onClick={() => { logout(); navigate('/login', { replace: true }); }}>Logout</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </header>

        <main className={styles.mainViewport}>
          <Outlet />
        </main>
      </div>

      {searchOpen && <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      <ChatWidget />
    </div>
  );
}
