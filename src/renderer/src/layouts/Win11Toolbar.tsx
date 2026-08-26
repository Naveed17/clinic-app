import {
  Button,
  CounterBadge,
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
  tokens,
} from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useColorMode } from '@/app/colorMode';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import {
  Add24Regular,
  ChevronDown24Regular,
} from '@fluentui/react-icons';
import {
  DarkModeOutlinedIcon,
  DoneAllIcon,
  LightModeOutlinedIcon,
  NotificationsNoneOutlinedIcon,
} from '@/icons/fluent';

const useStyles = makeStyles({
  toolbar: {
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: 'var(--cf-glass-toolbar)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--cf-glass-border)',
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
    boxSizing: 'border-box',
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  newBtn: {
    height: '28px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    borderRadius: tokens.borderRadiusMedium,
    '&:hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  toolDivider: {
    width: '1px',
    height: '18px',
    backgroundColor: tokens.colorNeutralStroke2,
  },
  iconToolBtn: {
    height: '28px',
    fontSize: tokens.fontSizeBase200,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  navBtn: {
    minWidth: '28px',
    height: '28px',
    padding: 0,
    borderRadius: tokens.borderRadiusMedium,
  },
  notifPopover: {
    width: '320px',
    padding: tokens.spacingVerticalM,
  },
});

export function Win11Toolbar(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useColorMode();
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
    <div className={styles.toolbar}>
      <div className={styles.leftGroup}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              size="small"
              icon={<Add24Regular />}
              iconPosition="before"
              className={styles.newBtn}
            >
              New <ChevronDown24Regular style={{ fontSize: 12, marginLeft: 2 }} />
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => navigate('/tokens')}>+ New Token</MenuItem>
              <MenuItem onClick={() => navigate('/patients')}>+ New Patient</MenuItem>
              <MenuItem onClick={() => navigate('/appointments')}>+ New Appointment</MenuItem>
              <MenuItem onClick={() => navigate('/medicines')}>+ Add Medicine</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>

        <div className={styles.toolDivider} />

        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>✂</span> Cut
        </Button>
        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>📋</span> Copy
        </Button>
        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>🏷️</span> Rename
        </Button>
        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>🗑️</span> Delete
        </Button>

        <div className={styles.toolDivider} />

        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>↕️</span> Sort
        </Button>
        <Button appearance="subtle" size="small" className={styles.iconToolBtn}>
          <span style={{ fontSize: '14px' }}>≡</span> View
        </Button>
      </div>

      <div className={styles.rightGroup}>
        <Popover trapFocus>
          <PopoverTrigger disableButtonEnhancement>
            <Tooltip content="Notifications" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<NotificationsNoneOutlinedIcon />}
                className={styles.navBtn}
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
            className={styles.navBtn}
          />
        </Tooltip>
      </div>
    </div>
  );
}
