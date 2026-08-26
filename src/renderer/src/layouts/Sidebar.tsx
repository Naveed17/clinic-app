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
    backgroundColor: 'var(--cf-mica-sidebar, rgba(255, 255, 255, 0.55))',
    backdropFilter: 'blur(20px)',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  header: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  logoBox: {
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  clinicName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
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
    letterSpacing: '0.6px',
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
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 120ms ease, color 120ms ease',
    boxSizing: 'border-box',
    textDecoration: 'none',
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  activeRow: {
    backgroundColor: 'var(--cf-nav-active-fill, rgba(0, 120, 212, 0.08))',
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  activePill: {
    position: 'absolute',
    left: '3px',
    top: '8px',
    bottom: '8px',
    width: '3px',
    borderRadius: '3px',
    backgroundColor: tokens.colorBrandForeground1,
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
    if (quickAccessPaths.includes(item.path)) {
      quick.push(item);
    } else if (clinicalPaths.includes(item.path)) {
      clinical.push(item);
    } else {
      admin.push(item);
    }
  });

  const res = [];
  if (quick.length) res.push({ section: 'Quick Access', items: quick });
  if (clinical.length) res.push({ section: 'Clinical', items: clinical });
  if (admin.length) res.push({ section: 'Administration', items: admin });
  return res;
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const brandLogo = useClinicBrandLogo();
  const navItems = user ? getNavItems(user.role, modules) : [];
  const grouped = groupNavItems(navItems);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className={styles.sidebarPane}>
      <div className={styles.header}>
        <div className={styles.logoBox}>
          <img className={styles.logoImg} src={brandLogo} alt="Logo" />
        </div>
        <Text className={styles.clinicName}>CareFlow</Text>
      </div>

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
                  key={item.path}
                  className={`${styles.navItemRow} ${isActive ? styles.activeRow : ''}`}
                  onClick={() => go(item.path)}
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
