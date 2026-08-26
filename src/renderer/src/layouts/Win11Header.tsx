import {
  Input,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import {
  ArrowClockwise24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import { SearchOutlinedIcon } from '@/icons/fluent';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import { Button } from '@fluentui/react-components';

const useStyles = makeStyles({
  header: {
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: 'var(--cf-glass-header)',
    backdropFilter: 'blur(30px)',
    borderBottom: '1px solid var(--cf-glass-border)',
    userSelect: 'none',
    boxSizing: 'border-box',
    gap: tokens.spacingHorizontalS,
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  appTab: {
    height: '32px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: 'var(--cf-glass-surface)',
    borderTopLeftRadius: tokens.borderRadiusMedium,
    borderTopRightRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    boxShadow: tokens.shadow2,
    border: '1px solid var(--cf-glass-border)',
  },
  logoIcon: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    objectFit: 'cover',
  },
  logoFallback: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: '9px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  navControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  iconBtn: {
    minWidth: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '50%',
  },
  breadcrumbPath: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    height: '28px',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: tokens.borderRadiusMedium,
    border: '1px solid rgba(255, 255, 255, 0.5)',
  },
  breadcrumbActive: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  centerSearch: {
    flex: '0 1 340px',
  },
  searchPill: {
    width: '100%',
    height: '28px',
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: '99px',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    boxShadow: tokens.shadow2,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
  },
});

export function Win11Header(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const logo = useClinicBrandLogo();
  const [searchOpen, setSearchOpen] = useState(false);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbActive =
    pathParts.length === 0
      ? 'Home'
      : pathParts[pathParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <div className={styles.appTab}>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>&#9776;</span>
            {logo ? (
              <img src={logo} alt="CareFlow" className={styles.logoIcon} />
            ) : (
              <div className={styles.logoFallback}>CF</div>
            )}
            <Text className={styles.appTitle}>CareFlow</Text>
          </div>

          <div className={styles.navControls}>
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronLeft24Regular />}
              onClick={() => navigate(-1)}
              className={styles.iconBtn}
              title="Back"
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronRight24Regular />}
              onClick={() => navigate(1)}
              className={styles.iconBtn}
              title="Forward"
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowClockwise24Regular />}
              onClick={() => window.location.reload()}
              className={styles.iconBtn}
              title="Refresh"
            />
          </div>

          <div className={styles.breadcrumbPath}>
            <span>CareFlow</span>
            <span>&gt;</span>
            <span className={styles.breadcrumbActive}>{breadcrumbActive}</span>
          </div>
        </div>

        <div className={styles.centerSearch}>
          <Input
            size="small"
            placeholder="Search (Ctrl+K)"
            contentBefore={<SearchOutlinedIcon style={{ fontSize: 14 }} />}
            readOnly
            onClick={() => setSearchOpen(true)}
            className={styles.searchPill}
          />
        </div>
      </header>

      {searchOpen && <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
