import {
  Badge,
  Button,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Input,
  Spinner,
  Text,
  Title3,
  createTableColumn,
  makeStyles,
  tokens,
  type BadgeProps,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import { Search24Regular, ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons';
import type { CSSProperties, ReactNode } from 'react';

export { createTableColumn };
export type { TableColumnDefinition };

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  titles: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  fetchSpinner: {
    position: 'absolute',
    top: tokens.spacingVerticalS,
    right: tokens.spacingHorizontalM,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  gridWrap: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    maxHeight: 'calc(100vh - 280px)',
    overflowY: 'auto',
  },
  grid: {
    minWidth: '100%',
  },
  headerCell: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground2,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  cell: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase300,
  },
  row: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    transitionProperty: 'background-color',
    transitionDuration: tokens.durationNormal,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  pagerBar: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  pagerMeta: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  pagerTotal: {
    marginLeft: tokens.spacingHorizontalS,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground3,
  },
  pagerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  search: {
    minWidth: '220px',
    maxWidth: '360px',
    flexGrow: 1,
  },
  empty: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
  statusDot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    marginRight: '6px',
    verticalAlign: 'middle',
    flexShrink: 0,
  },
});

export const actionBtnStyle: CSSProperties = {
  minWidth: 32,
  width: 32,
  height: 32,
};

/** @deprecated MUI-era alias — prefer `actionBtnStyle`. */
export const actionBtnSx = actionBtnStyle;

interface TablePageShellProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  pager?: ReactNode;
  fetching?: boolean;
  className?: string;
}

export function TablePageShell({
  title,
  subtitle,
  action,
  toolbar,
  children,
  error,
  pager,
  fetching,
  className,
}: TablePageShellProps): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={`${styles.page}${className ? ` ${className}` : ''}`}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <Title3>{title}</Title3>
          <Text className={styles.subtitle}>{subtitle}</Text>
        </div>
        {action}
      </div>

      <div className={styles.card}>
        {fetching ? (
          <div className={styles.fetchSpinner} aria-live="polite">
            <Spinner size="tiny" label="Loading…" labelPosition="after" />
          </div>
        ) : null}
        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
        {error}
        <div className={styles.gridWrap}>{children}</div>
        {pager ? <div className={styles.pagerBar}>{pager}</div> : null}
      </div>
    </div>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchFieldProps): React.JSX.Element {
  const styles = useStyles();
  return (
    <Input
      className={`${styles.search}${className ? ` ${className}` : ''}`}
      value={value}
      onChange={(_, data) => onChange(data.value)}
      placeholder={placeholder}
      contentBefore={<Search24Regular />}
    />
  );
}

interface TablePagerProps {
  page: number;
  rowsPerPage: number;
  total: number;
  onPageChange: (next: number) => void;
}

export function TablePager({ page, rowsPerPage, total, onPageChange }: TablePagerProps): React.JSX.Element {
  const styles = useStyles();
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = page + 1;
  if (total === 0) return <></>;

  return (
    <div className={styles.pager}>
      <Text className={styles.pagerMeta}>
        Page {currentPage} of {totalPages}
        <span className={styles.pagerTotal}>- {total} total</span>
      </Text>
      <div className={styles.pagerActions}>
        <Button
          appearance="secondary"
          size="small"
          disabled={page === 0}
          icon={<ChevronLeft24Regular />}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          appearance="secondary"
          size="small"
          disabled={currentPage >= totalPages}
          icon={<ChevronRight24Regular />}
          iconPosition="after"
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatusDot({ active = true }: { active?: boolean }): React.JSX.Element {
  const styles = useStyles();
  return (
    <span
      className={styles.statusDot}
      style={{
        backgroundColor: active ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForegroundDisabled,
      }}
    />
  );
}

type StatusBadgeColor = NonNullable<BadgeProps['color']>;

export function StatusBadge({
  children,
  color = 'subtle',
}: {
  children: ReactNode;
  color?: StatusBadgeColor;
}): React.JSX.Element {
  return (
    <Badge appearance="tint" color={color} size="small">
      {children}
    </Badge>
  );
}

interface DataGridTableProps<T> {
  items: T[];
  columns: TableColumnDefinition<T>[];
  getRowId: (item: T) => string;
  sortable?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataGridTable<T>({
  items,
  columns,
  getRowId,
  sortable = true,
  emptyMessage = 'No records found.',
  onRowClick,
  className,
}: DataGridTableProps<T>): React.JSX.Element {
  const styles = useStyles();

  if (items.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <DataGrid
      className={`${styles.grid}${className ? ` ${className}` : ''}`}
      items={items}
      columns={columns}
      sortable={sortable}
      getRowId={getRowId}
      focusMode="composite"
    >
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell }) => (
            <DataGridHeaderCell className={styles.headerCell}>{renderHeaderCell()}</DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<T>>
        {({ item, rowId }) => (
          <DataGridRow<T>
            key={rowId}
            className={styles.row}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            {({ renderCell }) => <DataGridCell className={styles.cell}>{renderCell(item)}</DataGridCell>}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
  );
}

/** Empty placeholder styles map for pages still referencing legacy `tableSx`. */
export const tableSx = {
  head: {},
  row: {},
};

/** @deprecated no-op — use Fluent Badge / StatusBadge */
export const chipSx = {};

/** @deprecated no-op — use makeStyles card surface */
export const softCardSx = {};

// Fluent table primitives for pages not yet on DataGrid
export {
  Table,
  TableHeader as TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from '@fluentui/react-components';
