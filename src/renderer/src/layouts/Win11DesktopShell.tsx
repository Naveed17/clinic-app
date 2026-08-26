import { useState } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { Win11Header } from './Win11Header';
import { Sidebar } from './Sidebar';
import { Win11Toolbar } from './Win11Toolbar';
import { Win11StatusBar } from './Win11StatusBar';
import { ChatWidget } from '@/features/chat/ChatWidget';

const useStyles = makeStyles({
  desktopRoot: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Segoe UI Variable Display, Segoe UI, Inter, sans-serif',
  },
  floatingWindow: {
    width: '100vw',
    height: '100vh',
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(240, 245, 255, 0.65)',
    backdropFilter: 'blur(40px)',
    position: 'relative',
    zIndex: 10,
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
    gap: tokens.spacingVerticalXS,
    boxSizing: 'border-box',
  },
  contentViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: 'var(--cf-glass-surface)',
    backdropFilter: 'blur(30px)',
    borderRadius: '12px',
    border: '1px solid var(--cf-glass-border)',
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
  },
});

export function Win11DesktopShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.desktopRoot}>
      {/* 3D Blue Ribbon Wallpaper Backdrop */}
      <div className="win11-wallpaper" />

      {/* App Window */}
      <div className={styles.floatingWindow}>
        <Win11Header />
        <div className={styles.bodyRow}>
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className={styles.mainColumn}>
            <Win11Toolbar />
            <div className={styles.contentViewport}>{children}</div>
          </div>
        </div>
        <Win11StatusBar />
        <ChatWidget />
      </div>
    </div>
  );
}
