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
    backgroundColor: 'var(--cf-glass-sidebar, rgba(36, 44, 58, 0.8))',
    backdropFilter: 'blur(30px)',
    borderRight: '1px solid var(--cf-glass-border)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: '#f0f4f8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: tokens.fontSizeBase100,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#f0f4f8',
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
    color: '#94a3b8',
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
    height: '36px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: '10px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 120ms ease',
    boxSizing: 'border-box',
    color: '#cbd5e1',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      color: '#ffffff',
    },
  },
  activeRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    fontWeight: tokens.fontWeightBold,
  },
  activePill: {
    position: 'absolute',
    left: '3px',
    top: '8px',
    bottom: '8px',
    width: '3px',
    borderRadius: '3px',
    backgroundColor: '#38bdf8',
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
    color: '#64748b',
  },
  footer: {
    padding: tokens.spacingHorizontalM,
    borderTop: '1px solid var(--cf-glass-border)',
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

      {/* Search Input */}
      <div className={styles.searchBox}>
        <Input
          size="small"
          placeholder="Find a setting or page"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          contentBefore={<SearchOutlinedIcon style={{ fontSize: 13 }} />}
          className={styles.searchPill}
        />
      </div>

      {/* Nav List */}
      <div className={styles.scrollBody}>
        {grouped.map((group) => (
          <div key={group.section} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
          style={{ color: '#94a3b8' }}
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
            style={{ color: '#94a3b8' }}
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
