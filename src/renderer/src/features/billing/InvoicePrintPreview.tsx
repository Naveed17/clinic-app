import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  PDFViewer,
  Font,
} from '@react-pdf/renderer';
import { Dialog, DialogContent, Box, Button } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import type { Invoice } from '@/types/invoice';
import { useEffect, useState } from 'react';
// cspell:ignore bwipjs
import bwipjs from 'bwip-js';

function generateBarcode(text: string): string {
  const canvas = document.createElement('canvas');
  bwipjs.toCanvas(canvas, {
    bcid: 'code128',
    text,
    scale: 2,
    height: 12,
    includetext: false,
  });
  return canvas.toDataURL('image/png');
}

Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzA.ttf' },
    {
      src: 'https://fonts.gstatic.com/s/cousine/v27/d6lNkaiiRdih4SpP_SEvyRTo39l8hw.ttf',
      fontWeight: 'bold',
    },
  ],
});

const STAR_LINE = '* * * * * * * * * * * * * * * * * * * * * * *';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 32,
    fontFamily: 'Courier',
  },
  center: { textAlign: 'center' },
  shopName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 3 },
  shopSub: { fontSize: 9, textAlign: 'center', color: '#444', marginBottom: 2 },
  stars: { fontSize: 8, textAlign: 'center', color: '#888', marginVertical: 6 },
  receiptTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginVertical: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  headerLabel: { fontSize: 10, fontWeight: 'bold' },
  headerValue: { fontSize: 10, fontWeight: 'bold' },
  itemLabel: { fontSize: 9.5, flex: 1 },
  itemQty: { fontSize: 9.5, width: 30, textAlign: 'center' },
  itemPrice: { fontSize: 9.5, width: 55, textAlign: 'right' },
  totalLabel: { fontSize: 12, fontWeight: 'bold' },
  totalValue: { fontSize: 12, fontWeight: 'bold' },
  subLabel: { fontSize: 9.5, color: '#333' },
  subValue: { fontSize: 9.5, color: '#333' },
  metaLabel: { fontSize: 9, color: '#555' },
  metaValue: { fontSize: 9, color: '#555' },
  thankYou: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginVertical: 6 },
});

const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(Number(v))}`;

function ReceiptDocument({ invoice, clinicName, clinicAddress, clinicPhone }: {
  invoice: Invoice;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
}) {
  // Doctor fee is included in the invoice total but is not stored as a separate
  // database column. Derive it from the medicines subtotal, discount, and total.
  const doctorFee = Math.max(0, invoice.total + invoice.discount - invoice.subtotal);

  return (
    <Document>
      <Page size={[226, 720]} style={styles.page} wrap={false}>
        {/* Shop Header */}
        <Text style={styles.shopName}>{clinicName || 'CLINIC MANAGEMENT'}</Text>
        {clinicAddress ? <Text style={styles.shopSub}>{clinicAddress}</Text> : null}
        {clinicPhone ? <Text style={styles.shopSub}>Tel: {clinicPhone}</Text> : null}

        <Text style={styles.stars}>{STAR_LINE}</Text>
        <Text style={styles.receiptTitle}>CASH RECEIPT</Text>
        <Text style={styles.stars}>{STAR_LINE}</Text>

        {/* Invoice Meta */}
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Invoice #</Text>
          <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Patient</Text>
          <Text style={styles.metaValue}>
            {invoice.patient.firstName} {invoice.patient.lastName}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{new Date(invoice.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Time</Text>
          <Text style={styles.metaValue}>{new Date(invoice.createdAt).toLocaleTimeString()}</Text>
        </View>

        <Text style={styles.stars}>{STAR_LINE}</Text>

        {/* Items Header */}
        <View style={styles.row}>
          <Text style={[styles.headerLabel, { flex: 1 }]}>Description</Text>
          <Text style={[styles.headerLabel, { width: 30, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.headerLabel, { width: 55, textAlign: 'right' }]}>Price</Text>
        </View>

        <Text style={styles.stars}>{STAR_LINE}</Text>

        {/* Items */}
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.itemLabel}>{item.description}</Text>
            <Text style={styles.itemQty}>{item.quantity}</Text>
            <Text style={styles.itemPrice}>{money(item.lineTotal)}</Text>
          </View>
        ))}
        {doctorFee > 0 && (
          <View style={styles.row}>
            <Text style={styles.itemLabel}>Doctor Fee</Text>
            <Text style={styles.itemQty}>-</Text>
            <Text style={styles.itemPrice}>{money(doctorFee)}</Text>
          </View>
        )}

        <Text style={styles.stars}>{STAR_LINE}</Text>

        {/* Totals */}
        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(invoice.total)}</Text>
        </View>
        {invoice.discount > 0 && (
          <View style={styles.row}>
            <Text style={styles.subLabel}>Discount</Text>
            <Text style={styles.subValue}>- {money(invoice.discount)}</Text>
          </View>
        )}

        {invoice.notes ? (
          <>
            <Text style={styles.stars}>{STAR_LINE}</Text>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Notes</Text>
              <Text style={styles.metaValue}>{invoice.notes}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.stars}>{STAR_LINE}</Text>
        <Text style={styles.thankYou}>THANK YOU!</Text>
        <Text style={styles.stars}>{STAR_LINE}</Text>

        {/* Barcode */}
        <Image
          src={generateBarcode(invoice.invoiceNumber)}
          style={{ width: 160, height: 50, alignSelf: 'center', marginTop: 6 }}
        />
        <Text style={{ fontSize: 8, textAlign: 'center', color: '#555', marginTop: 3 }}>
          {invoice.invoiceNumber}
        </Text>
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
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' },
      }}
    >
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          <ReceiptDocument invoice={invoice} {...clinic} />
        </PDFViewer>
      </DialogContent>
      <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 1, flexShrink: 0 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={onClose}>
          Print from PDF viewer
        </Button>
      </Box>
    </Dialog>
  );
}
