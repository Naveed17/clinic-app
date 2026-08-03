import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer';
import { Dialog, DialogContent, Box, Button, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import type { Invoice } from '@/types/invoice';
import { useEffect, useState } from 'react';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#0F172A',
  },
  // Top Header
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  invoiceNumText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },

  // From / To Party Details Row
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  partyCol: {
    width: '46%',
  },
  partyColRight: {
    width: '46%',
    alignItems: 'flex-end',
  },
  partyHeader: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  partyHeaderRight: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'right',
  },
  partyName: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3,
  },
  partyNameRight: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3,
    textAlign: 'right',
  },
  partyDetail: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 2,
    lineHeight: 1.3,
  },
  partyDetailRight: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 2,
    lineHeight: 1.3,
    textAlign: 'right',
  },

  // Dates Row
  datesRow: {
    flexDirection: 'row',
    gap: 48,
    marginBottom: 28,
  },
  dateCol: {},
  dateLabel: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  dateVal: {
    fontSize: 9.5,
    color: '#334155',
  },

  // Invoice Details Section Title
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 12,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  thNum: {
    width: 24,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  thDesc: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  thQty: {
    width: 45,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  thPrice: {
    width: 75,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  thTotal: {
    width: 80,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
    alignItems: 'flex-start',
  },
  tdNum: {
    width: 24,
    fontSize: 9,
    color: '#475569',
  },
  tdDesc: {
    flex: 1,
    paddingRight: 12,
  },
  itemTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  tdQty: {
    width: 45,
    fontSize: 9,
    color: '#334155',
    textAlign: 'right',
  },
  tdPrice: {
    width: 75,
    fontSize: 9,
    color: '#334155',
    textAlign: 'right',
  },
  tdTotal: {
    width: 80,
    fontSize: 9,
    color: '#334155',
    textAlign: 'right',
  },

  // Summary Totals
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    marginBottom: 30,
  },
  summaryBox: {
    width: 210,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#475569',
  },
  summaryVal: {
    fontSize: 9,
    color: '#0F172A',
    textAlign: 'right',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  totalVal: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerColLeft: {
    width: '60%',
  },
  footerColRight: {
    width: '35%',
  },
  footerTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  footerText: {
    fontSize: 8.5,
    color: '#64748B',
    lineHeight: 1.3,
  },
});

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(Number(v))}`;

function ReceiptDocument({
  invoice,
  clinicName,
  clinicAddress,
  clinicPhone,
  clinicEmail,
}: {
  invoice: Invoice;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail?: string;
}) {
  const doctorFee = Math.max(0, invoice.total + invoice.discount - invoice.subtotal);
  const statusText =
    invoice.status === 'PAID'
      ? 'Paid'
      : invoice.status === 'ISSUED'
      ? 'Issued'
      : invoice.status === 'PARTIALLY_PAID'
      ? 'Partial'
      : invoice.status === 'VOID'
      ? 'Void'
      : 'Draft';

  const createDateStr = new Date(invoice.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.topRow}>
          <View style={styles.logoContainer}>
            <Svg width={36} height={36} viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="46" fill="#10B981" />
              <Path
                d="M30 65 L46 36 L58 54 L70 36"
                stroke="#FFFFFF"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <View>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.invoiceNumText}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        {/* Invoice From & Invoice To */}
        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Text style={styles.partyHeader}>Invoice from</Text>
            <Text style={styles.partyName}>{clinicName || 'CareFlow Clinic'}</Text>
            {clinicAddress ? <Text style={styles.partyDetail}>{clinicAddress}</Text> : null}
            {clinicPhone ? <Text style={styles.partyDetail}>{clinicPhone}</Text> : null}
          </View>

          <View style={styles.partyColRight}>
            <Text style={styles.partyHeaderRight}>Invoice to</Text>
            <Text style={styles.partyNameRight}>
              {invoice.patient.firstName} {invoice.patient.lastName}
            </Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Date create</Text>
            <Text style={styles.dateVal}>{createDateStr}</Text>
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Due date</Text>
            <Text style={styles.dateVal}>{createDateStr}</Text>
          </View>
        </View>

        {/* Invoice Details Table */}
        <Text style={styles.sectionTitle}>Invoice details</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.thNum}>#</Text>
          <Text style={styles.thDesc}>Description</Text>
          <Text style={styles.thQty}>Qty</Text>
          <Text style={styles.thPrice}>Unit price</Text>
          <Text style={styles.thTotal}>Total</Text>
        </View>

        {invoice.items.map((item, idx) => (
          <View key={item.id || idx} style={styles.tableRow}>
            <Text style={styles.tdNum}>{idx + 1}</Text>
            <View style={styles.tdDesc}>
              <Text style={styles.itemTitle}>{item.description}</Text>
            </View>
            <Text style={styles.tdQty}>{item.quantity}</Text>
            <Text style={styles.tdPrice}>{money(item.unitPrice)}</Text>
            <Text style={styles.tdTotal}>{money(item.lineTotal)}</Text>
          </View>
        ))}

        {doctorFee > 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.tdNum}>{invoice.items.length + 1}</Text>
            <View style={styles.tdDesc}>
              <Text style={styles.itemTitle}>Doctor Fee / Consultation</Text>
            </View>
            <Text style={styles.tdQty}>1</Text>
            <Text style={styles.tdPrice}>{money(doctorFee)}</Text>
            <Text style={styles.tdTotal}>{money(doctorFee)}</Text>
          </View>
        )}

        {/* Totals Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>{money(invoice.subtotal + doctorFee)}</Text>
            </View>

            {invoice.discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryVal}>-{money(invoice.discount)}</Text>
              </View>
            )}

            {Number(invoice.amountPaid) > 0 && invoice.status !== 'PAID' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount Paid</Text>
                <Text style={styles.summaryVal}>{money(Number(invoice.amountPaid))}</Text>
              </View>
            )}

            <View style={styles.summaryTotalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>{money(invoice.total)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerColLeft}>
            <Text style={styles.footerTitle}>NOTES</Text>
            <Text style={styles.footerText}>
              {invoice.notes || 'We appreciate your business. Should you need us to add VAT or extra notes let us know!'}
            </Text>
          </View>
          <View style={styles.footerColRight}>
            <Text style={[styles.footerTitle, { textAlign: 'right' }]}>Have a question?</Text>
            <Text style={[styles.footerText, { textAlign: 'right' }]}>
              {clinicPhone ? clinicPhone : clinicEmail ? clinicEmail : 'support@careflow.com'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function InvoicePrintPreview({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}): React.JSX.Element {
  const [clinic, setClinic] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '' });

  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setClinic({
      clinicName: s.clinicName ?? '',
      clinicAddress: s.clinicAddress ?? '',
      clinicPhone: s.clinicPhone ?? '',
    }));
  }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1.5, overflow: 'hidden' } }}>
      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography fontWeight={700} fontSize={15}>Invoice PDF Preview</Typography>
        <Button onClick={onClose} size="small" startIcon={<CloseOutlinedIcon />}>Close</Button>
      </Box>
      <DialogContent sx={{ p: 0, height: 750 }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          <ReceiptDocument invoice={invoice} {...clinic} />
        </PDFViewer>
      </DialogContent>
      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1 }}>Close</Button>
      </Box>
    </Dialog>
  );
}
