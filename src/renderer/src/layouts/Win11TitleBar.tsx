import {
  Button,
  Input,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useState } from 'react';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { SearchOutlinedIcon } from '@/icons/fluent';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';

const useStyles = makeStyles({
  titleBar: {
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalNone,
    backgroundColor: 'var(--cf-mica-titlebar, rgba(255, 255, 255, 0.45))',
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    WebkitAppRegion: 'drag',
    userSelect: 'none',
    zIndex: 100,
    boxSizing: 'border-box',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    WebkitAppRegion: 'drag',
  },
  logoIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  logoFallback: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: '10px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    letterSpacing: '0.2px',
  },
  centerSection: {
    flex: '0 1 360px',
    WebkitAppRegion: 'no-drag',
  },
  searchBox: {
    width: '100%',
    height: '26px',
    fontSize: tokens.fontSizeBase100,
    cursor: 'pointer',
    backgroundColor: 'var(--cf-commanding-fill, rgba(255,255,255,0.6))',
    borderRadius: tokens.borderRadiusMedium,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    WebkitAppRegion: 'no-drag',
  },
  windowControlBtn: {
    width: '46px',
    height: '38px',
    borderRadius: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 100ms ease',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
    },
  },
  closeBtn: {
    '&:hover': {
      backgroundColor: '#c42b1c !important',
      color: '#ffffff !important',
    },
  },
});

export function Win11TitleBar(): React.JSX.Element {
  const styles = useStyles();
  const logo = useClinicBrandLogo();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleMinimize = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window:minimize');
    }
  };

  const handleMaximize = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window:toggle-maximize');
    }
  };

  const handleClose = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window:close');
    }
  };

  return (
    <>
      <header className={styles.titleBar}>
        <div className={styles.leftSection}>
          {logo ? (
            <img src={logo} alt="CareFlow" className={styles.logoIcon} />
          ) : (
            <div className={styles.logoFallback}>CF</div>
          )}
          <Text className={styles.appTitle}>CareFlow</Text>
        </div>

        <div className={styles.centerSection}>
          <Input
            size="small"
            placeholder="Type here to search (Ctrl+K)"
            contentBefore={<SearchOutlinedIcon style={{ fontSize: 14 }} />}
            readOnly
            onClick={() => setSearchOpen(true)}
            className={styles.searchBox}
          />
        </div>

        <div className={styles.rightSection}>
          <button
            type="button"
            className={styles.windowControlBtn}
            onClick={handleMinimize}
            title="Minimize"
          >
            &#58888; {/* Segoe Fluent Icon or fallback hyphen */}
            <span style={{ fontSize: '14px', lineHeight: 1 }}>&#8722;</span>
          </button>
          <button
            type="button"
            className={styles.windowControlBtn}
            onClick={handleMaximize}
            title="Maximize"
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>&#9633;</span>
          </button>
          <button
            type="button"
            className={`${styles.windowControlBtn} ${styles.closeBtn}`}
            onClick={handleClose}
            title="Close"
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>&#10005;</span>
          </button>
        </div>
      </header>

      {searchOpen && <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
