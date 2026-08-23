/**
 * Generates OpdReportsPage.tsx with consistent Fluent APIs.
 * Run: node scripts/gen-opd-reports.mjs
 */
import fs from 'fs';

const out = `import {
  Button,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Tab,
  TabList,
  Text,
  Title3,
  makeStyles,
  tokens,
  type BadgeProps,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import { FluentDateField, formatDateIso, parseDateIso } from '@/components/FluentDateField';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FetchingBar, StatCardsSkeleton, TableRowsSkeleton } from '@/components/LoadingUI';
import { DataGridTable, SearchField, StatusBadge, createTableColumn } from '@/components/TableUI';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { reportsService } from '@/services/reports.service';
import type {
  OpdDailyReport,
  OpdDoctorFeeSummary,
  OpdFeeRow,
  OpdInvoiceRow,
} from '@/types/report';
import type { TokenPerson } from '@/types/token';
import { OpdReportPrint } from '@/features/reports/OpdReportPrint';
import type { OpdPrintSection } from '@/features/reports/OpdReportPdf';
import {
  AccountBalanceWalletOutlinedIcon,
  AssessmentOutlinedIcon,
  ConfirmationNumberOutlinedIcon,
  LocalHospitalOutlinedIcon,
  PaymentsOutlinedIcon,
  PrintOutlinedIcon,
  UndoOutlinedIcon,
} from '@/icons/fluent';

type StatusColor = NonNullable<BadgeProps['color']>;

const invoiceStatusConfig: Record<string, { label: string; color: StatusColor }> = {
  DRAFT: { label: 'Draft', color: 'subtle' },
  ISSUED: { label: 'Issued', color: 'informative' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'danger' },
  VOID: { label: 'Void', color: 'danger' },
};

const feeStatusConfig: Record<string, { label: string; color: StatusColor }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  IN_PROGRESS: { label: 'In progress', color: 'informative' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'subtle' },
};

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  eyebrow: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  title: {
    letterSpacing: '-0.02em',
    marginTop: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightBold,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXXS,
  },
  filters: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  doctorField: { minWidth: '220px' },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  doctorCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  doctorName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  doctorsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  statsGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusXLarge,
    border: 'none',
    boxShadow: tokens.shadow4,
  },
  statInner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  statLabel: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  statValue: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase400,
  },
  card: {
    borderRadius: tokens.borderRadiusXLarge,
    border: \`1px solid \${tokens.colorNeutralStroke2}\`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHeader: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    borderBottom: \`1px solid \${tokens.colorNeutralStroke2}\`,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase300,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: \`1px solid \${tokens.colorNeutralStroke2}\`,
  },
  search: {
    marginLeft: 'auto',
    maxWidth: '280px',
  },
  errorBar: { margin: tokens.spacingHorizontalL },
  tableWrap: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    maxHeight: 'calc(100vh - 420px)',
    overflowY: 'auto',
  },
  right: { textAlign: 'right', width: '100%' },
  cellStrong: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  cellBold: { fontWeight: tokens.fontWeightBold },
});

function todayYmd(): string {
  const now = new Date();
  return \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(now.getDate()).padStart(2, '0')}\`;
}

function money(value: number): string {
  return \`Rs. \${new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}\`;
}

function doctorLabel(doctor: Pick<TokenPerson, 'firstName' | 'lastName'>): string {
  return \`\${doctor.firstName} \${doctor.lastName}\`.trim();
}

function DoctorCell({
  name,
  avatar,
  size = 32,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}): React.JSX.Element {
  const styles = useStyles();
  const display = name === '—' ? 'Doctor' : name;
  return (
    <div className={styles.doctorCell}>
      <DoctorAvatar src={avatar} name={display.startsWith('Dr.') ? display : \`Dr. \${display}\`} size={size} />
      <Text className={styles.doctorName}>{name}</Text>
    </div>
  );
}

export function OpdReportsPage(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayYmd);
  const [doctorId, setDoctorId] = useState('');
  const [tab, setTab] = useState<'invoices' | 'fees'>('invoices');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<{ report: OpdDailyReport; section: OpdPrintSection } | null>(null);

  const detailFrom = '/opd-reports';

  const doctors = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
  });
  const doctorList = doctors.data ?? [];
  const doctorById = useMemo(() => new Map(doctorList.map((d) => [d.id, d])), [doctorList]);
  const doctorByName = useMemo(() => {
    const map = new Map<string, TokenPerson>();
    for (const doctor of doctorList) map.set(doctorLabel(doctor), doctor);
    return map;
  }, [doctorList]);

  const report = useQuery({
    queryKey: ['reports:opd', date, doctorId],
    queryFn: () => reportsService.opd({ date, ...(doctorId ? { doctorId } : {}) }),
  });

  const data = report.data;
  const q = search.trim().toLowerCase();
  const invoiceRows = useMemo(() => {
    const rows = data?.invoices.rows ?? [];
    if (!q) return rows;
    return rows.filter((row) =>
      \`\${row.invoiceNumber} \${row.patientName} \${row.doctors} \${row.status}\`.toLowerCase().includes(q),
    );
  }, [data, q]);
  const feeRows = useMemo(() => {
    const rows = data?.fees.rows ?? [];
    if (!q) return rows;
    return rows.filter((row) =>
      \`\${row.tokenNumber} \${row.patientName} \${row.doctorName} \${row.status}\`.toLowerCase().includes(q),
    );
  }, [data, q]);

  const selectedDoctor = doctorId ? doctorById.get(doctorId) : undefined;

  const summaryCards =
    tab === 'invoices'
      ? [
          { label: 'Bills', value: String(data?.invoices.count ?? 0), icon: <PaymentsOutlinedIcon />, color: tokens.colorBrandForeground1, bg: tokens.colorBrandBackground2 },
          { label: 'Billed', value: money(data?.invoices.billed ?? 0), icon: <AssessmentOutlinedIcon />, color: tokens.colorPaletteBlueForeground2, bg: tokens.colorPaletteBlueBackground2 },
          { label: 'Collected', value: money(data?.invoices.collected ?? 0), icon: <AccountBalanceWalletOutlinedIcon />, color: tokens.colorPaletteGreenForeground2, bg: tokens.colorPaletteGreenBackground2 },
          { label: 'Outstanding', value: money(data?.invoices.outstanding ?? 0), icon: <UndoOutlinedIcon />, color: tokens.colorPaletteDarkOrangeForeground2, bg: tokens.colorPaletteDarkOrangeBackground2 },
        ]
      : [
          { label: 'Tokens', value: String(data?.fees.count ?? 0), icon: <ConfirmationNumberOutlinedIcon />, color: tokens.colorBrandForeground1, bg: tokens.colorBrandBackground2 },
          { label: 'Fees collected', value: money(data?.fees.collected ?? 0), icon: <LocalHospitalOutlinedIcon />, color: tokens.colorPaletteBlueForeground2, bg: tokens.colorPaletteBlueBackground2 },
          { label: 'Discount', value: money(data?.fees.discounted ?? 0), icon: <PaymentsOutlinedIcon />, color: tokens.colorPaletteDarkOrangeForeground2, bg: tokens.colorPaletteDarkOrangeBackground2 },
          { label: 'Refunded', value: money(data?.fees.refunded ?? 0), icon: <UndoOutlinedIcon />, color: tokens.colorPaletteRedForeground2, bg: tokens.colorPaletteRedBackground2 },
          { label: 'Net fees', value: money(data?.fees.net ?? 0), icon: <AccountBalanceWalletOutlinedIcon />, color: tokens.colorPaletteGreenForeground2, bg: tokens.colorPaletteGreenBackground2 },
        ];

  const byDoctorColumns = useMemo<TableColumnDefinition<OpdDoctorFeeSummary>[]>(
    () => [
      createTableColumn<OpdDoctorFeeSummary>({
        columnId: 'doctor',
        compare: (a, b) => a.doctorName.localeCompare(b.doctorName),
        renderHeaderCell: () => 'Doctor',
        renderCell: (row) => <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />,
      }),
      createTableColumn<OpdDoctorFeeSummary>({
        columnId: 'tokens',
        compare: (a, b) => a.tokens - b.tokens,
        renderHeaderCell: () => 'Tokens',
        renderCell: (row) => <div className={styles.right}>{row.tokens}</div>,
      }),
      createTableColumn<OpdDoctorFeeSummary>({
        columnId: 'collected',
        compare: (a, b) => a.collected - b.collected,
        renderHeaderCell: () => 'Collected',
        renderCell: (row) => <div className={styles.right}>{money(row.collected)}</div>,
      }),
      createTableColumn<OpdDoctorFeeSummary>({
        columnId: 'refunded',
        compare: (a, b) => a.refunded - b.refunded,
        renderHeaderCell: () => 'Refunded',
        renderCell: (row) => <div className={styles.right}>{money(row.refunded)}</div>,
      }),
      createTableColumn<OpdDoctorFeeSummary>({
        columnId: 'net',
        compare: (a, b) => a.net - b.net,
        renderHeaderCell: () => 'Net',
        renderCell: (row) => (
          <div className={styles.right}>
            <Text className={styles.cellBold}>{money(row.net)}</Text>
          </div>
        ),
      }),
    ],
    [doctorById, styles.cellBold, styles.right],
  );

  const invoiceColumns = useMemo<TableColumnDefinition<OpdInvoiceRow>[]>(
    () => [
      createTableColumn<OpdInvoiceRow>({
        columnId: 'invoice',
        compare: (a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber),
        renderHeaderCell: () => 'Invoice',
        renderCell: (row) => <Text className={styles.cellStrong}>{row.invoiceNumber}</Text>,
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'patient',
        compare: (a, b) => a.patientName.localeCompare(b.patientName),
        renderHeaderCell: () => 'Patient',
        renderCell: (row) => row.patientName,
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'doctor',
        compare: (a, b) => a.doctors.localeCompare(b.doctors),
        renderHeaderCell: () => 'Doctor',
        renderCell: (row) =>
          row.doctors === '—' ? (
            '—'
          ) : (
            <div className={styles.doctorsWrap}>
              {row.doctors.split(', ').map((name) => (
                <DoctorCell key={name} name={name} avatar={doctorByName.get(name)?.avatar} size={28} />
              ))}
            </div>
          ),
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'status',
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => 'Status',
        renderCell: (row) => {
          const cfg = invoiceStatusConfig[row.status] ?? { label: row.status, color: 'subtle' as const };
          return <StatusBadge color={cfg.color}>{cfg.label}</StatusBadge>;
        },
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'total',
        compare: (a, b) => a.total - b.total,
        renderHeaderCell: () => 'Total',
        renderCell: (row) => <div className={styles.right}>{money(row.total)}</div>,
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'paid',
        compare: (a, b) => a.amountPaid - b.amountPaid,
        renderHeaderCell: () => 'Paid',
        renderCell: (row) => <div className={styles.right}>{money(row.amountPaid)}</div>,
      }),
      createTableColumn<OpdInvoiceRow>({
        columnId: 'due',
        compare: (a, b) => a.outstanding - b.outstanding,
        renderHeaderCell: () => 'Due',
        renderCell: (row) => <div className={styles.right}>{money(row.outstanding)}</div>,
      }),
    ],
    [doctorByName, styles.cellStrong, styles.doctorsWrap, styles.right],
  );

  const feeColumns = useMemo<TableColumnDefinition<OpdFeeRow>[]>(
    () => [
      createTableColumn<OpdFeeRow>({
        columnId: 'token',
        compare: (a, b) => a.tokenNumber - b.tokenNumber,
        renderHeaderCell: () => 'Token',
        renderCell: (row) => (
          <Text className={styles.cellStrong}>{String(row.tokenNumber).padStart(3, '0')}</Text>
        ),
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'patient',
        compare: (a, b) => a.patientName.localeCompare(b.patientName),
        renderHeaderCell: () => 'Patient',
        renderCell: (row) => row.patientName,
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'doctor',
        compare: (a, b) => a.doctorName.localeCompare(b.doctorName),
        renderHeaderCell: () => 'Doctor',
        renderCell: (row) => (
          <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
        ),
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'status',
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => 'Status',
        renderCell: (row) => {
          const cfg = feeStatusConfig[row.status] ?? { label: row.status, color: 'subtle' as const };
          return <StatusBadge color={cfg.color}>{cfg.label}</StatusBadge>;
        },
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'fee',
        compare: (a, b) => a.consultationFee - b.consultationFee,
        renderHeaderCell: () => 'Fee',
        renderCell: (row) => <div className={styles.right}>{money(row.consultationFee)}</div>,
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'discount',
        compare: (a, b) => a.feeDiscount - b.feeDiscount,
        renderHeaderCell: () => 'Discount',
        renderCell: (row) => <div className={styles.right}>{money(row.feeDiscount)}</div>,
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'refunded',
        compare: (a, b) => a.feeRefunded - b.feeRefunded,
        renderHeaderCell: () => 'Refunded',
        renderCell: (row) => <div className={styles.right}>{money(row.feeRefunded)}</div>,
      }),
      createTableColumn<OpdFeeRow>({
        columnId: 'net',
        compare: (a, b) => a.net - b.net,
        renderHeaderCell: () => 'Net',
        renderCell: (row) => (
          <div className={styles.right}>
            <Text className={styles.cellBold}>{money(row.net)}</Text>
          </div>
        ),
      }),
    ],
    [doctorById, styles.cellBold, styles.cellStrong, styles.right],
  );

  function handlePrint(section: OpdPrintSection): void {
    if (!data) return;
    setPreview({ report: data, section });
  }

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <Text className={styles.eyebrow} size={200}>
              Daily settlement
            </Text>
            <Title3 className={styles.title}>OPD Reports</Title3>
            <Text className={styles.subtitle} size={200}>
              Invoices and doctor consultation fees for a day. Pick a doctor if they ask for their hisaab.
            </Text>
          </div>
          <div className={styles.filters}>
            <FluentDateField
              label="Date"
              value={parseDateIso(date)}
              onSelectDate={(d) => setDate(formatDateIso(d) || todayYmd())}
            />
            <Field label="Doctor" className={styles.doctorField}>
              <Dropdown
                placeholder="All doctors"
                value={selectedDoctor ? doctorLabel(selectedDoctor) : 'All doctors'}
                selectedOptions={doctorId ? [doctorId] : ['']}
                onOptionSelect={(_, d) => setDoctorId(String(d.optionValue ?? ''))}
              >
                <Option value="" text="All doctors">
                  All doctors
                </Option>
                {doctorList.map((doctor) => (
                  <Option key={doctor.id} value={doctor.id} text={doctorLabel(doctor)}>
                    <div className={styles.optionRow}>
                      <DoctorAvatar src={doctor.avatar} name={\`Dr. \${doctorLabel(doctor)}\`} size={28} />
                      {doctorLabel(doctor)}
                    </div>
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Button
              appearance="primary"
              icon={<PrintOutlinedIcon />}
              disabled={!data}
              onClick={() => handlePrint('all')}
            >
              Print all
            </Button>
          </div>
        </div>

        {report.isLoading ? (
          <StatCardsSkeleton count={summaryCards.length} />
        ) : (
          <div className={styles.statsGrid}>
            {summaryCards.map((card) => (
              <div key={card.label} className={styles.statCard} style={{ backgroundColor: card.bg }}>
                <div className={styles.statInner}>
                  <span style={{ color: card.color, display: 'flex' }}>{card.icon}</span>
                  <div>
                    <Text className={styles.statLabel}>{card.label}</Text>
                    <Text className={styles.statValue}>{card.value}</Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'fees' && (data?.fees.byDoctor.length ?? 0) > 1 ? (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text className={styles.sectionTitle}>By doctor</Text>
            </div>
            <div className={styles.tableWrap}>
              <DataGridTable
                items={data?.fees.byDoctor ?? []}
                columns={byDoctorColumns}
                getRowId={(row) => row.doctorId}
                sortable={false}
                emptyMessage="No doctor breakdown."
              />
            </div>
          </div>
        ) : null}

        <div className={styles.card}>
          <FetchingBar show={report.isFetching && !report.isLoading} />
          <div className={styles.toolbar}>
            <TabList
              selectedValue={tab}
              onTabSelect={(_, d) => {
                setTab(d.value as 'invoices' | 'fees');
                setSearch('');
              }}
            >
              <Tab value="invoices">Invoices</Tab>
              <Tab value="fees">Doctor fees</Tab>
            </TabList>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={
                tab === 'invoices' ? 'Search invoice or patient...' : 'Search token, patient or doctor...'
              }
              className={styles.search}
            />
            <Button
              appearance="primary"
              disabled={!data}
              icon={<PrintOutlinedIcon />}
              onClick={() => handlePrint(tab === 'invoices' ? 'invoices' : 'fees')}
            >
              {tab === 'invoices' ? 'Print invoices' : 'Print doctor fees'}
            </Button>
          </div>
          {report.isError ? (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load OPD report.</MessageBarBody>
            </MessageBar>
          ) : null}
          <div className={styles.tableWrap}>
            {report.isLoading ? (
              <TableRowsSkeleton cols={tab === 'invoices' ? 7 : 8} />
            ) : tab === 'invoices' ? (
              <DataGridTable
                items={invoiceRows}
                columns={invoiceColumns}
                getRowId={(row) => row.id}
                emptyMessage="No invoices for this day."
                onRowClick={(row) =>
                  navigate(\`/opd-reports/invoices/\${row.id}\`, { state: { from: detailFrom } })
                }
              />
            ) : (
              <DataGridTable
                items={feeRows}
                columns={feeColumns}
                getRowId={(row) => row.id}
                emptyMessage="No doctor fees for this day."
                onRowClick={(row) =>
                  navigate(\`/opd-reports/fees/\${row.id}\`, { state: { from: detailFrom } })
                }
              />
            )}
          </div>
        </div>
      </div>
      {preview ? (
        <OpdReportPrint
          report={preview.report}
          section={preview.section}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
`;

const target = 'src/renderer/src/features/reports/OpdReportsPage.tsx';
fs.writeFileSync(target, out, 'utf8');
const buf = fs.readFileSync(target);
console.log('wrote', target, 'bytes', buf.length, 'nulls', [...buf].filter((b) => b === 0).length);
console.log('mui', /@mui/.test(out));
console.log('legacy table', /TableHead|TableBody|TableCell/.test(out));
