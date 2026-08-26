import { useState, useEffect } from 'react';
import { Text, makeStyles, tokens } from '@fluentui/react-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { Win11Header } from './Win11Header';
import { Sidebar } from './Sidebar';
import { Win11Toolbar } from './Win11Toolbar';
import { Win11StatusBar } from './Win11StatusBar';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

const useStyles = makeStyles({
  desktopRoot: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontFamily: 'Segoe UI Variable Display, Segoe UI, Inter, sans-serif',
  },
  floatingWindow: {
    width: '97vw',
    maxWidth: '1480px',
    height: 'calc(100vh - 58px)',
    margin: '8px auto 0 auto',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(240, 245, 255, 0.65)',
    backdropFilter: 'blur(40px)',
    boxShadow: 'var(--cf-glass-shadow)',
    border: '1px solid var(--cf-glass-border)',
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
  /* Windows 11 Taskbar */
  taskbar: {
    height: '44px',
    width: '100%',
    backgroundColor: 'rgba(235, 242, 255, 0.75)',
    backdropFilter: 'blur(30px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    position: 'relative',
    zIndex: 20,
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  centerTaskbarIcons: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  taskbarIconBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 120ms ease',
    backgroundColor: 'transparent',
    border: 'none',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
  },
  activeAppIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    boxShadow: tokens.shadow2,
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: '3px',
      width: '14px',
      height: '3px',
      borderRadius: '2px',
      backgroundColor: '#0067c0',
    },
  },
  winStartLogo: {
    width: '20px',
    height: '20px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px',
  },
  winTile: {
    backgroundColor: '#0067c0',
    borderRadius: '1px',
  },
  systemTray: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground1,
  },
});

export function Win11DesktopShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const brandLogo = useClinicBrandLogo();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const id = setInterval(updateTime, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.desktopRoot}>
      {/* 3D Blue Ribbon Wallpaper Backdrop */}
      <div className="win11-wallpaper" />

      {/* Floating App Window */}
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

      {/* Windows 11 Taskbar */}
      <div className={styles.taskbar}>
        <div style={{ width: '100px' }} />

        {/* Center Icons */}
        <div className={styles.centerTaskbarIcons}>
          <button type="button" className={styles.taskbarIconBtn} title="Start">
            <div className={styles.winStartLogo}>
              <div className={styles.winTile} />
              <div className={styles.winTile} />
              <div className={styles.winTile} />
              <div className={styles.winTile} />
            </div>
          </button>
          <button type="button" className={styles.taskbarIconBtn} title="Search">
            <span style={{ fontSize: '16px' }}>🔍</span>
          </button>
          <button type="button" className={styles.taskbarIconBtn} title="Task View">
            <span style={{ fontSize: '16px' }}>🗔</span>
          </button>
          <button type="button" className={`${styles.taskbarIconBtn} ${styles.activeAppIcon}`} onClick={() => navigate('/')} title="CareFlow Clinic Management">
            <img src={brandLogo} alt="CareFlow" style={{ width: '22px', height: '22px', borderRadius: '4px' }} />
          </button>
          <button type="button" className={styles.taskbarIconBtn} onClick={() => navigate('/settings')} title="Settings">
            <span style={{ fontSize: '16px' }}>⚙️</span>
          </button>
        </div>

        {/* System Tray */}
        <div className={styles.systemTray}>
          <span>🔊</span>
          <span>📶</span>
          <span>🔋</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
            <Text weight="semibold" size={100}>{timeStr}</Text>
            <Text size={100} style={{ opacity: 0.75 }}>{dateStr}</Text>
          </div>
        </div>
      </div>
    </div>
  );
}
