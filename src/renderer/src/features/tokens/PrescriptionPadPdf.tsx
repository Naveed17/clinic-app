import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Image,
} from '@react-pdf/renderer';
import { useMemo, useState } from 'react';
import { DEFAULT_CLINIC_LOGO } from '@/utils/clinicBrandLogo';
import { printReactPdfDocument } from '@/utils/printPdf';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';

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
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
    paddingRight: 16,
    maxWidth: 400,
  },
  doctorName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginBottom: 4,
  },
  qualification: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginBottom: 2,
  },
  specialization: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    lineHeight: 1.35,
    marginBottom: 3,
  },
  certification: {
    fontSize: 8,
    color: PAD_MUTED,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 9,
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
    minHeight: 13,
  },
  halfField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  body: {
    flex: 1,
    marginTop: 14,
    position: 'relative',
    minHeight: 280,
  },
  rx: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: PAD_BLUE,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 10,
    color: PAD_INK,
    lineHeight: 1.5,
    paddingLeft: 4,
  },
  bodyBlock: {
    fontSize: 10,
    color: PAD_INK,
    lineHeight: 1.5,
    marginBottom: 5,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    paddingLeft: 4,
  },
  listMarker: {
    fontSize: 10,
    color: PAD_INK,
    lineHeight: 1.5,
    width: 16,
  },
  listContent: {
    flex: 1,
    fontSize: 10,
    color: PAD_INK,
    lineHeight: 1.5,
  },
  watermarkWrap: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.09,
  },
  headerLogo: {
    width: 52,
    height: 52,
    objectFit: 'contain',
  },
  watermarkLogo: {
    width: 160,
    height: 160,
    objectFit: 'contain',
  },
  signatureBlock: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    width: 150,
    marginTop: 18,
    marginBottom: 10,
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
    letterSpacing: 1.2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  footerBrand: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: PAD_FOOTER_TEXT,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '34%',
  },
  footerText: {
    fontSize: 8,
    color: PAD_FOOTER_TEXT,
    marginLeft: 5,
  },
});

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
    <Svg width={515} height={2} viewBox="0 0 515 2" style={{ marginBottom: 10 }}>
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

export type DoctorPadLines = {
  qualification: string;
  specialization: string;
};

/** Separate lines from the doctor profile — never a static title, never one jammed line. */
export function doctorPadLines(profile?: {
  qualification?: string | null;
  specialization?: string | null;
} | null): DoctorPadLines {
  const qualification = profile?.qualification?.trim() || '';
  const specialization = profile?.specialization?.trim() || '';
  if (qualification && specialization && qualification.toLowerCase() === specialization.toLowerCase()) {
    return { qualification: '', specialization };
  }
  return { qualification, specialization };
}

export interface PrescriptionPadPdfProps {
  clinic: PrescriptionPadClinic;
  doctorName: string;
  qualification?: string;
  specialization?: string;
  certification?: string;
  patientName: string;
  patientAddress?: string;
  patientAge: string;
  patientSex?: string;
  dateStr: string;
  diagnosis?: string;
  bodyText: string;
  logoSrc?: string;
}

export type PadInline = { text: string; bold?: boolean };
export type PadBlock =
  | { type: 'p'; inlines: PadInline[] }
  | { type: 'li'; marker: string; inlines: PadInline[] };

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function walkInlines(node: Node): PadInline[] {
  const result: PadInline[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = decodeHtmlEntities(child.textContent ?? '');
      if (t) result.push({ text: t });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      result.push({ text: '\n' });
      return;
    }
    if (tag === 'strong' || tag === 'b') {
      walkInlines(el).forEach((inline) => result.push({ ...inline, bold: true }));
      return;
    }
    result.push(...walkInlines(el));
  });
  return result;
}

function directListItems(listEl: Element): Element[] {
  return Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === 'li');
}

