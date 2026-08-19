import { resolveLabTest, type LabParamDef, type LabTestDef } from './labTestCatalog';

export type LabFlag = 'H' | 'L' | 'A' | 'N' | '';

export interface LabResultRow {
  id: string;
  name: string;
  value: string;
  unit: string;
  rangeLabel: string;
  rangeLow: number | null;
  rangeHigh: number | null;
  qualitativeNormal?: string;
  input: 'number' | 'text';
  flag: LabFlag;
}

export interface LabReportPatient {
  name: string;
  mrNumber?: string | null;
  age?: string | null;
  dob?: string | Date | null;
  phone?: string | null;
  bloodGroup?: string | null;
}

export interface LabReportClinic {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
}

export interface LabReportPayload {
  v: 1;
  testKey: string;
  testName: string;
  specimen: string;
  method?: string;
  rows: LabResultRow[];
  html: string;
  impressionHtml: string;
  reportedAt: string;
}

const PAYLOAD_PREFIX = 'LABREPORT_V1:';
export const IMPRESSION_HEADING = 'Pathologist Impression / Summary';
export const ABNORMAL_BG = '#fee2e2';

export function evaluateFlag(row: Pick<LabResultRow, 'value' | 'rangeLow' | 'rangeHigh' | 'qualitativeNormal'>): LabFlag {
  const raw = row.value.trim();
  if (!raw) return '';

  if (row.rangeLow != null && row.rangeHigh != null) {
    const num = Number.parseFloat(raw.replace(/,/g, ''));
    if (Number.isFinite(num)) {
      if (num < row.rangeLow) return 'L';
      if (num > row.rangeHigh) return 'H';
      return 'N';
    }
  }

  if (row.qualitativeNormal) {
    const expected = row.qualitativeNormal.trim().toLowerCase();
    const got = raw.toLowerCase();
    if (expected && got && got !== expected && !got.includes(expected)) return 'A';
    return 'N';
  }

  return '';
}

export function isAbnormal(flag: LabFlag): boolean {
  return flag === 'H' || flag === 'L' || flag === 'A';
}

export function flagLabel(flag: LabFlag): string {
  if (flag === 'H') return 'High';
  if (flag === 'L') return 'Low';
  if (flag === 'A') return 'Abnormal';
  if (flag === 'N') return 'Normal';
  return '';
}

