import {
  Button,
  Drawer,
  DrawerBody,
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
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

export const drawerWidth = 60;

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  nav: {
    width: `${drawerWidth + 16}px`,
    flexShrink: 0,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    boxSizing: 'border-box',
  },
  hideBelowMd: {
    display: 'none',
    '@media (min-width: 900px)': {
      display: 'block',
    },
  },
  showBelowMd: {
    display: 'block',
    '@media (min-width: 900px)': {
      display: 'none',
    },
  },
  rail: {
    width: `${drawerWidth}px`,
    boxSizing: 'border-box',
    border: 'none',
    backgroundColor: 'var(--cf-commanding-fill)',
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'hidden',
    height: 'calc(100vh - 24px)',
    position: 'fixed',
    top: '12px',
    left: '12px',
    zIndex: 1,
  },
  contents: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    gap: tokens.spacingVerticalXXS,
  },
  logo: {
    width: '42px',
    height: '42px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalL,
    flexShrink: 0,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
    padding: tokens.spacingHorizontalXXS,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  navStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    flex: 1,
  },
  bottomStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
  },
  navBtn: {
    width: '44px',
    minWidth: '44px',
    height: '44px',
    borderRadius: tokens.borderRadiusMedium,
  },
});

function SidebarContents({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const modules = useLicenseModules();
  const brandLogo = useClinicBrandLogo();
  const navItems = user ? getNavItems(user.role, modules) : [];

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className={styles.contents}>
      <div className={styles.logo}>
        <img className={styles.logoImg} src={brandLogo} alt="Clinic" />
      </div>

      <div className={styles.navStack}>
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Tooltip key={item.path} content={item.label} relationship="label" positioning="after">
              <Button
                appearance={isActive ? 'primary' : 'subtle'}
                className={styles.navBtn}
                icon={item.icon as React.JSX.Element}
                onClick={() => go(item.path)}
                aria-label={item.label}
              />
            </Tooltip>
          );
        })}
      </div>

      <div className={styles.bottomStack}>
        <Tooltip content="Settings" relationship="label" positioning="after">
          <Button
            appearance={
              location.pathname === '/settings' || location.pathname.startsWith('/settings/')
                ? 'primary'
                : 'subtle'
            }
            className={styles.navBtn}
            icon={<Settings24Regular />}
            onClick={() => go('/settings')}
            aria-label="Settings"
          />
        </Tooltip>
        <Tooltip content="Logout" relationship="label" positioning="after">
          <Button
            appearance="subtle"
            className={styles.navBtn}
            icon={<SignOut24Regular />}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
              onNavigate?.();
            }}
            aria-label="Logout"
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
      <nav className={`${styles.nav} ${styles.hideBelowMd}`} aria-label="Main">
        <div className={styles.rail}>
          <SidebarContents />
        </div>
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
        <DrawerBody style={{ padding: 0, width: drawerWidth + 24 }}>
          <SidebarContents onNavigate={onClose} />
        </DrawerBody>
      </Drawer>
    </>
  );
}