/** Parse pad HTML into PDF-friendly blocks (paragraphs + list items). */
export function htmlToPadBlocks(html: string): PadBlock[] {
  if (!html?.trim()) return [];
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html
      .split(/\n/)
      .map((line) => line.replace(/\u00a0/g, ' '))
      .filter((line) => line.trim().length > 0)
      .map((line) => ({ type: 'p' as const, inlines: [{ text: line }] }));
  }

  const doc = new DOMParser().parseFromString(`<div id="pad-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('pad-root');
  if (!root) return [];

  const blocks: PadBlock[] = [];

  function pushParagraph(el: Element): void {
    const inlines = walkInlines(el);
    if (inlines.some((i) => i.text.trim())) blocks.push({ type: 'p', inlines });
  }

  function processChildren(parent: Element): void {
    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = decodeHtmlEntities(child.textContent ?? '').trim();
        if (t) blocks.push({ type: 'p', inlines: [{ text: t }] });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'p') {
        pushParagraph(el);
        return;
      }
      if (tag === 'ul') {
        directListItems(el).forEach((li) => {
          blocks.push({ type: 'li', marker: '•', inlines: walkInlines(li) });
        });
        return;
      }
      if (tag === 'ol') {
        directListItems(el).forEach((li, i) => {
          blocks.push({ type: 'li', marker: `${i + 1}.`, inlines: walkInlines(li) });
        });
        return;
      }
      if (tag === 'li') {
        blocks.push({ type: 'li', marker: '•', inlines: walkInlines(el) });
        return;
      }
      if (tag === 'br') {
        blocks.push({ type: 'p', inlines: [{ text: ' ' }] });
        return;
      }
      if (['div', 'blockquote', 'section'].includes(tag)) {
        processChildren(el);
        return;
      }
      pushParagraph(el);
    });
  }

  processChildren(root);
  return blocks;
}

function renderInlines(inlines: PadInline[]): React.JSX.Element[] {
  return inlines.map((inline, j) => (
    <Text key={j} style={inline.bold ? { fontFamily: 'Helvetica-Bold' } : undefined}>
      {inline.text}
    </Text>
  ));
}

function PadBodyContent({ html }: { html: string }): React.JSX.Element {
  const blocks = htmlToPadBlocks(html);
  if (!blocks.length) return <Text style={styles.bodyText}> </Text>;

  return (
    <View>
      {blocks.map((block, i) => {
        if (block.type === 'li') {
          return (
            <View key={i} style={styles.listRow} wrap={false}>
              <Text style={styles.listMarker}>{block.marker}</Text>
              <Text style={styles.listContent}>{renderInlines(block.inlines)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.bodyBlock}>
            {renderInlines(block.inlines)}
          </Text>
        );
      })}
    </View>
  );
}

/** Flatten HTML to plain text while keeping bullet/number markers. */
export function stripAdviceHtml(text: string): string {
  if (!text) return '';
  if (!/<[a-z][\s\S]*>/i.test(text)) return text.replace(/\u00a0/g, ' ').trim();
  return htmlToPadBlocks(text)
    .map((block) => {
      const line = block.inlines.map((i) => i.text).join('').replace(/\s+/g, ' ').trim();
      if (!line) return '';
      return block.type === 'li' ? `${block.marker} ${line}` : line;
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** List/preview: strip pad meta + HTML so advice shows as readable text. */
export function formatAdvicePreview(advice: string): string {
  if (!advice?.trim()) return '';
  const { body } = parsePadMeta(advice);
  return stripAdviceHtml(body);
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
      body: advice.slice(m[0].length).trim(),
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
      body: advice.slice(legacy[0].length).trim(),
    };
  }
  return { sex: '', age: '', dob: '', address: '', diagnosis: '', body: advice.trim() };
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
  qualification = '',
  specialization = '',
  certification,
  patientName,
  patientAddress = '',
  patientAge,
  dateStr,
  diagnosis = '',
  bodyText,
  logoSrc = DEFAULT_CLINIC_LOGO,
}: PrescriptionPadPdfProps): React.JSX.Element {
  const brand = clinic.clinicName?.trim() || 'HOSPITAL';

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.doctorName}>{doctorName}</Text>
              {qualification ? <Text style={styles.qualification}>{qualification}</Text> : null}
              {specialization ? <Text style={styles.specialization}>{specialization}</Text> : null}
              {certification ? <Text style={styles.certification}>{certification}</Text> : null}
            </View>
            <Image src={logoSrc} style={styles.headerLogo} />
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
              <Image src={logoSrc} style={styles.watermarkLogo} />
            </View>
            <Text style={styles.rx}>Rx</Text>
            <PadBodyContent html={bodyText || ''} />
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
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const documentKey = [
    docProps.patientName,
    docProps.dateStr,
    docProps.bodyText,
    docProps.patientAge,
    docProps.patientSex,
    docProps.patientAddress,
    docProps.diagnosis,
    docProps.clinic.clinicName,
    docProps.doctorName,
    docProps.qualification,
    docProps.specialization,
    docProps.logoSrc ?? '',
  ].join('|');

  const pdfDocument = useMemo(
    () => <PrescriptionPadDocument {...docProps} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentKey],
  );

  async function handlePrint(): Promise<void> {
    setPrinting(true);
    setPrintError(null);
    try {
      await printReactPdfDocument(pdfDocument, { paper: 'A4' });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PdfPreviewDialog
      title="Prescription PDF"
      onClose={onClose}
      documentKey={documentKey}
      pdfDocument={pdfDocument}
      printing={printing}
      printError={printError}
      onPrint={() => void handlePrint()}
    />
  );
}