function uid(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function rowsFromTest(def: LabTestDef, previous?: LabResultRow[]): LabResultRow[] {
  const prevByName = new Map((previous ?? []).map((r) => [r.name.toLowerCase(), r]));
  return def.parameters.map((param) => rowFromParam(param, prevByName.get(param.name.toLowerCase())?.value ?? ''));
}

export function rowFromParam(param: LabParamDef, value = ''): LabResultRow {
  const row: LabResultRow = {
    id: param.id || uid(),
    name: param.name,
    value,
    unit: param.unit,
    rangeLabel: param.rangeLabel,
    rangeLow: param.rangeLow,
    rangeHigh: param.rangeHigh,
    qualitativeNormal: param.qualitativeNormal,
    input: param.input,
    flag: '',
  };
  row.flag = evaluateFlag(row);
  return row;
}

export function customRow(name = 'Custom parameter'): LabResultRow {
  return {
    id: uid(),
    name,
    value: '',
    unit: '',
    rangeLabel: '—',
    rangeLow: null,
    rangeHigh: null,
    input: 'text',
    flag: '',
  };
}

export function withEvaluatedFlags(rows: LabResultRow[]): LabResultRow[] {
  return rows.map((row) => ({ ...row, flag: evaluateFlag(row) }));
}

export function emptyPayload(testName: string): LabReportPayload {
  const def = resolveLabTest(testName);
  return {
    v: 1,
    testKey: def.key,
    testName: def.name,
    specimen: def.specimen,
    method: def.method,
    rows: rowsFromTest(def),
    html: '',
    impressionHtml: '',
    reportedAt: new Date().toISOString(),
  };
}

export function parseLabResult(raw: string | null | undefined): LabReportPayload | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const jsonText = text.startsWith(PAYLOAD_PREFIX) ? text.slice(PAYLOAD_PREFIX.length) : text;
  if (!jsonText.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(jsonText) as Partial<LabReportPayload>;
    if (parsed?.v !== 1 || !Array.isArray(parsed.rows)) return null;
    return {
      v: 1,
      testKey: String(parsed.testKey || 'custom'),
      testName: String(parsed.testName || ''),
      specimen: String(parsed.specimen || ''),
      method: parsed.method,
      rows: withEvaluatedFlags(
        parsed.rows.map((row) => ({
          id: String(row.id || uid()),
          name: String(row.name || ''),
          value: String(row.value ?? ''),
          unit: String(row.unit ?? ''),
          rangeLabel: String(row.rangeLabel ?? '—'),
          rangeLow: typeof row.rangeLow === 'number' ? row.rangeLow : null,
          rangeHigh: typeof row.rangeHigh === 'number' ? row.rangeHigh : null,
          qualitativeNormal: row.qualitativeNormal,
          input: row.input === 'number' ? 'number' : 'text',
          flag: '',
        })),
      ),
      html: String(parsed.html || ''),
      impressionHtml: String(parsed.impressionHtml || ''),
      reportedAt: String(parsed.reportedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function serializeLabResult(payload: LabReportPayload): string {
  return `${PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
}

export function labResultPreview(result: string | null | undefined): string {
  const payload = parseLabResult(result);
  if (!payload) {
    const plain = result?.trim() ?? '';
    if (!plain) return '—';
    return plain.length > 72 ? `${plain.slice(0, 72)}…` : plain;
  }
  const filled = payload.rows.filter((r) => r.value.trim()).length;
  const abnormal = payload.rows.filter((r) => isAbnormal(r.flag)).length;
  if (!filled) return payload.html?.trim() ? 'Draft report' : '—';
  if (abnormal) return `${filled} values · ${abnormal} abnormal`;
  return `${filled} values recorded`;
}

export function extractImpressionHtml(html: string): string {
  if (!html) return '';
  const re = new RegExp(
    `<h3>\\s*${escapeRegExp(IMPRESSION_HEADING)}\\s*</h3>([\\s\\S]*?)(?=<h3\\b|$)`,
    'i',
  );
  const match = html.match(re);
  return (match?.[1] ?? '').trim();
}

export function replaceImpressionSection(html: string, impressionHtml: string): string {
  const block = impressionHtml.trim() || '<p></p>';
  const re = new RegExp(
    `(<h3>\\s*${escapeRegExp(IMPRESSION_HEADING)}\\s*</h3>)([\\s\\S]*?)(?=<h3\\b|$)`,
    'i',
  );
  if (re.test(html)) return html.replace(re, `$1${block}`);
  const heading = `<h3>${IMPRESSION_HEADING}</h3>`;
  if (!html.trim()) return `${heading}${block}`;
  return `${html}${heading}${block}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function htmlToPlainText(html: string): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cell(text: string, opts?: { bold?: boolean; bg?: string }): string {
  const inner = opts?.bold ? `<p><strong>${escapeHtml(text)}</strong></p>` : `<p>${escapeHtml(text)}</p>`;
  const bg = opts?.bg ? ` data-bg="${opts.bg}" style="background-color:${opts.bg}"` : '';
  return `<td${bg}>${inner}</td>`;
}

function headerCell(text: string): string {
  return `<th><p>${escapeHtml(text)}</p></th>`;
}

export function calcAge(dob: Date | string | null | undefined): string {
  if (!dob) return '';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

export function buildReportHtml(opts: {
  clinic: LabReportClinic;
  patient: LabReportPatient;
  orderedBy: string;
  orderedAt: string;
  payload: LabReportPayload;
  impressionHtml?: string;
}): string {
  const { patient, orderedBy, orderedAt, payload } = opts;
  const impression = (opts.impressionHtml ?? payload.impressionHtml ?? '').trim() || '<p></p>';
  const reported = new Date(payload.reportedAt || Date.now()).toLocaleString();
  const ordered = new Date(orderedAt).toLocaleString();

  const bodyRows = payload.rows
    .map((row) => {
      const abnormal = isAbnormal(row.flag);
      const bg = abnormal ? ABNORMAL_BG : undefined;
      const valueText = row.value.trim()
        ? `${row.value}${row.flag && row.flag !== 'N' ? `  ${row.flag}` : ''}`
        : '—';
      return `<tr>${cell(row.name, { bg })}${cell(valueText, { bold: abnormal, bg })}${cell(row.rangeLabel || '—', { bg })}${cell(row.unit || '—', { bg })}${cell(flagLabel(row.flag) || '—', { bold: abnormal, bg })}</tr>`;
    })
    .join('');

  return [
    `<p><strong>Laboratory Report</strong> · ${escapeHtml(payload.testName)}</p>`,
    '<h3>Patient Information</h3>',
    `<p><strong>Name:</strong> ${escapeHtml(patient.name || '—')} &nbsp;&nbsp; <strong>MR#:</strong> ${escapeHtml(patient.mrNumber || '—')} &nbsp;&nbsp; <strong>Age:</strong> ${escapeHtml(patient.age || '—')}</p>`,
    `<p><strong>Blood group:</strong> ${escapeHtml(patient.bloodGroup || '—')} &nbsp;&nbsp; <strong>Phone:</strong> ${escapeHtml(patient.phone || '—')}</p>`,
    `<p><strong>Ordered by:</strong> ${escapeHtml(orderedBy)} &nbsp;&nbsp; <strong>Ordered:</strong> ${escapeHtml(ordered)} &nbsp;&nbsp; <strong>Reported:</strong> ${escapeHtml(reported)}</p>`,
    `<p><strong>Specimen:</strong> ${escapeHtml(payload.specimen || '—')}${payload.method ? ` &nbsp;&nbsp; <strong>Method:</strong> ${escapeHtml(payload.method)}` : ''}</p>`,
    `<h3>${escapeHtml(payload.testName)} — Results</h3>`,
    '<table>',
    `<tr>${headerCell('Test Parameter')}${headerCell('Current Value')}${headerCell('Normal Range')}${headerCell('Unit')}${headerCell('Flag')}</tr>`,
    bodyRows,
    '</table>',
    `<h3>${IMPRESSION_HEADING}</h3>`,
    impression,
    '<h3>Authorization</h3>',
    '<p>Verified by Pathologist / Lab In-charge</p>',
    '<p>Signature: ______________________ &nbsp;&nbsp; Date: ________________</p>',
    '<p><em>This report is intended for the requesting clinician. Correlate with clinical findings. Reference ranges are typical adult values and may vary by method, age, and sex.</em></p>',
  ]
    .filter(Boolean)
    .join('');
}

export function rowsForAi(rows: LabResultRow[]): Array<{
  name: string;
  value: string;
  unit: string;
  range: string;
  flag: string;
}> {
  return rows
    .filter((r) => r.value.trim())
    .map((r) => ({
      name: r.name,
      value: r.value.trim(),
      unit: r.unit,
      range: r.rangeLabel,
      flag: flagLabel(r.flag) || 'Not flagged',
    }));
}
