import { Document, Page, Text, View, StyleSheet, PDFViewer, Svg, Rect, Path, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

/** Sample palette — soft medical blue */
export const PAD_BLUE = '#2B5F8A';
export const PAD_BLUE_SOFT = '#A8C8E0';
export const PAD_BLUE_WASH = '#D6E8F5';
export const PAD_INK = '#1E3A5F';
export const PAD_MUTED = '#7A8FA3';
export const PAD_LINE = '#B0C4D4';
export const PAD_FOOTER_TEXT = '#5A6570';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: PAD_INK,
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingTop: 36,
    paddingHorizontal: 40,
    paddingBottom: 70,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  doctorName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginBottom: 4,
  },
  qualification: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  certification: {
    fontSize: 8,
    color: PAD_MUTED,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginRight: 6,
  },
  fieldLine: {
    flex: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: PAD_LINE,
    paddingBottom: 2,
    fontSize: 10,
    color: PAD_INK,
    minHeight: 14,
  },
  halfField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  body: {
    flex: 1,
    marginTop: 18,
    position: 'relative',
    minHeight: 340,
  },
  rx: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 11,
    color: PAD_INK,
    lineHeight: 1.65,
    paddingLeft: 4,
  },
  watermarkWrap: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.1,
  },
  signatureBlock: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    width: 160,
    marginTop: 24,
    marginBottom: 16,
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 0.8,
    borderBottomColor: PAD_LINE,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    letterSpacing: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  footerBrand: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: PAD_FOOTER_TEXT,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '34%',
  },
  footerText: {
    fontSize: 8.5,
    color: PAD_FOOTER_TEXT,
    marginLeft: 5,
  },
});

/** Filled rounded medical plus */
export function PlusMedPdf({ size = 56, color = PAD_BLUE, opacity = 1 }: { size?: number; color?: string; opacity?: number }): React.JSX.Element {
  const bar = size * 0.22;
  const len = size * 0.72;
  const r = bar / 2;
  const mid = (size - bar) / 2;
  const midL = (size - len) / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }}>
      <Rect x={mid} y={midL} width={bar} height={len} rx={r} ry={r} fill={color} />
      <Rect x={midL} y={mid} width={len} height={bar} rx={r} ry={r} fill={color} />
    </Svg>
  );
}

function LocationIconPdf({ size = 11, color = PAD_FOOTER_TEXT }: { size?: number; color?: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        fill={color}
      />
    </Svg>
  );
}

function PhoneIconPdf({ size = 11, color = PAD_FOOTER_TEXT }: { size?: number; color?: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
        fill={color}
      />
    </Svg>
  );
}

function FooterGradientLine(): React.JSX.Element {
  return (
    <Svg width={515} height={2} viewBox="0 0 515 2" style={{ marginBottom: 12 }}>
      <Defs>
        <LinearGradient id="footerGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5EC8D8" />
          <Stop offset="0.55" stopColor="#3A6A8C" />
          <Stop offset="1" stopColor="#1A2332" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="515" height="2" fill="url(#footerGrad)" />
    </Svg>
  );
}

export interface PrescriptionPadClinic {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
}

export interface PrescriptionPadPdfProps {
  clinic: PrescriptionPadClinic;
  doctorName: string;
  qualification?: string;
  certification?: string;
  patientName: string;
  patientAddress?: string;
  patientAge: string;
  patientSex?: string;
  dateStr: string;
  diagnosis?: string;
  bodyText: string;
}

