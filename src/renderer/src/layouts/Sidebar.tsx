import {
  Avatar,
  Button,
  Drawer,
  DrawerBody,
  Input,
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
import { useState } from 'react';
import { getNavItems } from './navigation';

type NavItem = ReturnType<typeof getNavItems>[number];

import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { SearchOutlinedIcon } from '@/icons/fluent';

export const drawerWidth = 230;

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
    backdropFilter: 'blur(30px)',
    borderRight: '1px solid var(--cf-sidebar-border)',
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  userCard: {
    padding: tokens.spacingHorizontalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    margin: tokens.spacingHorizontalS,
    borderRadius: '12px',
    backgroundColor: 'var(--cf-sidebar-user-bg)',
    border: '1px solid var(--cf-sidebar-user-border)',
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: 'var(--cf-sidebar-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: tokens.fontSizeBase100,
    color: 'var(--cf-sidebar-text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'capitalize',
  },
  searchBox: {
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  searchPill: {
    width: '100%',
    height: '32px',
    borderRadius: '99px',
    backgroundColor: 'var(--cf-sidebar-search-bg)',
    border: '1px solid var(--cf-sidebar-search-border)',
    color: 'var(--cf-sidebar-text)',
    fontSize: tokens.fontSizeBase200,
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: tokens.fontWeightSemibold,
    color: 'var(--cf-sidebar-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXXS,
  },
  navItemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '38px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: '10px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 120ms ease',
    boxSizing: 'border-box',
    color: 'var(--cf-sidebar-text)',
    '&:hover': {
      backgroundColor: 'var(--cf-sidebar-hover-bg)',
    },
  },
  activeRow: {
    backgroundColor: 'var(--cf-sidebar-active-bg)',
    color: 'var(--cf-sidebar-active-text)',
    fontWeight: tokens.fontWeightBold,
  },
  activePill: {
    position: 'absolute',
    left: '3px',
    top: '8px',
    bottom: '8px',
    width: '3px',
    borderRadius: '3px',
    backgroundColor: 'var(--cf-sidebar-active-bar)',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    width: '18px',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  arrowIcon: {
    fontSize: '11px',
    color: 'var(--cf-sidebar-text-muted)',
  },
  footer: {
    padding: tokens.spacingHorizontalM,
    borderTop: '1px solid var(--cf-sidebar-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

function groupNavItems(items: NavItem[]): { section: string; items: NavItem[] }[] {
  const quickAccessPaths = ['/', '/tokens', '/patients', '/appointments'];
  const clinicalPaths = ['/prescriptions', '/medicines', '/lab', '/reports'];

  const quick: NavItem[] = [];
  const clinical: NavItem[] = [];
  const admin: NavItem[] = [];

  items.forEach((item) => {
    const p = item.path as string;
    if (quickAccessPaths.includes(p)) {
      quick.push(item);
    } else if (clinicalPaths.includes(p)) {
      clinical.push(item);
    } else {
      admin.push(item);
    }
  });

  const res = [];
  if (quick.length) res.push({ section: 'Quick Access', items: quick });
  if (clinical.length) res.push({ section: 'Clinical Services', items: clinical });
  if (admin.length) res.push({ section: 'Administration', items: admin });
  return res;
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const navItems = user ? getNavItems(user.role, modules) : [];
  const grouped = groupNavItems(navItems);
  const [filterText, setFilterText] = useState('');

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className={styles.sidebarPane}>
      {/* User Profile Card */}
      <div className={styles.userCard}>
        <Avatar size={32} name={user?.name || 'User'} />
        <div className={styles.userMeta}>
          <Text className={styles.userName}>{user?.name || 'Doctor'}</Text>
          <Text className={styles.userEmail}>{user?.role || 'Staff'} · CareFlow</Text>
        </div>
      </div>

      {/* Filter Search Box */}
      <div className={styles.searchBox}>
        <Input
          size="small"
          placeholder="Find a page"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          contentBefore={<SearchOutlinedIcon style={{ fontSize: 13 }} />}
          className={styles.searchPill}
        />
      </div>

      {/* Nav Group List */}
      <div className={styles.scrollBody}>
        {grouped.map((group) => (
          <div key={group.section} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div className={styles.sectionTitle}>{group.section}</div>
            {group.items
              .filter((i) => !filterText || i.label.toLowerCase().includes(filterText.toLowerCase()))
              .map((item) => {
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
                    {isActive && <div className={styles.activePill} />}
                    <div className={styles.itemLeft}>
                      <span className={styles.iconBox}>{item.icon as React.JSX.Element}</span>
                      <span className={styles.itemLabel}>{item.label}</span>
                    </div>
                    <span className={styles.arrowIcon}>&#10140;</span>
                  </div>
                );
              })}
          </div>
        ))}
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
