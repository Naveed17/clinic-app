import { Skeleton, ProgressBar, makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(var(--cols), minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  grid: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },
  card: {
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  listMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  calendar: {
    flex: 1,
    minHeight: 0,
    padding: tokens.spacingVerticalL,
    width: '100%',
  },
  calendarToolbar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  spacer: { flex: 1 },
  week: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: tokens.spacingHorizontalXXS,
    marginBottom: tokens.spacingVerticalXS,
  },
  days: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: tokens.spacingHorizontalXXS,
  },
  day: {
    height: '72px',
    borderRadius: tokens.borderRadiusMedium,
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
});

export function TableRowsSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }): React.JSX.Element {
  const styles = useStyles();
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row} style={{ ['--cols' as string]: cols }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              appearance="opaque"
              style={{ height: c === 0 ? 22 : 14, width: c === 0 ? '72%' : `${40 + ((i + c) % 4) * 12}%` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.grid}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card}>
          <Skeleton appearance="opaque" style={{ width: 88, height: 40 }} />
          <Skeleton appearance="opaque" style={{ width: 150, height: 22, marginTop: 8 }} />
          <Skeleton appearance="opaque" style={{ width: 110, height: 16, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function ListCardsSkeleton({ count = 5 }: { count?: number }): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.listItem}>
          <Skeleton appearance="opaque" shape="circle" style={{ width: 40, height: 40 }} />
          <div className={styles.listMeta}>
            <Skeleton appearance="opaque" style={{ width: '58%', height: 20 }} />
            <Skeleton appearance="opaque" style={{ width: '38%', height: 16 }} />
          </div>
          <Skeleton appearance="opaque" style={{ width: 64, height: 22 }} />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton(): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.calendar}>
      <div className={styles.calendarToolbar}>
        <Skeleton appearance="opaque" style={{ width: 168, height: 28 }} />
        <div className={styles.spacer} />
        <Skeleton appearance="opaque" shape="circle" style={{ width: 32, height: 32 }} />
        <Skeleton appearance="opaque" shape="circle" style={{ width: 32, height: 32 }} />
      </div>
      <div className={styles.week}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} appearance="opaque" style={{ height: 18 }} />
        ))}
      </div>
      <div className={styles.days}>
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className={styles.day} appearance="opaque" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton(): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.page}>
      <Skeleton appearance="opaque" style={{ width: 220, height: 32 }} />
      <Skeleton appearance="opaque" style={{ width: 320, height: 18 }} />
      <StatCardsSkeleton count={4} />
      <TableRowsSkeleton cols={5} rows={6} />
    </div>
  );
}

export function FetchingBar({ show }: { show?: boolean }): React.JSX.Element | null {
  if (!show) return null;
  return (
    <ProgressBar
      thickness="medium"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
    />
  );
}
