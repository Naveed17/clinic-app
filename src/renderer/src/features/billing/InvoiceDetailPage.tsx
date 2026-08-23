import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  Spinner,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
  type BadgeProps,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StatCardsSkeleton, TableRowsSkeleton } from '@/components/LoadingUI';
import { StatusBadge } from '@/components/TableUI';
import {
  DeleteInvoiceDialog,
  PaymentDialog,
  RefundDialog,
  VoidDialog,
} from '@/features/billing/InvoicesPage';
import { invoicesService } from '@/services/invoices.service';
import type { Invoice, Payment } from '@/types/invoice';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';
import {
  AccountBalanceWalletOutlinedIcon,
  ArrowBackOutlinedIcon,
  BlockOutlinedIcon,
  DeleteOutlineIcon,
  PaymentOutlinedIcon,
  PrintOutlinedIcon,
  ReceiptOutlinedIcon,
  UndoOutlinedIcon,
} from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const statusConfig: Record<string, { label: string; color: StatusColor }> = {
  DRAFT: { label: 'Draft', color: 'subtle' },
  ISSUED: { label: 'Issued', color: 'informative' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'danger' },
  VOID: { label: 'Void', color: 'danger' },
};

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalS,
  },
  notFound: {
    padding: tokens.spacingVerticalXXL,
  },
  backBtn: {
    marginTop: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  backIconBtn: {
    marginTop: tokens.spacingVerticalXXS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  eyebrow: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  titleRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXXS,
  },
  title: {
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightMedium,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  statsGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },
  softCard: {
    borderRadius: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    position: 'relative',
    overflow: 'hidden',
  },
  statBlob: {
    position: 'absolute',
    top: '-18px',
    right: '-18px',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
  },
  statInner: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  caption: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  statValue: {
    marginTop: tokens.spacingVerticalXXS,
    letterSpacing: '-0.02em',
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase600,
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  mainGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
    alignItems: 'start',
  },
  cardOverflow: {
    overflow: 'hidden',
  },
  cardHeader: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightBold,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  thRight: {
    textAlign: 'right',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase300,
  },
  tdRight: {
    textAlign: 'right',
  },
  emptyCell: {
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  totalRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  muted: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  notes: {
    paddingTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
  },
  cardPad: {
    padding: tokens.spacingVerticalXL,
  },
  payList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  payRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  payDate: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
  },
  dangerBtn: {
    color: tokens.colorPaletteRedForeground1,
  },
  warnBtn: {
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
});

