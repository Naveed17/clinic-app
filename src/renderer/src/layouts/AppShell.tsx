import { useState } from 'react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { useMaterials } from '@/theme/MaterialsContext';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    transitionProperty: 'background-color',
    transitionDuration: '150ms',
  },
  micaActive: {
    backgroundColor: 'transparent',
  },
  micaInactive: {
    backgroundColor: 'var(--cf-mica-fallback)',
  },
  solidFallback: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flexGrow: 1,
    overflow: 'hidden',
  },
  main: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  topbarWrap: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexShrink: 0,
  },
  content: {
    flexGrow: 1,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'auto',
  },
});

export function AppShell(): React.JSX.Element {
  const styles = useStyles();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { micaActive, windowFocused } = useMaterials();

  const rootClass = mergeClasses(
    styles.root,
    micaActive && windowFocused
      ? styles.micaActive
      : micaActive
        ? styles.micaInactive
        : styles.solidFallback,
  );

  return (
    <div className={rootClass}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={styles.column}>
        <main className={styles.main}>
          <div className={styles.topbarWrap}>
            <Topbar onMenuClick={() => setMobileOpen(true)} />
          </div>
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
