import { useState } from 'react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Win11Header } from './Win11Header';
import { Win11Toolbar } from './Win11Toolbar';
import { Win11StatusBar } from './Win11StatusBar';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { useMaterials } from '@/theme/MaterialsContext';

const useStyles = makeStyles({
  windowRoot: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    transitionProperty: 'background-color',
    transitionDuration: '150ms',
    fontFamily: 'Segoe UI Variable Display, Segoe UI, Inter, sans-serif',
    background: 'var(--cf-win11-wallpaper)',
  },
  micaActive: {
    backgroundColor: 'transparent',
  },
  micaInactive: {
    backgroundColor: 'var(--cf-mica-fallback, rgba(230, 240, 255, 0.95))',
  },
  solidFallback: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  bodyRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mainColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    padding: tokens.spacingHorizontalM,
    gap: tokens.spacingVerticalS,
    boxSizing: 'border-box',
  },
  contentViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: 'var(--cf-glass-surface)',
    backdropFilter: 'blur(30px)',
    borderRadius: '14px',
    border: '1px solid var(--cf-glass-border)',
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
    boxShadow: 'var(--cf-glass-shadow)',
  },
});

export function AppShell(): React.JSX.Element {
  const styles = useStyles();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { micaActive, windowFocused } = useMaterials();

  const rootClass = mergeClasses(
    styles.windowRoot,
    micaActive && windowFocused
      ? styles.micaActive
      : micaActive
        ? styles.micaInactive
        : styles.solidFallback,
  );

  return (
    <div className={rootClass}>
      <Win11Header />
      <div className={styles.bodyRow}>
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className={styles.mainColumn}>
          <Win11Toolbar />
          <div className={styles.contentViewport}>
            <Outlet />
          </div>
        </div>
      </div>
      <Win11StatusBar />
      <ChatWidget />
    </div>
  );
}
