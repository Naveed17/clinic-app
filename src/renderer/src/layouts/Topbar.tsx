import {
  Avatar,
  Button,
  CounterBadge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tab,
  TabList,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useColorMode } from '@/app/colorMode';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { getNavItems } from './navigation';
import { realtimeService, type RealtimeNotification } from '@/services/realtime.service';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { showAppToast } from '@/components/AppToast';
import {
  DarkModeOutlinedIcon,
  DoneAllIcon,
  LightModeOutlinedIcon,
  LockOutlinedIcon,
  LogoutOutlinedIcon,
  MenuIcon,
  NotificationsNoneOutlinedIcon,
  SearchOutlinedIcon,
} from '@/icons/fluent';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';

interface TopbarProps {
  onMenuClick: () => void;
}

const useStyles = makeStyles({
  root: {
    zIndex: 1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: 'var(--cf-commanding-fill)',
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minHeight: '52px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
  },
  tabs: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginLeft: 'auto',
  },
  searchChip: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    width: '200px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: '10px',
    paddingBottom: '10px',
    borderRadius: '99px',
    backgroundColor: tokens.colorNeutralBackground3,
    cursor: 'pointer',
  },
  searchHint: {
    flex: 1,
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
  },
  kbd: {
    fontSize: '10px',
    backgroundColor: tokens.colorNeutralBackground4,
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground3,
  },
  role: {
    textTransform: 'capitalize',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightBold,
    fontSize: '11px',
    height: '22px',
    paddingLeft: '8px',
    paddingRight: '8px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'inline-flex',
    alignItems: 'center',
  },
  notifHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  notifEmpty: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  notifList: {
    maxHeight: '360px',
    overflowY: 'auto',
  },
  notifItem: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '6px',
    flexShrink: 0,
  },
  surface: {
    maxWidth: '400px',
    width: '100%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionsBar: {
    gap: tokens.spacingHorizontalS,
  },
  menuHeader: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  menuName: {
    fontWeight: tokens.fontWeightBold,
  },
  menuRole: {
    textTransform: 'capitalize',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
});

