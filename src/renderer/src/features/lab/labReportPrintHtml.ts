import type { LabOrder } from '@/types/lab';
import {
  calcAge,
  extractImpressionHtml,
  htmlToPlainText,
  isAbnormal,
  parseLabResult,
  type LabFlag,
  type LabReportClinic,
  type LabReportPayload,
  type LabResultRow,
} from './labReportPayload';
import { labReportNumber } from './labReportNumber';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtStamp(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const day = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${time}  ${day}`;
}

function reportCode(order: LabOrder): string {
  return labReportNumber(order.id);
}

function statusClass(flag: LabFlag): string {
  if (flag === 'N') return 'ok';
  if (flag === 'H' || flag === 'L' || flag === 'A') return 'bad';
  return '';
}

const NLA_ROWS = [
  ['Optimal', '< 200', '≥ 60', '< 100', '< 150'],
  ['Above Optimal', '—', '—', '100 – 129', '—'],
  ['Borderline High', '200 – 239', '—', '130 – 159', '150 – 199'],
  ['High', '≥ 240', '< 40', '160 – 189', '200 – 499'],
  ['Very High', '—', '—', '≥ 190', '≥ 500'],
];

function isLipidTest(name: string): boolean {
  const t = name.toLowerCase();
  return t.includes('lipid') || t.includes('cholesterol') || t.includes('ldl') || t.includes('hdl');
}

function isGlucoseTest(name: string): boolean {
  const t = name.toLowerCase();
  return t.includes('sugar') || t.includes('glucose') || t.includes('fbs') || t.includes('rbs') || t.includes('hba1c');
}

function defaultComment(testName: string): string {
  if (isLipidTest(testName)) {
    return 'LDL cholesterol is a major carrier of cholesterol in plasma and a primary target in cardiovascular risk assessment. Values should be interpreted with HDL, triglycerides and clinical context.';
  }
  if (isGlucoseTest(testName)) {
    return 'Fasting / random blood glucose is used to screen for and monitor diabetes mellitus. Adult fasting values of 70–100 mg/dL are typically considered normal. Correlate with symptoms, HbA1c and clinical findings.';
  }
  return 'Results should be interpreted in conjunction with clinical history, examination and other laboratory data. Repeat testing is advised if values are unexpected.';
}

function guidelinesBlock(testName: string): string {
  if (isLipidTest(testName)) {
    const rows = NLA_ROWS.map(
      (r) =>
        `<tr><th>${escapeHtml(r[0])}</th><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
    ).join('');
    return `
      <div class="guide">
        <div class="guide-title">NLA — 2014 RECOMMENDATIONS</div>
        <table class="guide-table">
          <thead>
            <tr>
              <th></th>
              <th>Total Cholesterol<br/>(mg/dL)</th>
              <th>HDL Cholesterol<br/>(mg/dL)</th>
              <th>LDL Cholesterol<br/>(mg/dL)</th>
              <th>Triglycerides<br/>(mg/dL)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  if (isGlucoseTest(testName)) {
    return `
      <div class="guide">
        <div class="guide-title">ADA — FASTING PLASMA GLUCOSE</div>
        <table class="guide-table">
          <thead>
            <tr><th>Category</th><th>Fasting (mg/dL)</th><th>Random (mg/dL)</th><th>HbA1c (%)</th></tr>
          </thead>
          <tbody>
            <tr><th>Normal</th><td>70 – 99</td><td>&lt; 140</td><td>&lt; 5.7</td></tr>
            <tr><th>Prediabetes</th><td>100 – 125</td><td>140 – 199</td><td>5.7 – 6.4</td></tr>
            <tr><th>Diabetes</th><td>≥ 126</td><td>≥ 200</td><td>≥ 6.5</td></tr>
          </tbody>
        </table>
      </div>`;
  }
  return '';
}

function resultRows(rows: LabResultRow[]): string {
  return rows
    .map((row) => {
      const cls = statusClass(row.flag);
      return `<tr>
        <td class="inv">${escapeHtml(row.name)}</td>
        <td class="res">
          <span class="val ${cls}">${escapeHtml(row.value.trim() || '—')}</span>
        </td>
        <td class="num">${escapeHtml(row.rangeLabel || '—')}</td>
        <td class="unit">${escapeHtml(row.unit || '—')}</td>
      </tr>`;
    })
    .join('');
}

function formatRefDoctorName(rawName?: string | null): string {
  if (!rawName || rawName === '—') return '—';
  const name = rawName.trim();
  if (/^(lab test|test lab)$/i.test(name)) return '—';
  return /^(dr\.|dr\b)/i.test(name) ? name : `Dr. ${name}`;
}

export function buildLabReportHtml(opts: {
  order: LabOrder;
  clinic: LabReportClinic;
  logoSrc?: string;
  barcodeSrc?: string | null;
  qrSrc?: string | null;
}): string {
  const { order, clinic, logoSrc = '', barcodeSrc, qrSrc } = opts;
  const payload: LabReportPayload | null = parseLabResult(order.result);
  const testName = payload?.testName || order.test;
  const rawImpression = payload
    ? htmlToPlainText(payload.impressionHtml || extractImpressionHtml(payload.html))
    : htmlToPlainText(order.result || '');
  const placeholder = /type (pathologist )?notes|use ai assistant/i.test(rawImpression);
  const comment = !rawImpression || placeholder ? defaultComment(testName) : rawImpression;
  const age = calcAge(order.patientDob);
  const reportedAt = payload?.reportedAt || order.updatedAt || order.orderedAt;
  const brand = (clinic.clinicName || 'CLINIC').trim().toUpperCase();
  const phone = (clinic.clinicPhone || '').trim();
  const code = reportCode(order);
  const specimen = payload?.specimen || '—';
  const method = payload?.method || '';
  const site = clinic.clinicAddress?.trim() || brand;

  const logo = logoSrc
    ? `<img class="logo-img" src="${logoSrc}" alt="" />`
    : `<div class="logo-fallback">+</div>`;

  const qr = qrSrc ? `<img class="qr" src="${qrSrc}" alt="QR" />` : `<div class="qr qr-ph"></div>`;
  const barcode = barcodeSrc
    ? `<img class="barcode" src="${barcodeSrc}" alt="Barcode" />`
    : `<div class="barcode barcode-ph"></div>`;

  const tableBody = payload
    ? resultRows(payload.rows)
    : `<tr><td class="inv">${escapeHtml(order.test)}</td><td class="res"><span class="val">${escapeHtml(order.result || 'Pending')}</span></td><td>—</td><td class="unit">—</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(brand)} — Laboratory Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Roboto+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #1a1a1a;
    font-family: 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  }
  .sheet {
    width: 186mm;
    min-height: 273mm;
    margin: 0 auto;
    padding: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .content { position: relative; z-index: 1; display: flex; flex-direction: column; flex: 1; }

  .brand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #222;
  }
  .brand-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo-img, .logo-fallback {
    width: 58px; height: 58px;
    object-fit: contain; background: transparent; flex-shrink: 0;
  }
  .logo-fallback {
    color: #15803d; font-size: 28px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .lab-name {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #0d47a1;
    letter-spacing: 0.4px;
    line-height: 1.1;
  }
  .slogan {
    margin: 3px 0 0;
    font-size: 9.5px;
    font-style: italic;
    color: #374151;
    letter-spacing: 0.3px;
  }
  .contacts { text-align: right; font-size: 10px; line-height: 1.55; color: #111; }
  .contacts .ico { display: inline-block; width: 12px; text-align: center; margin-right: 4px; color: #2e7d32; font-weight: 800; }

  .patient {
    margin-top: 12px;
    margin-bottom: 20px;
    background: transparent;
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 48px;
    min-height: 92px;
  }
  .pcol { padding: 4px 0; }
  .pname { font-size: 15px; font-weight: 800; margin: 0 0 6px; color: #111; }
  .prow { display: flex; font-size: 10px; margin: 2px 0; }
  .pl { width: 78px; color: #4b5563; }
  .pv { font-weight: 700; color: #111; flex: 1; }
  .left-grid { display: grid; grid-template-columns: 1fr 62px; gap: 8px; align-items: start; }
  .qr { width: 62px; height: 62px; object-fit: contain; background: #fff; border: 1px solid #e5e7eb; }
  .qr-ph { background: repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0 / 8px 8px; }
  .mid-title { font-size: 9px; color: #4b5563; margin-bottom: 2px; }
  .mid-val { font-size: 10.5px; font-weight: 700; margin-bottom: 8px; line-height: 1.35; }
  .pcol.right { display: flex; justify-content: flex-end; }
  .right-box { width: 215px; }
  .barcode { width: 100%; height: 34px; object-fit: fill; display: block; margin-bottom: 6px; }
  .barcode-ph { background: repeating-linear-gradient(90deg, #111 0 1px, #fff 1px 3px); }
  .right .prow .pl { width: 80px; font-size: 9px; }
  .right .pv { font-size: 9.5px; text-align: right; }

  .test-title {
    text-align: center;
    font-size: 15px;
    font-weight: 800;
    text-decoration: underline;
    margin: 14px 0 8px;
  }
  .inv-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .inv-table thead th {
    text-align: left;
    border-top: 1.5px solid #111;
    border-bottom: 1.5px solid #111;
    padding: 5px 6px;
    font-size: 10px;
    font-weight: 800;
  }
  .inv-table td {
    padding: 7px 6px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  .inv-table .inv { font-weight: 700; width: 34%; }
  .inv-table .unit { text-align: right; width: 14%; }
  .meta { display: flex; justify-content: space-between; font-size: 9.5px; color: #4b5563; padding: 4px 6px 8px; }
  .res { white-space: nowrap; }
  .val, .num, .guide-table td {
    font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-variant-numeric: tabular-nums;
  }
  .val { font-size: 13px; font-weight: 700; }
  .val.ok { color: #1b8a3a; }
  .val.bad { color: #c62828; }

  .comment { margin-top: 12px; }
  .comment h3 { font-size: 11px; margin: 0 0 4px; }
  .comment p { font-size: 10px; line-height: 1.45; margin: 0; color: #1f2937; }

  .guide { margin-top: 12px; }
  .guide-title { font-size: 10.5px; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; }
  .guide-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .guide-table th, .guide-table td {
    border: 1px solid #cfd8dc;
    padding: 5px 6px;
    text-align: center;
  }
  .guide-table thead th { background: #eef3f8; font-weight: 800; }
  .guide-table tbody th { text-align: left; background: #f8fafc; width: 22%; }

  .notes { margin-top: 10px; font-size: 8.5px; color: #4b5563; line-height: 1.45; }

  @media screen {
    body { background: #e8eaed; padding: 16px 0 24px; }
    .sheet {
      background: #fff;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
      padding: 12mm;
      width: 210mm;
      min-height: 297mm;
    }
  }
  @media print {
    html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
    .sheet {
      width: auto !important;
      max-width: none !important;
      min-height: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .brand, .patient, .comment, .guide, .inv-table tr { break-inside: avoid; page-break-inside: avoid; }
    .inv-table thead { display: table-header-group; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="content">
      <div class="brand">
        <div class="brand-left">
          ${logo}
          <div>
            <h1 class="lab-name">${escapeHtml(brand)}</h1>
            <p class="slogan">Accurate | Caring | Instant</p>
          </div>
        </div>
        <div class="contacts">
          ${phone ? `<div><span class="ico">☎</span>${escapeHtml(phone)}</div>` : ''}
          <div><span class="ico">✉</span>Report ${escapeHtml(code)}</div>
        </div>
      </div>

      <div class="patient">
        <div class="pcol">
          <div class="left-grid">
            <div>
              <div class="pname">${escapeHtml(order.patientName)}</div>
              <div class="prow"><span class="pl">Age :</span><span class="pv">${age ? `${escapeHtml(age)} Years` : '—'}</span></div>
              <div class="prow"><span class="pl">Blood Gp :</span><span class="pv">${escapeHtml(order.patientBloodGroup || '—')}</span></div>
              <div class="prow"><span class="pl">UHID :</span><span class="pv">${escapeHtml(order.patientMrNumber || '—')}</span></div>
              <div class="prow"><span class="pl">Ref. By :</span><span class="pv">${escapeHtml(formatRefDoctorName(order.orderedByName))}</span></div>
            </div>
            ${qr}
          </div>
        </div>
        <div class="pcol right">
          <div class="right-box">
            ${barcode}
            <div class="prow"><span class="pl">Registered on:</span><span class="pv">${escapeHtml(fmtStamp(order.orderedAt))}</span></div>
            <div class="prow"><span class="pl">Collected on:</span><span class="pv">${escapeHtml(fmtStamp(order.orderedAt))}</span></div>
            <div class="prow"><span class="pl">Reported on:</span><span class="pv">${escapeHtml(fmtStamp(reportedAt))}</span></div>
          </div>
        </div>
      </div>

      <div class="test-title">${escapeHtml(testName)}</div>
      <div class="meta">
        <span>Sample Type : ${escapeHtml(specimen)}</span>
        <span>${method ? `Method : ${escapeHtml(method)}` : 'TAT : Same day'}</span>
      </div>
      <table class="inv-table">
        <thead>
          <tr>
            <th>Investigation</th>
            <th>Result</th>
            <th>Reference Value</th>
            <th style="text-align:right">Unit</th>
          </tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>

      <div class="comment">
        <h3>Comment:</h3>
        <p>${escapeHtml(comment)}</p>
      </div>

      ${guidelinesBlock(testName)}

      <div class="notes">
        <strong>Note:</strong><br/>
        1. Reference intervals are typical adult values and may vary with age, sex and assay method.<br/>
        2. This report is intended for the requesting clinician. Kindly discuss unexpected results with the laboratory.
      </div>
    </div>
  </div>
</body>
</html>`;
}
