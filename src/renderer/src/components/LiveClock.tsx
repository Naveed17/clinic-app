import { makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useState } from 'react';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: '0.35rem',
    userSelect: 'none',
  },
  time: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '40px',
    lineHeight: 1,
    color: tokens.colorNeutralForeground1,
  },
  dots: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '40px',
    lineHeight: 1,
    color: tokens.colorNeutralForeground1,
    transitionProperty: 'opacity',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'linear',
  },
  period: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '16px',
    color: tokens.colorNeutralForeground2,
    marginLeft: tokens.spacingHorizontalXXS,
  },
});

export function LiveClock(): React.JSX.Element {
  const styles = useStyles();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = String(hours % 12 || 12).padStart(2, '0');
  const minute = String(minutes).padStart(2, '0');
  const showDots = now.getSeconds() % 2 === 0;

  return (
    <div className={`${styles.root} digital-clock`}>
      <span className={styles.time}>{hour12}</span>
      <span className={styles.dots} style={{ opacity: showDots ? 1 : 0.18 }}>
        :
      </span>
      <span className={styles.time}>{minute}</span>
      <span className={styles.period}>{period}</span>
    </div>
  );
}