export function InvoiceDetailPage(): React.JSX.Element {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  function goBack(): void {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
      return;
    }
    if (location.pathname.startsWith('/opd-reports')) {
      navigate('/opd-reports');
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/billing');
  }

  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesService.get(id!),
    enabled: Boolean(id),
  });

  const paymentsQuery = useQuery<Payment[]>({
    queryKey: ['invoice-payments', id],
    queryFn: () => invoicesService.payments(id!),
    enabled: Boolean(id),
  });

  const invoice = query.data ?? null;

  async function handlePrint(inv: Invoice): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printInvoiceReceipt(inv);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  if (query.isLoading) {
    return (
      <div className={styles.loading}>
        <Skeleton appearance="opaque" style={{ height: 88, borderRadius: 12 }} />
        <StatCardsSkeleton count={4} />
        <Skeleton appearance="opaque" style={{ height: 260, borderRadius: 12 }} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className={styles.notFound}>
        <MessageBar intent="error">
          <MessageBarBody>Invoice not found.</MessageBarBody>
        </MessageBar>
        <Button
          className={styles.backBtn}
          appearance="secondary"
          icon={<ArrowBackOutlinedIcon />}
          onClick={() => goBack()}
        >
          Back
        </Button>
      </div>
    );
  }

  const status = statusConfig[invoice.status] ?? { label: invoice.status, color: 'subtle' as const };
  const paid = Number(invoice.amountPaid ?? 0);
  const total = Number(invoice.total);
  const balance = Math.max(0, total - paid);
  const isVoid = invoice.status === 'VOID';
  const canPay = !isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED';
  const canRefund = !isVoid && paid > 0 && invoice.status !== 'REFUNDED';
  const patientLabel = `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim();
  const payments = paymentsQuery.data ?? [];

  const colors = {
    primary: tokens.colorBrandForeground1,
    success: tokens.colorPaletteGreenForeground1,
    warning: tokens.colorPaletteDarkOrangeForeground1,
    info: tokens.colorPaletteBlueForeground2,
  };

  const summaryCards = [
    {
      label: 'Total',
      value: money(total),
      note: invoice.discount ? `Discount ${money(Number(invoice.discount))}` : 'Bill total',
      icon: <ReceiptOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.primary,
    },
    {
      label: 'Paid',
      value: money(paid),
      note: 'Collected',
      icon: <PaymentOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.success,
    },
    {
      label: 'Balance',
      value: money(balance),
      note: balance > 0 ? 'Due' : 'Cleared',
      icon: <AccountBalanceWalletOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.warning,
    },
    {
      label: 'Status',
      value: status.label,
      note: new Date(invoice.createdAt).toLocaleDateString(),
      icon: <ReceiptOutlinedIcon style={{ fontSize: 18 }} />,
      color: colors.info,
    },
  ];

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tooltip content="Back" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowBackOutlinedIcon style={{ fontSize: 18 }} />}
                onClick={() => goBack()}
                className={styles.backIconBtn}
              />
            </Tooltip>
            <div>
              <Text className={styles.eyebrow}>Invoice details</Text>
              <div className={styles.titleRow}>
                <Title3 className={styles.title}>{invoice.invoiceNumber}</Title3>
                <StatusBadge color={status.color}>{status.label}</StatusBadge>
              </div>
              <Text className={styles.subtitle}>
                {patientLabel}
                {invoice.patient.phone ? ` · ${invoice.patient.phone}` : ''}
              </Text>
            </div>
          </div>

          <div className={styles.actions}>
            <Button appearance="secondary" onClick={() => navigate(`/patients/${invoice.patient.id}`)}>
              Open patient
            </Button>
            {canPay && (
              <Button
                appearance="primary"
                icon={<PaymentOutlinedIcon />}
                onClick={() => setPaymentOpen(true)}
              >
                Record payment
              </Button>
            )}
            {canRefund && (
              <Button
                appearance="secondary"
                icon={<UndoOutlinedIcon />}
                onClick={() => setRefundOpen(true)}
              >
                Refund
              </Button>
            )}
            <Button
              appearance="secondary"
              icon={printing ? <Spinner size="tiny" /> : <PrintOutlinedIcon />}
              disabled={printing}
              onClick={() => void handlePrint(invoice)}
            >
              Print
            </Button>
            {!isVoid && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && (
              <Button
                appearance="secondary"
                className={styles.warnBtn}
                icon={<BlockOutlinedIcon />}
                onClick={() => setVoidOpen(true)}
              >
                Void
              </Button>
            )}
            <Button
              appearance="secondary"
              className={styles.dangerBtn}
              icon={<DeleteOutlineIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        {printError && (
          <MessageBar intent="error">
            <MessageBarBody>{printError}</MessageBarBody>
            <Button appearance="transparent" size="small" onClick={() => setPrintError(null)}>
              Dismiss
            </Button>
          </MessageBar>
        )}

        <div className={styles.statsGrid}>
          {summaryCards.map((c) => (
            <div key={c.label} className={`${styles.softCard} ${styles.statCard}`}>
              <div className={styles.statBlob} style={{ backgroundColor: `${c.color}1a` }} />
              <div className={styles.statInner}>
                <div>
                  <Text className={styles.caption}>{c.label}</Text>
                  <Text className={styles.statValue} block>
                    {c.value}
                  </Text>
                  <Text className={styles.caption}>{c.note}</Text>
                </div>
                <div
                  className={styles.iconBox}
                  style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                >
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mainGrid}>
          <div className={`${styles.softCard} ${styles.cardOverflow}`}>
            <div className={styles.cardHeader}>
              <Text className={styles.sectionTitle}>Line items</Text>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Description</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Qty</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Unit</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>
                      No line items.
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.td}>
                        <Text weight="semibold" size={300}>
                          {item.description}
                        </Text>
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>{item.quantity}</td>
                      <td className={`${styles.td} ${styles.tdRight}`}>{money(Number(item.unitPrice))}</td>
                      <td className={`${styles.td} ${styles.tdRight}`} style={{ fontWeight: 700 }}>
                        {money(Number(item.lineTotal))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <Text className={styles.muted}>Subtotal</Text>
                <Text weight="semibold">{money(Number(invoice.subtotal))}</Text>
              </div>
              <div className={styles.totalRow}>
                <Text className={styles.muted}>Discount</Text>
                <Text weight="semibold">{money(Number(invoice.discount))}</Text>
              </div>
              <div className={styles.totalRow}>
                <Text weight="bold">Total</Text>
                <Text weight="bold">{money(total)}</Text>
              </div>
              {invoice.notes && (
                <Text className={styles.notes} size={300}>
                  Notes: {invoice.notes}
                </Text>
              )}
            </div>
          </div>

          <div className={`${styles.softCard} ${styles.cardPad}`}>
            <Text className={styles.sectionTitle} block style={{ marginBottom: 14 }}>
              Payment history
            </Text>
            {paymentsQuery.isLoading ? (
              <TableRowsSkeleton cols={1} rows={3} />
            ) : payments.length === 0 ? (
              <Text className={styles.muted}>No payments recorded yet.</Text>
            ) : (
              <div className={styles.payList}>
                {payments.map((p) => (
                  <div key={p.id} className={styles.payRow}>
                    <div style={{ minWidth: 0 }}>
                      <Text weight="semibold" size={300} block>
                        {money(Number(p.amount))}
                      </Text>
                      <Text className={styles.caption}>
                        {p.method.replace('_', ' ')}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </Text>
                      {p.notes && (
                        <Text className={styles.caption} block>
                          {p.notes}
                        </Text>
                      )}
                    </div>
                    <Text className={styles.payDate}>
                      {new Date(p.paidAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {paymentOpen && <PaymentDialog invoice={invoice} onClose={() => setPaymentOpen(false)} />}
      {refundOpen && <RefundDialog invoice={invoice} onClose={() => setRefundOpen(false)} />}
      {voidOpen && <VoidDialog invoice={invoice} onClose={() => setVoidOpen(false)} />}
      {deleteOpen && (
        <DeleteInvoiceDialog
          invoice={invoice}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => goBack()}
        />
      )}
    </>
  );
}
