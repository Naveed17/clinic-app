import { useState } from 'react';
import { Text, makeStyles, tokens } from '@fluentui/react-components';
import { Sidebar } from './Sidebar';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { Win11StatusBar } from './Win11StatusBar';

const useStyles = makeStyles({
  win12Root: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Segoe UI Variable Display, Segoe UI, Inter, sans-serif',
    color: '#f0f4f8',
    userSelect: 'none',
  },
  /* Centered Floating Window Shell */
  floatingWindow: {
    width: '96vw',
    maxWidth: '1460px',
    height: 'calc(100vh - 30px)',
    margin: '14px auto 0 auto',
    borderRadius: '20px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--cf-glass-surface, rgba(30, 36, 48, 0.88))',
    backdropFilter: 'blur(40px)',
    boxShadow: 'var(--cf-glass-shadow)',
    border: '1px solid var(--cf-glass-border, rgba(255, 255, 255, 0.14))',
    position: 'relative',
    zIndex: 10,
  },
  /* Windows 12 Title Header */
  win12Header: {
    height: '46px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalNone,
    backgroundColor: 'var(--cf-glass-header)',
    backdropFilter: 'blur(30px)',
    borderBottom: '1px solid var(--cf-glass-border)',
    WebkitAppRegion: 'drag',
    boxSizing: 'border-box',
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightBold,
    color: '#f0f4f8',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  winControlGroup: {
    display: 'flex',
    alignItems: 'center',
    WebkitAppRegion: 'no-drag',
  },
  winBtn: {
    width: '46px',
    height: '46px',
    borderRadius: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 100ms ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
    },
  },
  closeBtn: {
    '&:hover': {
      backgroundColor: '#c42b1c !important',
      color: '#ffffff !important',
    },
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
    padding: tokens.spacingHorizontalL,
    gap: tokens.spacingVerticalS,
    boxSizing: 'border-box',
  },
  contentViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: 'transparent',
  },
});

export function Windows12Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMinimize = () => {
    if (window.electron?.ipcRenderer) window.electron.ipcRenderer.send('window:minimize');
  };

  const handleMaximize = () => {
    if (window.electron?.ipcRenderer) window.electron.ipcRenderer.send('window:toggle-maximize');
  };

  const handleClose = () => {
    if (window.electron?.ipcRenderer) window.electron.ipcRenderer.send('window:close');
  };

  return (
    <div className={styles.win12Root}>
      {/* 3D Ribbon Wallpaper */}
      <div className="win12-wallpaper" />

      {/* Floating App Window */}
      <div className={styles.floatingWindow}>
        {/* Title Header */}
        <div className={styles.win12Header}>
          <div className={styles.headerTitle}>
            <span>⚡</span> CareFlow Suite
          </div>

          <div className={styles.winControlGroup}>
            <button type="button" className={styles.winBtn} onClick={handleMinimize} title="Minimize">
              &#8722;
            </button>
            <button type="button" className={styles.winBtn} onClick={handleMaximize} title="Maximize">
              &#9633;
            </button>
            <button type="button" className={`${styles.winBtn} ${styles.closeBtn}`} onClick={handleClose} title="Close">
              &#10005;
            </button>
          </div>
        </div>

        {/* Window Body */}
        <div className={styles.bodyRow}>
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className={styles.mainColumn}>
            <div className={styles.contentViewport}>{children}</div>
          </div>
        </div>

        <Win11StatusBar />
        <ChatWidget />
      </div>
    </div>
  );
}
