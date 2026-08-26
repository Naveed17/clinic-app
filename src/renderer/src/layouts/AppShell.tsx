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
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  logoBox: {
    width: '28px',
    height: '28px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  searchPill: {
    width: '280px',
    height: '30px',
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  bodyRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mainViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
  },
  notifPopover: {
    width: '320px',
    padding: tokens.spacingVerticalM,
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
      {/* Top Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoBox}>
            <img className={styles.logoImg} src={brandLogo} alt="Logo" />
          </div>
          <Text className={styles.brandTitle}>CareFlow</Text>
        </div>

        <Input
          size="small"
          placeholder="Search patients, tokens, appointments (Ctrl+K)"
          contentBefore={<SearchOutlinedIcon style={{ fontSize: 14 }} />}
          readOnly
          onClick={() => setSearchOpen(true)}
          className={styles.searchPill}
        />

        <div className={styles.headerRight}>
          <Popover trapFocus>
            <PopoverTrigger disableButtonEnhancement>
              <Tooltip content="Notifications" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<NotificationsNoneOutlinedIcon />}
                  style={{ position: 'relative' }}
                >
                  {unreadCount > 0 && (
                    <CounterBadge
                      count={unreadCount}
                      color="danger"
                      size="small"
                      style={{ position: 'absolute', top: -2, right: -2 }}
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
                    <div key={i} style={{ padding: '6px 8px', borderRadius: '4px', background: tokens.colorNeutralBackground2 }}>
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
              icon={mode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              onClick={toggleColorMode}
            />
          </Tooltip>

          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" style={{ padding: '2px 6px' }}>
                <Avatar size={24} name={user?.name || 'User'} />
              </Button>
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

      {/* Main Body */}
      <div className={styles.bodyRow}>
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className={styles.mainViewport}>
          <Outlet />
        </main>
      </div>

      {searchOpen && <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      <ChatWidget />
    </div>
  );
}
