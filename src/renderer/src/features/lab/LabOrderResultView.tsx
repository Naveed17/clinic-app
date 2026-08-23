import { Badge, Button, Text, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { useState } from 'react';
import type { LabOrder } from '@/types/lab';
import { LabReportPrint } from './LabReportPrint';
import { PrintOutlinedIcon } from '@/icons/fluent';
import {
  flagLabel,
  htmlToPlainText,
  isAbnormal,
  labResultPreview,
  parseLabResult,
} from './labReportPayload';

const BORDER: Record<string, string> = {
  COMPLETED: tokens.colorPaletteGreenBorder2,
  IN_PROGRESS: tokens.colorBrandStroke1,
  PENDING: tokens.colorPaletteYellowBorder2,
  CANCELLED: tokens.colorPaletteRedBorder2,
};

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase300,
  },
  meta: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  side: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) auto',
    gap: '4px',
    alignItems: 'center',
  },
  cell: {
    paddingTop: '3px',
    paddingBottom: '3px',
    paddingLeft: '6px',
    paddingRight: '6px',
    fontSize: '12.5px',
  },
  bad: {
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  name: {
    fontWeight: tokens.fontWeightSemibold,
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
  },
  value: {
    fontWeight: tokens.fontWeightSemibold,
  },
  valueBad: {
    fontWeight: tokens.fontWeightBold,
  },
  flag: {
    textAlign: 'right',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  flagBad: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightBold,
  },
  line: {
    fontSize: '13px',
  },
  muted: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
  },
  caption: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

function statusBadgeColor(status: string): 'success' | 'brand' | 'warning' | 'danger' | 'subtle' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'brand';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'subtle';
}

export function ResultBody({
  result,
  notes,
}: {
  result: string | null;
  notes?: string | null;
}): React.JSX.Element | null {
  const styles = useStyles();
  const payload = parseLabResult(result);
  const noteText = notes?.trim() || '';

  if (!payload) {
    const plain = result?.trim() || '';
    if (!plain && !noteText) return null;
    return (
      <div className={styles.body}>
        {plain ? <Text className={styles.line}>Result: {plain}</Text> : null}
        {noteText ? <Text className={styles.muted}>{noteText}</Text> : null}
      </div>
    );
  }

  const filled = payload.rows.filter((row) => row.value.trim());
  const impression = htmlToPlainText(payload.impressionHtml);

  return (
    <div className={styles.body}>
      {(payload.specimen || payload.method) && (
        <Text className={styles.caption}>
          {[payload.specimen && `Specimen: ${payload.specimen}`, payload.method && `Method: ${payload.method}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
      {filled.length > 0 ? (
        <div className={styles.grid}>
          {filled.map((row) => {
            const bad = isAbnormal(row.flag);
            const badCls = bad ? ` ${styles.bad}` : '';
            return (
              <div key={row.id} style={{ display: 'contents' }}>
                <Text className={`${styles.cell} ${styles.name}${badCls}`}>{row.name}</Text>
                <Text className={`${styles.cell} ${bad ? styles.valueBad : styles.value}${badCls}`}>
                  {row.value}
                  {row.unit ? ` ${row.unit}` : ''}
                </Text>
                <Text className={`${styles.cell} ${bad ? styles.flagBad : styles.flag}${badCls}`}>
                  {flagLabel(row.flag) || '—'}
                </Text>
              </div>
            );
          })}
        </div>
      ) : (
        <Text className={styles.muted}>{labResultPreview(result)}</Text>
      )}
      {impression ? <Text className={styles.line}>Impression: {impression}</Text> : null}
      {noteText ? <Text className={styles.muted}>{noteText}</Text> : null}
    </div>
  );
}

export function LabOrderHistoryCard({ order }: { order: LabOrder }): React.JSX.Element {
  const styles = useStyles();
  const [printOpen, setPrintOpen] = useState(false);
  const canPrint = order.status === 'COMPLETED' && Boolean(order.result?.trim());

  return (
    <>
      <div
        className={styles.card}
        style={{ borderLeftColor: BORDER[order.status] ?? tokens.colorNeutralStroke2 }}
      >
        <div className={styles.row}>
          <div className={styles.main}>
            <Text className={styles.title}>{order.test}</Text>
            <Text className={styles.meta}>
              Ordered {new Date(order.orderedAt).toLocaleDateString()}
              {order.orderedByName ? ` · ${order.orderedByName}` : ''}
            </Text>
            <ResultBody result={order.result} notes={order.notes} />
          </div>
          <div className={styles.side}>
            {canPrint && (
              <Tooltip content="Print report" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<PrintOutlinedIcon />}
                  onClick={() => setPrintOpen(true)}
                  aria-label="Print report"
                />
              </Tooltip>
            )}
            <Badge appearance="tint" color={statusBadgeColor(order.status)} size="small">
              {order.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>
      {printOpen && <LabReportPrint order={order} onClose={() => setPrintOpen(false)} />}
    </>
  );
}
