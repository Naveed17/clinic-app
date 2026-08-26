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
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

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
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
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
    gap: tokens.spacingHorizontalS,
    width: '100%',
    height: '36px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 120ms ease',
    boxSizing: 'border-box',
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  activeRow: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  activePill: {
    position: 'absolute',
    left: '2px',
    top: '7px',
    bottom: '7px',
    width: '3px',
    borderRadius: '3px',
    backgroundColor: tokens.colorBrandBackground,
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
    flex: 1,
  },
  footer: {
    padding: tokens.spacingHorizontalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    flex: 1,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    textTransform: 'capitalize',
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

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className={styles.sidebarPane}>
      <div className={styles.scrollBody}>
        {grouped.map((group) => (
          <div key={group.section} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div className={styles.sectionTitle}>{group.section}</div>
            {group.items.map((item) => {
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
                  <span className={styles.iconBox}>{item.icon as React.JSX.Element}</span>
                  <span className={styles.itemLabel}>{item.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <Avatar size={28} name={user?.name || 'User'} />
          <div className={styles.userMeta}>
            <Text className={styles.userName}>{user?.name || 'Doctor'}</Text>
            <Text className={styles.userRole}>{user?.role || 'Staff'}</Text>
          </div>
        </div>

        <Tooltip content="Settings" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Settings24Regular />}
            onClick={() => go('/settings')}
          />
        </Tooltip>

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
