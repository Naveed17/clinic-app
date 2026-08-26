import {
  Avatar,
  Button,
  Drawer,
  DrawerBody,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Settings24Regular,
  SignOut24Regular,
} from '@fluentui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNavItems } from './navigation';

type NavItem = ReturnType<typeof getNavItems>[number];

import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';

export const drawerWidth = 220;

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  sidebarNav: {
    width: `${drawerWidth}px`,
    flexShrink: 0,
    boxSizing: 'border-box',
    display: 'none',
    '@media (min-width: 900px)': {
      display: 'flex',
    },
  },
  showBelowMd: {
    display: 'block',
    '@media (min-width: 900px)': {
      display: 'none',
    },
  },
  sidebarPane: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--cf-sidebar-bg)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderRight: '1px solid var(--cf-sidebar-border)',
    boxShadow: 'var(--cf-sidebar-shadow)',
    boxSizing: 'border-box',
    userSelect: 'none',
    paddingTop: '12px',
  },
  brandRow: {
    padding: '16px 20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandLogo: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '800' as unknown as number,
    fontSize: '14px',
    letterSpacing: '-0.5px',
    flexShrink: 0,
  },
  brandName: {
    fontSize: '17px',
    fontWeight: '700' as unknown as number,
    color: 'var(--cf-sidebar-text)',
    letterSpacing: '-0.3px',
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: '12px',
    paddingRight: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItemRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '42px',
    paddingLeft: '14px',
    paddingRight: '14px',
    borderRadius: '14px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
    boxSizing: 'border-box',
    color: 'var(--cf-sidebar-text-muted)',
    gap: '12px',
    '&:hover': {
      backgroundColor: 'var(--cf-sidebar-hover-bg)',
      color: 'var(--cf-sidebar-text)',
    },
  },
  activeRow: {
    background: 'var(--cf-sidebar-active-bg)',
    color: 'var(--cf-sidebar-active-text)',
    fontWeight: '600' as unknown as number,
    boxShadow: 'var(--cf-sidebar-active-shadow)',
    '&:hover': {
      background: 'var(--cf-sidebar-active-bg)',
      color: 'var(--cf-sidebar-active-text)',
    },
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    width: '20px',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: '13.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userCard: {
    padding: '10px 14px',
    margin: '0 12px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '12px',
    backgroundColor: 'var(--cf-sidebar-user-bg)',
    border: '1px solid var(--cf-sidebar-user-border)',
    backdropFilter: 'blur(10px)',
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: '12px',
    fontWeight: '600' as unknown as number,
    color: 'var(--cf-sidebar-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '11px',
    color: 'var(--cf-sidebar-text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'capitalize',
  },
});

function SidebarContents({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const navItems = user ? getNavItems(user.role, modules) : [];

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className={styles.sidebarPane}>
      {/* Brand */}
      <div className={styles.brandRow}>
        <div className={styles.brandLogo}>CF</div>
        <Text className={styles.brandName}>CareFlow</Text>
      </div>

      {/* Nav Items — flat list, no sections */}
      <div className={styles.scrollBody}>
        {navItems.map((item) => {
          const pathStr = item.path as string;
          const isActive =
            location.pathname === pathStr ||
            (pathStr !== '/' && location.pathname.startsWith(`${pathStr}/`));

          return (
            <div
              key={pathStr}
              className={`${styles.navItemRow} ${isActive ? styles.activeRow : ''}`}
              onClick={() => go(pathStr)}
            >
              <span className={styles.iconBox}>
                {(isActive ? item.activeIcon || item.icon : item.icon) as React.JSX.Element}
              </span>
              <span className={styles.itemLabel}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* User Card */}
      <div className={styles.userCard}>
        <Avatar size={28} name={user?.name || 'User'} />
        <div className={styles.userMeta}>
          <Text className={styles.userName}>{user?.name || 'Doctor'}</Text>
          <Text className={styles.userRole}>{user?.role || 'Staff'}</Text>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Button
          appearance="subtle"
          size="small"
          icon={<Settings24Regular />}
          onClick={() => go('/settings')}
          style={{ color: 'var(--cf-sidebar-text-muted)' }}
        >
          Settings
        </Button>

        <Tooltip content="Logout" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<SignOut24Regular />}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
              onNavigate?.();
            }}
            style={{ color: 'var(--cf-sidebar-text-muted)' }}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <>
      <nav className={styles.sidebarNav} aria-label="Main Navigation">
        <SidebarContents />
      </nav>

      <Drawer
        type="overlay"
        open={mobileOpen}
        onOpenChange={(_, data) => {
          if (!data.open) onClose();
        }}
        position="start"
        className={styles.showBelowMd}
      >
        <DrawerBody style={{ padding: 0, width: drawerWidth }}>
          <SidebarContents onNavigate={onClose} />
        </DrawerBody>
      </Drawer>
    </>
  );
}
