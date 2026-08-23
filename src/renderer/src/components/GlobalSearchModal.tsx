import {
  Badge,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  Input,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GlobalSearchResult } from '@/types/search';
import { getSearchScope, searchPlaceholder } from '@shared/searchAccess';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { useAuth } from '@/features/auth/AuthContext';
import {
  BiotechOutlinedIcon,
  CalendarMonthOutlinedIcon,
  PersonOutlinedIcon,
  ReceiptOutlinedIcon,
  SearchOutlinedIcon,
} from '@/icons/fluent';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_APPEARANCE: Record<string, 'filled' | 'tint' | 'outline' | 'ghost'> = {
  SCHEDULED: 'tint',
  CHECKED_IN: 'tint',
  COMPLETED: 'filled',
  CANCELLED: 'outline',
  NO_SHOW: 'outline',
  DRAFT: 'ghost',
  ISSUED: 'tint',
  PARTIALLY_PAID: 'tint',
  PAID: 'filled',
  REFUNDED: 'outline',
  VOID: 'outline',
  PENDING: 'tint',
  IN_PROGRESS: 'tint',
};

const useStyles = makeStyles({
  surface: {
    maxWidth: '560px',
    width: '100%',
    marginTop: '8vh',
    overflow: 'hidden',
  },
  searchPad: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  divider: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  empty: {
    paddingTop: '40px',
    paddingBottom: '40px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  hint: {
    marginTop: tokens.spacingVerticalXXS,
    display: 'block',
    color: tokens.colorNeutralForeground3,
  },
  results: {
    maxHeight: '480px',
    overflowY: 'auto',
  },
  section: {
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
  },
  count: {
    marginLeft: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    width: '100%',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  mr: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  primary: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  secondary: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  const styles = useStyles();
  return (
    <div className={styles.section}>
      <span style={{ display: 'flex', color: 'var(--colorNeutralForeground2)' }}>{icon}</span>
      <Text className={styles.sectionLabel}>{label}</Text>
      <Badge className={styles.count} size="small" appearance="tint">
        {count}
      </Badge>
    </div>
  );
}

export function GlobalSearchModal({ open, onClose }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useLicense();
  const scope = getSearchScope(user?.role, modules);
  const canPatients = scope.patients;
  const canBilling = scope.invoices;
  const canLab = scope.labOrders;
  const canAppointments = scope.appointments;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = (await window.clinic.search.global(
          query.trim(),
          user?.role,
        )) as GlobalSearchResult;
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, user?.role]);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  const hasResults =
    results &&
    (canPatients ? results.patients.length : 0) +
      (canAppointments ? results.appointments.length : 0) +
      (canBilling ? results.invoices.length : 0) +
      (canLab ? results.labOrders.length : 0) >
      0;

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent>
            <div className={styles.searchPad}>
              <Input
                ref={inputRef}
                appearance="underline"
                placeholder={searchPlaceholder(scope)}
                value={query}
                onChange={(_, d) => setQuery(d.value)}
                contentBefore={
                  loading ? (
                    <Spinner size="tiny" />
                  ) : (
                    <SearchOutlinedIcon style={{ color: 'currentColor' }} />
                  )
                }
                style={{ fontSize: 16 }}
              />
            </div>
            <div className={styles.divider} />

            {!query && (
              <div className={styles.empty}>
                <Text>Type to search across all records…</Text>
                <Text className={styles.hint} size={200}>
                  Ctrl+K to open · Esc to close
                </Text>
              </div>
            )}

            {query.trim().length >= 2 && !loading && results && !hasResults && (
              <div className={styles.empty}>
                <Text>No results found for &quot;{query}&quot;</Text>
              </div>
            )}

            {hasResults && (
              <div className={styles.results}>
                {canPatients && results!.patients.length > 0 && (
                  <>
                    <SectionHeader
                      icon={<PersonOutlinedIcon style={{ fontSize: 18 }} />}
                      label="Patients"
                      count={results!.patients.length}
                    />
                    {results!.patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.item}
                        onClick={() => go(`/patients/${p.id}`)}
                      >
                        <Badge appearance="tint" className={styles.mr}>
                          {p.mrNumber}
                        </Badge>
                        <span className={styles.meta}>
                          <Text className={styles.primary}>
                            {p.firstName} {p.lastName}
                          </Text>
                          <Text className={styles.secondary}>
                            {[p.phone, p.email, p.bloodGroup ? `Blood: ${p.bloodGroup}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {canAppointments && results!.appointments.length > 0 && (
                  <>
                    <div className={styles.divider} />
                    <SectionHeader
                      icon={<CalendarMonthOutlinedIcon style={{ fontSize: 18 }} />}
                      label="Appointments"
                      count={results!.appointments.length}
                    />
                    {results!.appointments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={styles.item}
                        onClick={() => go(`/appointments/${a.id}`)}
                      >
                        <Badge appearance="tint" className={styles.mr}>
                          {a.patientMrNumber}
                        </Badge>
                        <span className={styles.meta}>
                          <Text className={styles.primary}>{a.patientName}</Text>
                          <Text className={styles.secondary}>
                            {a.reason ?? 'No reason'} · Dr. {a.providerName} ·{' '}
                            {new Date(a.startsAt).toLocaleDateString()}
                          </Text>
                        </span>
                        <Badge
                          size="small"
                          appearance={STATUS_APPEARANCE[a.status] ?? 'outline'}
                        >
                          {a.status}
                        </Badge>
                      </button>
                    ))}
                  </>
                )}

                {canBilling && results!.invoices.length > 0 && (
                  <>
                    <div className={styles.divider} />
                    <SectionHeader
                      icon={<ReceiptOutlinedIcon style={{ fontSize: 18 }} />}
                      label="Invoices"
                      count={results!.invoices.length}
                    />
                    {results!.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        className={styles.item}
                        onClick={() => go(`/billing/${inv.id}`)}
                      >
                        <Badge appearance="tint" className={styles.mr}>
                          {inv.patientMrNumber}
                        </Badge>
                        <span className={styles.meta}>
                          <Text className={styles.primary}>
                            {inv.invoiceNumber} · {inv.patientName}
                          </Text>
                          <Text className={styles.secondary}>
                            Total: Rs. {inv.total.toLocaleString()} · Paid: Rs.{' '}
                            {inv.amountPaid.toLocaleString()}
                          </Text>
                        </span>
                        <Badge
                          size="small"
                          appearance={STATUS_APPEARANCE[inv.status] ?? 'outline'}
                        >
                          {inv.status}
                        </Badge>
                      </button>
                    ))}
                  </>
                )}

                {canLab && results!.labOrders.length > 0 && (
                  <>
                    <div className={styles.divider} />
                    <SectionHeader
                      icon={<BiotechOutlinedIcon style={{ fontSize: 18 }} />}
                      label="Lab Orders"
                      count={results!.labOrders.length}
                    />
                    {results!.labOrders.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className={styles.item}
                        onClick={() =>
                          go(
                            user?.role === 'lab_technician'
                              ? `/lab/${l.id}`
                              : `/patients/${l.patientId}`,
                          )
                        }
                      >
                        <Badge appearance="tint" className={styles.mr}>
                          {l.patientMrNumber}
                        </Badge>
                        <span className={styles.meta}>
                          <Text className={styles.primary}>
                            {l.test} · {l.patientName}
                          </Text>
                          <Text className={styles.secondary}>
                            {new Date(l.orderedAt).toLocaleDateString()}
                          </Text>
                        </span>
                        <Badge
                          size="small"
                          appearance={STATUS_APPEARANCE[l.status] ?? 'outline'}
                        >
                          {l.status}
                        </Badge>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
