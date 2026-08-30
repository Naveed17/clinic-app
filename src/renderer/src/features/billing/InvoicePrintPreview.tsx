import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import {
  Dialog,
  DialogContent,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import type { Invoice } from '@/types/invoice';
import { useEffect, useMemo, useRef, useState } from 'react';
// cspell:ignore bwipjs
import bwipjs from 'bwip-js';
import { PdfBlobPreview } from '@/utils/PdfBlobPreview';
import { printInvoiceReceipt } from '@/utils/printInvoiceReceipt';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';
import { DEFAULT_CLINIC_LOGO, useClinicBrandLogo } from '@/utils/clinicBrandLogo';

function generateBarcode(text: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text,
      scale: 2,
      height: 12,
      includetext: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
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

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: POS_RECEIPT.ink,
    paddingTop: POS_PAPER.pdfPaddingTop,
    paddingBottom: POS_PAPER.pdfPaddingBottom,
    paddingLeft: POS_PAPER.pdfPaddingLeft,
    paddingRight: POS_PAPER.pdfPaddingRight,
    fontFamily: POS_PAPER.pdfFontFamily,
  },
  logo: { width: 36, height: 36, alignSelf: 'center', marginBottom: 6 },
  shopName: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 3, color: '#000' },
  shopSub: { fontSize: 9, textAlign: 'center', color: POS_RECEIPT.muted, marginBottom: 2 },
  stars: { fontSize: 9, textAlign: 'center', color: '#000', marginVertical: 6 },
  receiptTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginVertical: 2, color: '#000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  headerLabel: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  itemLabel: { fontSize: 9, flex: 1, color: '#000', fontWeight: 'bold' },
  itemQty: { fontSize: 9, width: 30, textAlign: 'center', color: '#000', fontWeight: 'bold' },
  itemPrice: { fontSize: 9, width: 55, textAlign: 'right', color: '#000', fontWeight: 'bold' },
  totalLabel: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  totalValue: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  subLabel: { fontSize: 9, color: '#000', fontWeight: 'bold' },
  subValue: { fontSize: 9, color: '#000', fontWeight: 'bold' },
  metaLabel: { fontSize: 10, color: '#000', fontWeight: 'bold' },
  metaValue: { fontSize: 9, color: '#000', fontWeight: 'bold' },
  thankYou: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 4, color: '#000' },
  brand: { fontSize: 8, color: '#000', textAlign: 'center', marginTop: 8, fontWeight: 'bold', letterSpacing: 0.5 },
});

