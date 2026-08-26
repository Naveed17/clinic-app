import { Text, makeStyles, tokens } from '@fluentui/react-components';
import { useLocation } from 'react-router-dom';

const useStyles = makeStyles({
  statusBar: {
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: 'var(--cf-glass-header)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--cf-glass-border)',
    userSelect: 'none',
    boxSizing: 'border-box',
  },
  leftTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  tabPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    height: '22px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'var(--cf-glass-surface)',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground1,
    border: '1px solid var(--cf-glass-border)',
  },
  closeTab: {
    fontSize: '10px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground3,
    '&:hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  plusBtn: {
    fontSize: '14px',
    paddingLeft: '6px',
    paddingRight: '6px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground2,
  },
  rightStatus: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
});

export function Win11StatusBar(): React.JSX.Element {
  const styles = useStyles();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTabName = pathParts.length === 0 ? 'Home' : pathParts[pathParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <footer className={styles.statusBar}>
      <div className={styles.leftTabs}>
        <div className={styles.tabPill}>
          <span>🏠 {activeTabName}</span>
          <span className={styles.closeTab}>&#10005;</span>
        </div>
        <span className={styles.plusBtn}>+</span>
      </div>
      <div className={styles.rightStatus}>
        <Text size={100}>CareFlow Windows 11 Desktop · Ready</Text>
      </div>
    </footer>
  );
}
