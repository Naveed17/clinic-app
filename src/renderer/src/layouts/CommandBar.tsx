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
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useColorMode } from '@/app/colorMode';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import {
  ArrowClockwise24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import {
  DarkModeOutlinedIcon,
  DoneAllIcon,
  LightModeOutlinedIcon,
  NotificationsNoneOutlinedIcon,
} from '@/icons/fluent';

const useStyles = makeStyles({
  bar: {
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: 'var(--cf-mica-commandbar, rgba(255, 255, 255, 0.6))',
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
    boxSizing: 'border-box',
  },
  leftGroup: {
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
  breadcrumbPath: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  breadcrumbActive: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  actionBtn: {
    height: '30px',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  notifPopover: {
    width: '320px',
    padding: tokens.spacingVerticalM,
  },
});

export function CommandBar(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useColorMode();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  const pathParts = location.pathname.split('/').filter(Boolean);

  const getBreadcrumbs = () => {
    if (pathParts.length === 0) return ['Home'];
    return [
      'CareFlow',
      ...pathParts.map((p) =>
        p
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      ),
    ];
  };

  const breadcrumbs = getBreadcrumbs();

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
    <div className={styles.bar}>
      <div className={styles.leftGroup}>
        <Tooltip content="Back" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronLeft24Regular />}
            onClick={() => navigate(-1)}
            className={styles.navBtn}
          />
        </Tooltip>

        <Tooltip content="Forward" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronRight24Regular />}
            onClick={() => navigate(1)}
            className={styles.navBtn}
          />
        </Tooltip>

        <Tooltip content="Refresh Page" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowClockwise24Regular />}
            onClick={() => window.location.reload()}
            className={styles.navBtn}
          />
        </Tooltip>

        <div className={styles.breadcrumbPath}>
          {breadcrumbs.map((part, idx) => (
            <span key={part + idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {idx > 0 && <span style={{ color: tokens.colorNeutralForeground4 }}>/</span>}
              <span className={idx === breadcrumbs.length - 1 ? styles.breadcrumbActive : undefined}>
                {part}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.rightGroup}>
        <Button
          appearance="primary"
          size="small"
          onClick={() => navigate('/tokens')}
          className={styles.actionBtn}
        >
          + New Token
        </Button>

        <Button
          appearance="outline"
          size="small"
          onClick={() => navigate('/patients')}
          className={styles.actionBtn}
        >
          + New Patient
        </Button>

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

        <Tooltip content={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} relationship="label">
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
