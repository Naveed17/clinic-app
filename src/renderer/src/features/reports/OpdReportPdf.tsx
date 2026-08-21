import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { OpdDailyReport } from '@/types/report';
import { DEFAULT_CLINIC_LOGO } from '@/utils/clinicBrandLogo';

export type OpdPrintSection = 'all' | 'invoices' | 'fees';

export type OpdReportClinic = {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  brand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.4,
    borderBottomColor: '#222222',
    marginBottom: 10,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    paddingRight: 12,
  },
  logo: {
    width: 42,
    height: 42,
    objectFit: 'contain',
    marginRight: 10,
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0d47a1',
    letterSpacing: 0.4,
  },
  slogan: {
    marginTop: 3,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Oblique',
    color: '#374151',
  },
  contacts: {
    alignItems: 'flex-end',
    maxWidth: 220,
  },
  contactLine: {
    fontSize: 8.5,
    color: '#111111',
    marginBottom: 2,
    textAlign: 'right',
  },
  metaBar: {
    flexDirection: 'row',
    borderWidth: 0.4,
    borderColor: '#c5cdd4',
    backgroundColor: '#f7f9fb',
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 0.4,
    borderRightColor: '#dbe3ea',
  },
  metaColLast: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 8,
    color: '#4b5563',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  sectionTitleWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitleLine: {
    marginTop: 2,
    width: 64,
    borderBottomWidth: 0.4,
    borderBottomColor: '#111111',
  },
  kpiRow: {
    flexDirection: 'row',
    borderWidth: 0.4,
    borderColor: '#c5cdd4',
    marginBottom: 8,
  },
  kpiCell: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRightWidth: 0.4,
    borderRightColor: '#dbe3ea',
  },
  kpiCellLast: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  kpiLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 0.4,
    borderBottomWidth: 0.4,
    borderTopColor: '#111111',
    borderBottomColor: '#111111',
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 5,
    alignItems: 'flex-start',
  },
  tableRowLast: {
    flexDirection: 'row',
    paddingVertical: 5,
    alignItems: 'flex-start',
  },
  tableFooter: {
    flexDirection: 'row',
    borderTopWidth: 0.4,
    borderTopColor: '#111111',
    paddingTop: 7,
    paddingBottom: 4,
  },
  th: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  td: {
    fontSize: 8.5,
    color: '#111111',
  },
  tdBold: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  num: {
    fontSize: 8,
    fontFamily: 'Courier',
    textAlign: 'right',
    color: '#111111',
  },
  numBold: {
    fontSize: 8,
    fontFamily: 'Courier-Bold',
    textAlign: 'right',
    color: '#111111',
  },
  empty: {
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 9,
    color: '#6b7280',
  },
  notes: {
    marginTop: 8,
    fontSize: 8,
    color: '#4b5563',
    lineHeight: 1.45,
  },
  pageNum: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 8,
    color: '#6b7280',
  },
});