const money = (v: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0)}`;

function ReceiptDocument({
  invoice,
  clinicName,
  clinicAddress,
  clinicPhone,
  barcodeSrc,
  logoSrc = DEFAULT_CLINIC_LOGO,
}: {
  invoice: Invoice;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  barcodeSrc: string | null;
  logoSrc?: string;
}) {
  // Doctor fee is included in the invoice total but is not stored as a separate
  // database column. Derive it from the medicines subtotal, discount, and total.
  const doctorFee = Math.max(0, invoice.total + invoice.discount - invoice.subtotal);
  const items = invoice.items ?? [];
  const paid = Number(invoice.amountPaid ?? 0);
  const due = Math.max(0, Number(invoice.total) - paid);

  return (
    <Document>
      <Page size={[POS_PAPER.pdfPageWidth, POS_PAPER.pdfPageHeightInvoice]} style={styles.page} wrap={false}>
        <Image src={logoSrc} style={styles.logo} />
        <Text style={styles.shopName}>{clinicName || POS_RECEIPT.clinicFallback}</Text>
        {clinicAddress ? <Text style={styles.shopSub}>{clinicAddress}</Text> : null}
        {clinicPhone ? <Text style={styles.shopSub}>Tel: {clinicPhone}</Text> : null}

        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>
        <Text style={styles.receiptTitle}>CASH RECEIPT</Text>
        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>

        <View style={styles.row}>
          <Text style={styles.metaLabel}>Invoice #</Text>
          <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Patient</Text>
          <Text style={styles.metaValue}>
            {[invoice.patient.firstName, invoice.patient.lastName].filter(Boolean).join(' ')}
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

        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>

        <View style={styles.row}>
          <Text style={[styles.headerLabel, { flex: 1 }]}>Description</Text>
          <Text style={[styles.headerLabel, { width: 30, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.headerLabel, { width: 55, textAlign: 'right' }]}>Price</Text>
        </View>

        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>

        {items.map((item) => (
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

        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>

        {invoice.discount > 0 && (
          <View style={styles.row}>
            <Text style={styles.subLabel}>Discount</Text>
            <Text style={styles.subValue}>- {money(invoice.discount)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>{money(invoice.total)}</Text>
        </View>
        {paid > 0 && (
          <>
            <View style={styles.row}>
              <Text style={styles.subLabel}>Paid</Text>
              <Text style={styles.subValue}>{money(paid)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subLabel}>Balance</Text>
              <Text style={styles.subValue}>{money(due)}</Text>
            </View>
          </>
        )}

        {invoice.notes ? (
          <>
            <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Notes</Text>
              <Text style={styles.metaValue}>{invoice.notes}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>
        <Text style={styles.thankYou}>{POS_RECEIPT.thankYou}</Text>
        <Text style={styles.stars}>{POS_RECEIPT.starLine}</Text>

        {barcodeSrc ? (
          <Image
            src={barcodeSrc}
            style={{ width: 160, height: 50, alignSelf: 'center', marginTop: 6 }}
          />
        ) : null}
        <Text style={{ fontSize: 9, textAlign: 'center', color: POS_RECEIPT.ink, marginTop: 3, fontWeight: 'bold' }}>
          {invoice.invoiceNumber}
        </Text>
        <Text style={styles.brand}>{POS_RECEIPT.poweredBy}</Text>
      </Page>
    </Document>
  );
}

export function InvoicePrintPreview({
  invoice,
  onClose,
  autoPrint = false,
}: {
  invoice: Invoice;
  onClose: () => void;
  /** After create: open preview and start the system print dialog */
  autoPrint?: boolean;
}): React.JSX.Element {
  const brandLogo = useClinicBrandLogo();
  const [clinic, setClinic] = useState<{
    clinicName: string;
    clinicAddress: string;
    clinicPhone: string;
  } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const autoPrintDone = useRef(false);

  const barcodeSrc = useMemo(
    () => generateBarcode(invoice.invoiceNumber),
    [invoice.invoiceNumber],
  );

  useEffect(() => {
    void window.clinic?.settings.get().then((s) =>
      setClinic({
        clinicName: s.clinicName ?? '',
        clinicAddress: s.clinicAddress ?? '',
        clinicPhone: s.clinicPhone ?? '',
      }),
    );
  }, []);

  const documentKey = [
    invoice.id,
    invoice.invoiceNumber,
    invoice.total,
    clinic?.clinicName ?? '',
    barcodeSrc ? '1' : '0',
    brandLogo,
  ].join('|');

  const pdfDocument = useMemo(() => {
    if (!clinic) return null;
    return (
      <ReceiptDocument
        invoice={invoice}
        barcodeSrc={barcodeSrc}
        logoSrc={brandLogo}
        {...clinic}
      />
    );
  }, [clinic, invoice, barcodeSrc, brandLogo]);

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printInvoiceReceipt(invoice);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    if (!autoPrint || !pdfDocument || autoPrintDone.current) return;
    autoPrintDone.current = true;
    void handlePrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, pdfDocument]);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography fontWeight={700} fontSize={15}>
          Invoice Receipt
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto', bgcolor: '#f1f5f9' }}>
        {pdfDocument ? (
          <PdfBlobPreview documentKey={documentKey} pdfDocument={pdfDocument} height={560} />
        ) : (
          <Box sx={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading...</Typography>
          </Box>
        )}
      </DialogContent>
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {printError && <Alert severity="error">{printError}</Alert>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <Tooltip title="Close">
            <IconButton onClick={onClose} aria-label="Close" size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={printing ? 'Printing...' : 'Print'}>
            <span>
              <IconButton
                color="primary"
                disabled={printing || !pdfDocument}
                onClick={() => void handlePrint()}
                aria-label="Print"
                size="small"
              >
                {printing ? <CircularProgress size={18} /> : <PrintOutlinedIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Dialog>
  );
}
