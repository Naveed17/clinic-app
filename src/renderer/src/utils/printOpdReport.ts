import type { OpdDailyReport } from '@/types/report';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function money(v: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0)}`;
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

function rowsHtml<T>(
  rows: T[],
  empty: string,
  colSpan: number,
  render: (row: T) => string,
): string {
  if (!rows.length) {
    return `<tr><td colspan="${colSpan}" class="empty">${escapeHtml(empty)}</td></tr>`;
  }
  return rows.map(render).join('');
}

export function buildOpdReportHtml(
  report: OpdDailyReport,
  clinic: { clinicName?: string | null; clinicAddress?: string | null; clinicPhone?: string | null },
  logoSrc = '',
): string {
  const clinicName = (clinic.clinicName || 'Clinic').trim();
  const brand = escapeHtml(clinicName.toUpperCase());
  const doctorLabel = report.doctorName ? escapeHtml(report.doctorName) : 'All doctors';
  const dateLabel = escapeHtml(formatDateLabel(report.date));
  const phone = clinic.clinicPhone?.trim() || '';
  const address = clinic.clinicAddress?.trim() || '';
  const logo = logoSrc
    ? `<img class="logo-img" src="${logoSrc}" alt="" />`
    : `<div class="logo-fallback">+</div>`;

  const invoiceBody = rowsHtml(report.invoices.rows, 'No invoices for this day.', 8, (row) => `
    <tr>
      <td class="code">${escapeHtml(row.invoiceNumber)}</td>
      <td>${escapeHtml(row.patientName)}</td>
      <td>${escapeHtml(row.doctors)}</td>
      <td>${escapeHtml(statusLabel(row.status))}</td>
      <td class="num">${escapeHtml(money(row.total))}</td>
      <td class="num">${escapeHtml(money(row.amountPaid))}</td>
      <td class="num">${escapeHtml(money(row.refunded))}</td>
      <td class="num">${escapeHtml(money(row.outstanding))}</td>
    </tr>
  `);

  const feeBody = rowsHtml(report.fees.rows, 'No doctor fees for this day.', 7, (row) => `
    <tr>
      <td class="code">${escapeHtml(String(row.tokenNumber).padStart(3, '0'))}</td>
      <td>${escapeHtml(row.patientName)}</td>
      <td>${escapeHtml(row.doctorName)}</td>
      <td>${escapeHtml(statusLabel(row.status))}</td>
      <td class="num">${escapeHtml(money(row.consultationFee))}</td>
      <td class="num">${escapeHtml(money(row.feeRefunded))}</td>
      <td class="num">${escapeHtml(money(row.net))}</td>
    </tr>
  `);

  const byDoctorBody = rowsHtml(report.fees.byDoctor, 'No doctor fees for this day.', 5, (row) => `
    <tr>
      <td>${escapeHtml(row.doctorName)}</td>
      <td class="num">${row.tokens}</td>
      <td class="num">${escapeHtml(money(row.collected))}</td>
      <td class="num">${escapeHtml(money(row.refunded))}</td>
      <td class="num">${escapeHtml(money(row.net))}</td>
    </tr>
  `);

  const invoiceKpis = [
    ['Bills', String(report.invoices.count)],
    ['Billed', money(report.invoices.billed)],
    ['Collected', money(report.invoices.collected)],
    ['Refunded', money(report.invoices.refunded)],
    ['Outstanding', money(report.invoices.outstanding)],
  ];
  const feeKpis = [
    ['Tokens', String(report.fees.count)],
    ['Collected', money(report.fees.collected)],
    ['Refunded', money(report.fees.refunded)],
    ['Net', money(report.fees.net)],
  ];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>OPD Report ${escapeHtml(report.date)}</title>
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
    overflow-x: hidden;
  }
  .sheet {
    width: 186mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
    overflow: hidden;
  }
  .brand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #222;
  }
  .brand-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo-img, .logo-fallback {
    width: 52px; height: 52px;
    object-fit: contain; flex-shrink: 0;
  }
  .logo-fallback {
    color: #15803d; font-size: 26px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .lab-name {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: #0d47a1;
    letter-spacing: 0.4px;
    line-height: 1.15;
  }
  .slogan {
    margin: 3px 0 0;
    font-size: 9.5px;
    font-style: italic;
    color: #374151;
  }
  .contacts { text-align: right; font-size: 10px; line-height: 1.5; color: #111; }
  .contacts .ico { display: inline-block; width: 12px; text-align: center; margin-right: 4px; color: #2e7d32; font-weight: 800; }

  .meta-bar {
    margin-top: 10px;
    border: 1px solid #c5cdd4;
    background: #f7f9fb;
    display: grid;
    grid-template-columns: 1.1fr 1fr 0.9fr;
  }
  .mcol { padding: 8px 12px; }
  .mcol + .mcol { border-left: 1px solid #dbe3ea; }
  .mlbl { font-size: 9px; color: #4b5563; margin-bottom: 2px; }
  .mval { font-size: 12px; font-weight: 800; color: #111; }

  .test-title {
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    text-decoration: underline;
    margin: 14px 0 8px;
  }

  .kpis {
    width: 100%;
    border: 1px solid #c5cdd4;
    border-collapse: collapse;
    margin: 0 0 8px;
    table-layout: fixed;
  }
  .kpis td {
    padding: 7px 8px;
    border-right: 1px solid #dbe3ea;
    vertical-align: top;
  }
  .kpis td:last-child { border-right: 0; }
  .kpis .lbl { font-size: 8.5px; color: #4b5563; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
  .kpis .val { font-size: 12px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }

  .inv-table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }
  .inv-table thead th {
    text-align: left;
    border-top: 1.5px solid #111;
    border-bottom: 1.5px solid #111;
    padding: 5px 5px;
    font-size: 9px;
    font-weight: 800;
    text-transform: none;
    color: #111;
  }
  .inv-table td {
    padding: 6px 5px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .inv-table .code { font-weight: 700; }
  .inv-table .num, .kpis .val {
    font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-variant-numeric: tabular-nums;
  }
  .inv-table th.num, .inv-table td.num { text-align: right; white-space: nowrap; }
  .inv-table tfoot td {
    font-weight: 800;
    border-top: 1.5px solid #111;
    border-bottom: 0;
    padding-top: 7px;
  }
  .inv-table .empty { text-align: center; color: #6b7280; padding: 14px 8px; font-weight: 500; }
  .notes { margin-top: 10px; font-size: 8.5px; color: #4b5563; line-height: 1.45; }

  @media screen {
    body { background: #e8eaed; padding: 12px 12px 56px; }
    .sheet {
      background: #fff;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
      padding: 10mm;
      width: 100%;
      max-width: 210mm;
    }
  }
  @media print {
    html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important; }
    .sheet {
      width: auto !important;
      max-width: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .inv-table thead { display: table-header-group; }
    .inv-table tr, .kpis, .brand, .meta-bar { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <div class="brand-left">
        ${logo}
        <div>
          <h1 class="lab-name">${brand}</h1>
          <p class="slogan">Daily OPD settlement</p>
        </div>
      </div>
      <div class="contacts">
        ${phone ? `<div><span class="ico">☎</span>${escapeHtml(phone)}</div>` : ''}
        ${address ? `<div><span class="ico">⌂</span>${escapeHtml(address)}</div>` : ''}
      </div>
    </div>

    <div class="meta-bar">
      <div class="mcol">
        <div class="mlbl">Report</div>
        <div class="mval">Daily OPD Report</div>
      </div>
      <div class="mcol">
        <div class="mlbl">Date</div>
        <div class="mval">${dateLabel}</div>
      </div>
      <div class="mcol">
        <div class="mlbl">Doctor</div>
        <div class="mval">${doctorLabel}</div>
      </div>
    </div>

    <div class="test-title">Invoices</div>
    <table class="kpis">
      <tr>
        ${invoiceKpis.map(([label, value]) => `<td><div class="lbl">${escapeHtml(label)}</div><div class="val">${escapeHtml(value)}</div></td>`).join('')}
      </tr>
    </table>
    <table class="inv-table">
      <colgroup>
        <col style="width:18%" /><col style="width:16%" /><col style="width:16%" /><col style="width:10%" />
        <col style="width:10%" /><col style="width:10%" /><col style="width:10%" /><col style="width:10%" />
      </colgroup>
      <thead>
        <tr>
          <th>Invoice</th><th>Patient</th><th>Doctor</th><th>Status</th>
          <th class="num">Total</th><th class="num">Paid</th><th class="num">Refunded</th><th class="num">Due</th>
        </tr>
      </thead>
      <tbody>${invoiceBody}</tbody>
      <tfoot>
        <tr>
          <td colspan="4">Totals</td>
          <td class="num">${escapeHtml(money(report.invoices.billed))}</td>
          <td class="num">${escapeHtml(money(report.invoices.collected))}</td>
          <td class="num">${escapeHtml(money(report.invoices.refunded))}</td>
          <td class="num">${escapeHtml(money(report.invoices.outstanding))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="test-title">Doctor fees</div>
    <table class="kpis">
      <tr>
        ${feeKpis.map(([label, value]) => `<td><div class="lbl">${escapeHtml(label)}</div><div class="val">${escapeHtml(value)}</div></td>`).join('')}
      </tr>
    </table>
    ${report.fees.byDoctor.length > 1 ? `
    <table class="inv-table" style="margin-bottom:10px">
      <colgroup>
        <col style="width:40%" /><col style="width:12%" /><col style="width:16%" /><col style="width:16%" /><col style="width:16%" />
      </colgroup>
      <thead>
        <tr><th>Doctor</th><th class="num">Tokens</th><th class="num">Collected</th><th class="num">Refunded</th><th class="num">Net</th></tr>
      </thead>
      <tbody>${byDoctorBody}</tbody>
    </table>` : ''}
    <table class="inv-table">
      <colgroup>
        <col style="width:10%" /><col style="width:22%" /><col style="width:22%" /><col style="width:12%" />
        <col style="width:12%" /><col style="width:11%" /><col style="width:11%" />
      </colgroup>
      <thead>
        <tr>
          <th>Token</th><th>Patient</th><th>Doctor</th><th>Status</th>
          <th class="num">Fee</th><th class="num">Refunded</th><th class="num">Net</th>
        </tr>
      </thead>
      <tbody>${feeBody}</tbody>
      <tfoot>
        <tr>
          <td colspan="4">Totals</td>
          <td class="num">${escapeHtml(money(report.fees.collected))}</td>
          <td class="num">${escapeHtml(money(report.fees.refunded))}</td>
          <td class="num">${escapeHtml(money(report.fees.net))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="notes">
      <strong>Note:</strong> Invoice totals exclude void/draft bills. Doctor fees are consultation amounts collected on tokens, after refunds.
    </div>
  </div>
</body>
</html>`;
}

export async function printOpdReport(report: OpdDailyReport): Promise<void> {
  const settings = (await window.clinic?.settings.get?.()) ?? {};
  const logoSrc = await getCareflowLogoDataUrl();
  const html = buildOpdReportHtml(
    report,
    {
      clinicName: settings.clinicName,
      clinicAddress: settings.clinicAddress,
      clinicPhone: settings.clinicPhone,
    },
    logoSrc,
  );
  const result = await window.clinic.print.html(html, { paper: 'A4', printDialog: false });
  if (!result?.ok) {
    throw new Error(result?.error || 'Print failed');
  }
}