function money(v: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0)}`;
}

function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PARTIALLY_PAID: 'Partial',
    IN_PROGRESS: 'In progress',
  };
  return map[status] || status;
}

function reportCopy(section: OpdPrintSection): { title: string; slogan: string; note: string } {
  if (section === 'invoices') {
    return {
      title: 'OPD Invoices',
      slogan: 'Invoice settlement',
      note: 'Invoice totals exclude void/draft bills.',
    };
  }
  if (section === 'fees') {
    return {
      title: 'Doctor fees',
      slogan: 'Doctor consultation fees',
      note: 'Doctor fees are consultation amounts after follow-up discounts, minus refunds.',
    };
  }
  return {
    title: 'Daily OPD Report',
    slogan: 'Daily OPD settlement',
      note: 'Invoice totals exclude void/draft bills. Doctor fees are consultation amounts after follow-up discounts, minus refunds.',
  };
}

function KpiRow({ items }: { items: Array<[string, string]> }): React.JSX.Element {
  return (
    <View style={styles.kpiRow} wrap={false}>
      {items.map(([label, value], index) => (
        <View key={label} style={index === items.length - 1 ? styles.kpiCellLast : styles.kpiCell}>
          <Text style={styles.kpiLabel}>{label}</Text>
          <Text style={styles.kpiValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function OpdReportDocument({
  report,
  clinic,
  logoSrc = DEFAULT_CLINIC_LOGO,
  section = 'all',
}: {
  report: OpdDailyReport;
  clinic: OpdReportClinic;
  logoSrc?: string;
  section?: OpdPrintSection;
}): React.JSX.Element {
  const clinicName = (clinic.clinicName || 'Clinic').trim().toUpperCase();
  const doctorLabel = report.doctorName || 'All doctors';
  const dateLabel = formatDateLabel(report.date);
  const phone = clinic.clinicPhone?.trim() || '';
  const address = clinic.clinicAddress?.trim() || '';
  const copy = reportCopy(section);
  const showInvoices = section === 'all' || section === 'invoices';
  const showFees = section === 'all' || section === 'fees';

  return (
    <Document title={`${copy.title} ${report.date}`} author={clinicName}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.brand} wrap={false}>
          <View style={styles.brandLeft}>
            {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
            <View>
              <Text style={styles.clinicName}>{clinicName}</Text>
              <Text style={styles.slogan}>{copy.slogan}</Text>
            </View>
          </View>
          <View style={styles.contacts}>
            {phone ? <Text style={styles.contactLine}>{phone}</Text> : null}
            {address ? <Text style={styles.contactLine}>{address}</Text> : null}
          </View>
        </View>

        <View style={styles.metaBar} wrap={false}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Report</Text>
            <Text style={styles.metaValue}>{copy.title}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{dateLabel}</Text>
          </View>
          <View style={styles.metaColLast}>
            <Text style={styles.metaLabel}>Doctor</Text>
            <Text style={styles.metaValue}>{doctorLabel}</Text>
          </View>
        </View>

        {showInvoices ? (
          <View>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>Invoices</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <KpiRow
              items={[
                ['Bills', String(report.invoices.count)],
                ['Billed', money(report.invoices.billed)],
                ['Collected', money(report.invoices.collected)],
                ['Refunded', money(report.invoices.refunded)],
                ['Outstanding', money(report.invoices.outstanding)],
              ]}
            />
            <View style={styles.table}>
              <View style={styles.tableHeader} wrap={false}>
                <Text style={[styles.th, { width: '18%' }]}>Invoice</Text>
                <Text style={[styles.th, { width: '16%' }]}>Patient</Text>
                <Text style={[styles.th, { width: '16%' }]}>Doctor</Text>
                <Text style={[styles.th, { width: '10%' }]}>Status</Text>
                <Text style={[styles.th, styles.numBold, { width: '10%' }]}>Total</Text>
                <Text style={[styles.th, styles.numBold, { width: '10%' }]}>Paid</Text>
                <Text style={[styles.th, styles.numBold, { width: '10%' }]}>Refunded</Text>
                <Text style={[styles.th, styles.numBold, { width: '10%' }]}>Due</Text>
              </View>
              {report.invoices.rows.length === 0 ? (
                <Text style={styles.empty}>No invoices for this day.</Text>
              ) : (
                report.invoices.rows.map((row, index) => (
                  <View
                    key={row.id}
                    style={index === report.invoices.rows.length - 1 ? styles.tableRowLast : styles.tableRow}
                    wrap={false}
                  >
                    <Text style={[styles.tdBold, { width: '18%', paddingRight: 4 }]}>{row.invoiceNumber}</Text>
                    <Text style={[styles.td, { width: '16%', paddingRight: 4 }]}>{row.patientName}</Text>
                    <Text style={[styles.td, { width: '16%', paddingRight: 4 }]}>{row.doctors}</Text>
                    <Text style={[styles.td, { width: '10%', paddingRight: 4 }]}>{statusLabel(row.status)}</Text>
                    <Text style={[styles.num, { width: '10%' }]}>{money(row.total)}</Text>
                    <Text style={[styles.num, { width: '10%' }]}>{money(row.amountPaid)}</Text>
                    <Text style={[styles.num, { width: '10%' }]}>{money(row.refunded)}</Text>
                    <Text style={[styles.num, { width: '10%' }]}>{money(row.outstanding)}</Text>
                  </View>
                ))
              )}
              <View style={styles.tableFooter} wrap={false}>
                <Text style={[styles.tdBold, { width: '60%' }]}>Totals</Text>
                <Text style={[styles.numBold, { width: '10%' }]}>{money(report.invoices.billed)}</Text>
                <Text style={[styles.numBold, { width: '10%' }]}>{money(report.invoices.collected)}</Text>
                <Text style={[styles.numBold, { width: '10%' }]}>{money(report.invoices.refunded)}</Text>
                <Text style={[styles.numBold, { width: '10%' }]}>{money(report.invoices.outstanding)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {showFees ? (
          <View>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>Doctor fees</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <KpiRow
              items={[
                ['Tokens', String(report.fees.count)],
                ['Collected', money(report.fees.collected)],
                ['Discount', money(report.fees.discounted)],
                ['Refunded', money(report.fees.refunded)],
                ['Net', money(report.fees.net)],
              ]}
            />
            {report.fees.byDoctor.length > 1 ? (
              <View style={styles.table}>
                <View style={styles.tableHeader} wrap={false}>
                  <Text style={[styles.th, { width: '40%' }]}>Doctor</Text>
                  <Text style={[styles.th, styles.numBold, { width: '12%' }]}>Tokens</Text>
                  <Text style={[styles.th, styles.numBold, { width: '16%' }]}>Collected</Text>
                  <Text style={[styles.th, styles.numBold, { width: '16%' }]}>Refunded</Text>
                  <Text style={[styles.th, styles.numBold, { width: '16%' }]}>Net</Text>
                </View>
                {report.fees.byDoctor.map((row) => (
                  <View key={row.doctorId} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.td, { width: '40%', paddingRight: 4 }]}>{row.doctorName}</Text>
                    <Text style={[styles.num, { width: '12%' }]}>{String(row.tokens)}</Text>
                    <Text style={[styles.num, { width: '16%' }]}>{money(row.collected)}</Text>
                    <Text style={[styles.num, { width: '16%' }]}>{money(row.refunded)}</Text>
                    <Text style={[styles.num, { width: '16%' }]}>{money(row.net)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.table}>
              <View style={styles.tableHeader} wrap={false}>
                <Text style={[styles.th, { width: '9%' }]}>Token</Text>
                <Text style={[styles.th, { width: '18%' }]}>Patient</Text>
                <Text style={[styles.th, { width: '16%' }]}>Doctor</Text>
                <Text style={[styles.th, { width: '10%' }]}>Status</Text>
                <Text style={[styles.th, styles.numBold, { width: '12%' }]}>Fee</Text>
                <Text style={[styles.th, styles.numBold, { width: '11%' }]}>Discount</Text>
                <Text style={[styles.th, styles.numBold, { width: '12%' }]}>Refunded</Text>
                <Text style={[styles.th, styles.numBold, { width: '12%' }]}>Net</Text>
              </View>
              {report.fees.rows.length === 0 ? (
                <Text style={styles.empty}>No doctor fees for this day.</Text>
              ) : (
                report.fees.rows.map((row, index) => (
                  <View
                    key={row.id}
                    style={index === report.fees.rows.length - 1 ? styles.tableRowLast : styles.tableRow}
                    wrap={false}
                  >
                    <Text style={[styles.tdBold, { width: '9%', paddingRight: 4 }]}>
                      {String(row.tokenNumber).padStart(3, '0')}
                    </Text>
                    <Text style={[styles.td, { width: '18%', paddingRight: 4 }]}>{row.patientName}</Text>
                    <Text style={[styles.td, { width: '16%', paddingRight: 4 }]}>{row.doctorName}</Text>
                    <Text style={[styles.td, { width: '10%', paddingRight: 4 }]}>{statusLabel(row.status)}</Text>
                    <Text style={[styles.num, { width: '12%' }]}>{money(row.consultationFee)}</Text>
                    <Text style={[styles.num, { width: '11%' }]}>{money(row.feeDiscount)}</Text>
                    <Text style={[styles.num, { width: '12%' }]}>{money(row.feeRefunded)}</Text>
                    <Text style={[styles.num, { width: '12%' }]}>{money(row.net)}</Text>
                  </View>
                ))
              )}
              <View style={styles.tableFooter} wrap={false}>
                <Text style={[styles.tdBold, { width: '53%' }]}>Totals</Text>
                <Text style={[styles.numBold, { width: '12%' }]}>{money(report.fees.rows.reduce((s, r) => s + r.consultationFee, 0))}</Text>
                <Text style={[styles.numBold, { width: '11%' }]}>{money(report.fees.discounted)}</Text>
                <Text style={[styles.numBold, { width: '12%' }]}>{money(report.fees.refunded)}</Text>
                <Text style={[styles.numBold, { width: '12%' }]}>{money(report.fees.net)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.notes}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Note: </Text>
          {copy.note}
        </Text>
        <Text
          style={styles.pageNum}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
