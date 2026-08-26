import { useState } from 'react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Win11TitleBar } from './Win11TitleBar';
import { CommandBar } from './CommandBar';
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
    fontFamily: 'Segoe UI Variable Text, Segoe UI, Inter, sans-serif',
  },
  micaActive: {
    backgroundColor: 'transparent',
  },
  micaInactive: {
    backgroundColor: 'var(--cf-mica-fallback, rgba(243, 243, 243, 0.95))',
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
    backgroundColor: 'var(--cf-mica-surface, rgba(255, 255, 255, 0.75))',
    backdropFilter: 'blur(20px)',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
    boxShadow: tokens.shadow2,
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
      <Win11TitleBar />
      <div className={styles.bodyRow}>
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className={styles.mainColumn}>
          <CommandBar />
          <div className={styles.contentViewport}>
            <Outlet />
          </div>
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