export function stripAdviceHtml(text: string): string {
  if (!text) return '';
  if (!/<[a-z][\s\S]*>/i.test(text)) return text.trim();
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parsePadMeta(advice: string): {
  sex: string;
  age: string;
  dob: string;
  address: string;
  diagnosis: string;
  body: string;
} {
  const m = advice.match(
    /^\[Pad\|sex:([^|]*)\|age:([^|]*)\|dob:([^|]*)\|addr:([^|]*)\|dx:([^\]]*)\]\s*/i,
  );
  if (m) {
    return {
      sex: m[1] || '',
      age: m[2] || '',
      dob: m[3] || '',
      address: m[4] || '',
      diagnosis: m[5] || '',
      body: stripAdviceHtml(advice.slice(m[0].length)),
    };
  }
  // legacy meta
  const legacy = advice.match(/^\[Pad\|sex:([^|]*)\|age:([^|]*)\|dob:([^\]]*)\]\s*/i);
  if (legacy) {
    return {
      sex: legacy[1] || '',
      age: legacy[2] || '',
      dob: legacy[3] || '',
      address: '',
      diagnosis: '',
      body: stripAdviceHtml(advice.slice(legacy[0].length)),
    };
  }
  return { sex: '', age: '', dob: '', address: '', diagnosis: '', body: stripAdviceHtml(advice) };
}

function FieldLine({ label, value, width }: { label: string; value: string; width?: string | number }): React.JSX.Element {
  return (
    <View style={[styles.fieldRow, width ? { width } : { width: '100%' }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldLine}>{value || ' '}</Text>
    </View>
  );
}

export function PrescriptionPadDocument({
  clinic,
  doctorName,
  qualification = 'CONSULTING PHYSICIAN',
  certification,
  patientName,
  patientAddress = '',
  patientAge,
  dateStr,
  diagnosis = '',
  bodyText,
}: PrescriptionPadPdfProps): React.JSX.Element {
  const brand = clinic.clinicName?.trim() || 'HOSPITAL';
  const cleanBody = stripAdviceHtml(bodyText);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.doctorName}>{doctorName}</Text>
              <Text style={styles.qualification}>{qualification}</Text>
              {certification ? <Text style={styles.certification}>{certification}</Text> : null}
            </View>
            <PlusMedPdf size={52} />
          </View>

          <FieldLine label="Patient Name:" value={patientName} />
          <FieldLine label="Address:" value={patientAddress} />

          <View style={[styles.fieldRow, { gap: 24 }]}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Age:</Text>
              <Text style={styles.fieldLine}>{patientAge || ' '}</Text>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Date:</Text>
              <Text style={styles.fieldLine}>{dateStr || ' '}</Text>
            </View>
          </View>

          <FieldLine label="Diagnosis:" value={diagnosis} />

          <View style={styles.body}>
            <View style={styles.watermarkWrap}>
              <PlusMedPdf size={180} color={PAD_BLUE_SOFT} />
            </View>
            <Text style={styles.rx}>Rx</Text>
            <Text style={styles.bodyText}>{cleanBody || ' '}</Text>
          </View>

          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>SIGNATURE</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={{ position: 'absolute', top: 0, left: 40, right: 40 }}>
            <FooterGradientLine />
          </View>
          <Text style={styles.footerBrand}>{brand}</Text>
          {clinic.clinicAddress ? (
            <View style={styles.footerItem}>
              <LocationIconPdf size={11} />
              <Text style={styles.footerText}>{clinic.clinicAddress}</Text>
            </View>
          ) : (
            <View style={styles.footerItem} />
          )}
          {clinic.clinicPhone ? (
            <View style={styles.footerItem}>
              <PhoneIconPdf size={11} />
              <Text style={styles.footerText}>{clinic.clinicPhone}</Text>
            </View>
          ) : (
            <View style={styles.footerItem} />
          )}
        </View>
      </Page>
    </Document>
  );
}

export function PrescriptionPadPdfPreview({
  onClose,
  ...docProps
}: PrescriptionPadPdfProps & { onClose: () => void }): React.JSX.Element {
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1, overflow: 'hidden' } }}>
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography fontWeight={700} fontSize={15}>
          Prescription PDF
        </Typography>
        <Button onClick={onClose} size="small" startIcon={<CloseOutlinedIcon />}>
          Close
        </Button>
      </Box>
      <DialogContent sx={{ p: 0, height: 750 }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          <PrescriptionPadDocument {...docProps} />
        </PDFViewer>
      </DialogContent>
    </Dialog>
  );
}