export function Topbar({ onMenuClick }: TopbarProps): React.JSX.Element {
  const styles = useStyles();
  const { mode, toggleColorMode } = useColorMode();
  const isDarkMode = mode === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const navItems = user ? getNavItems(user.role, modules) : [];
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
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
    if (!pwNew || pwNew.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwLoading(true);
    setPwError('');
    const result = await window.clinic?.auth.changePassword(user!.id, pwCurrent, pwNew);
    setPwLoading(false);
    if (result?.ok) {
      showAppToast({ type: 'success', message: 'Password changed' });
      setPwDialogOpen(false);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } else {
      setPwError(result?.error ?? 'Failed to change password.');
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const activeIndex = navItems.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );

  useEffect(() => {
    const unsubscribe = realtimeService.onNotification((n: RealtimeNotification) => {
      setNotificationCount((c) => c + 1);
      setNotifications((prev) => [n, ...prev].slice(0, 50));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const kindColor = (kind: RealtimeNotification['kind']) => {
    if (kind === 'success') return tokens.colorPaletteGreenForeground1;
    if (kind === 'warning') return tokens.colorPaletteYellowForeground1;
    if (kind === 'error') return tokens.colorPaletteRedForeground1;
    return tokens.colorBrandForeground1;
  };

  return (
    <header className={styles.root}>
      <Button
        appearance="subtle"
        icon={<MenuIcon />}
        aria-label="Open navigation"
        onClick={onMenuClick}
        style={{ display: undefined }}
      />

      <div className={styles.tabs}>
        <TabList
          selectedValue={activeIndex < 0 ? undefined : String(activeIndex)}
          onTabSelect={(_, data) => {
            const i = Number(data.value);
            if (!Number.isNaN(i) && navItems[i]) navigate(navItems[i].path);
          }}
          style={{ width: '100%' }}
        >
          {navItems.map((item, i) => (
            <Tab key={item.path} value={String(i)}>
              {item.label}
            </Tab>
          ))}
        </TabList>
      </div>

      <div className={styles.actions}>
        <div className={styles.searchChip} onClick={openSearch} role="button" tabIndex={0}>
          <SearchOutlinedIcon style={{ fontSize: 18 }} />
          <span className={styles.searchHint}>Search…</span>
          <span className={styles.kbd}>Ctrl K</span>
        </div>
        <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

        <Tooltip content={isDarkMode ? 'Light mode' : 'Dark mode'} relationship="label">
          <Button
            appearance="subtle"
            icon={isDarkMode ? <LightModeOutlinedIcon style={{ fontSize: 18 }} /> : <DarkModeOutlinedIcon style={{ fontSize: 18 }} />}
            onClick={toggleColorMode}
          />
        </Tooltip>

        <Popover positioning="below-end">
          <PopoverTrigger disableButtonEnhancement>
            <Button
              appearance="subtle"
              icon={
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <NotificationsNoneOutlinedIcon style={{ fontSize: 18 }} />
                  {notificationCount > 0 ? (
                    <CounterBadge
                      count={notificationCount}
                      overflowCount={99}
                      color="danger"
                      size="small"
                      style={{ position: 'absolute', top: -6, right: -8 }}
                    />
                  ) : null}
                </span>
              }
            />
          </PopoverTrigger>
          <PopoverSurface style={{ width: 320, padding: 0 }}>
            <div className={styles.notifHeader}>
              <Text weight="semibold">Notifications</Text>
              {notifications.length > 0 ? (
                <Button
                  size="small"
                  appearance="transparent"
                  icon={<DoneAllIcon style={{ fontSize: 18 }} />}
                  onClick={() => {
                    setNotifications([]);
                    setNotificationCount(0);
                  }}
                >
                  Clear all
                </Button>
              ) : null}
            </div>
            <Divider />
            {notifications.length === 0 ? (
              <div className={styles.notifEmpty}>No notifications.</div>
            ) : (
              <div className={styles.notifList}>
                {notifications.map((n) => (
                  <div key={n.id} className={styles.notifItem}>
                    <span className={styles.dot} style={{ backgroundColor: kindColor(n.kind) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text weight="semibold" size={200}>
                        {n.title}
                      </Text>
                      <Text size={200} style={{ display: 'block', color: tokens.colorNeutralForeground2 }}>
                        {n.message}
                      </Text>
                    </div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </PopoverSurface>
        </Popover>

        <span className={styles.role}>{user?.role ?? ''}</span>

        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Tooltip content={user?.name ?? ''} relationship="label">
              <Avatar name={user?.name ?? 'U'} color="brand" size={32} style={{ cursor: 'pointer' }} />
            </Tooltip>
          </MenuTrigger>
          <MenuPopover>
            <div className={styles.menuHeader}>
              <div className={styles.menuName}>{user?.name}</div>
              <div className={styles.menuRole}>{user?.role}</div>
            </div>
            <Divider />
            <MenuList>
              <MenuItem
                icon={<LockOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => setPwDialogOpen(true)}
              >
                Change Password
              </MenuItem>
              <MenuItem icon={<LogoutOutlinedIcon style={{ fontSize: 18 }} />} onClick={handleLogout}>
                Logout
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>

        <Dialog
          open={pwDialogOpen}
          onOpenChange={(_, data) => {
            if (!data.open) setPwDialogOpen(false);
          }}
        >
          <DialogSurface className={styles.surface}>
            <FormDialogTitle title="Change Password" subtitle="Enter your current and new password." />
            <DialogBody>
              <DialogContent>
                <div className={styles.form}>
                  {pwError ? (
                    <MessageBar intent="error">
                      <MessageBarBody>{pwError}</MessageBarBody>
                    </MessageBar>
                  ) : null}
                  <Field label="Current Password">
                    <Input type="password" value={pwCurrent} onChange={(_, d) => setPwCurrent(d.value)} />
                  </Field>
                  <Field label="New Password">
                    <Input type="password" value={pwNew} onChange={(_, d) => setPwNew(d.value)} />
                  </Field>
                  <Field label="Confirm New Password">
                    <Input type="password" value={pwConfirm} onChange={(_, d) => setPwConfirm(d.value)} />
                  </Field>
                </div>
              </DialogContent>
            </DialogBody>
            <DialogActions className={styles.actionsBar}>
              <Button appearance="secondary" onClick={() => setPwDialogOpen(false)} disabled={pwLoading}>
                Cancel
              </Button>
              <SubmitButton loading={pwLoading} onClick={() => void handleChangePassword()}>
                Save
              </SubmitButton>
            </DialogActions>
          </DialogSurface>
        </Dialog>
      </div>
    </header>
  );
}
