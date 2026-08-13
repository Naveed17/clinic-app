import type { Token } from '@/types/token';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export type TokenClinicInfo = {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
};

/** POS 80mm classic token slip as HTML (thermal printers often print PDF as a blank roll). */
export function buildTokenSlipHtml(
  token: Token,
  clinic: TokenClinicInfo,
  logoSrc = '',
): string {
  const css = POS_PAPER;
  const stars = POS_RECEIPT.starLine;
  const clinicName = escapeHtml(clinic.clinicName?.trim() || POS_RECEIPT.clinicFallback);
  const clinicAddress = clinic.clinicAddress?.trim()
    ? `<div class="sub">${escapeHtml(clinic.clinicAddress.trim())}</div>`
    : '';
  const clinicPhone = clinic.clinicPhone?.trim()
    ? `<div class="sub">Tel: ${escapeHtml(clinic.clinicPhone.trim())}</div>`
    : '';
  const date = new Date(token.createdAt).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = new Date(token.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const num = String(token.tokenNumber).padStart(3, '0');
  const note = token.notes
    ? `<div class="row"><div class="lbl">Note</div><div class="val">${escapeHtml(token.notes)}</div></div>`
    : '';
  const reason = token.reason
    ? `<div class="row"><div class="lbl">Reason</div><div class="val">${escapeHtml(token.reason)}</div></div>`
    : '';
  const mr = token.patient.mrNumber
    ? `<div class="row"><div class="lbl">MR #</div><div class="val">${escapeHtml(token.patient.mrNumber)}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html data-paper="pos80">
<head>
  <meta charset="utf-8" />
  <meta name="careflow-paper" content="pos80" />
  <title>Token ${escapeHtml(num)}</title>
  <style>
    @page { size: ${css.pageSize}; margin: ${css.pageMargin}; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      overflow-x: hidden;
    }
    @media print {
      html, body, * { color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      padding: ${css.bodyPadding};
      font-family: ${css.fontName};
      font-size: ${css.fontSize};
      color: #000;
      width: ${css.bodyWidth};
      max-width: ${css.bodyMaxWidth};
      margin: 0;
      overflow-x: hidden;
    }
    .center { text-align: center; }
    .logo {
      display: block;
      width: 44px;
      height: 44px;
      object-fit: contain;
      margin: 0 auto 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .name { font-size: ${css.nameSize}; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 0.9em; text-align: center; margin-bottom: 2px; word-break: break-word; }
    .stars {
      text-align: center;
      margin: 8px 0;
      overflow: hidden;
      white-space: nowrap;
    }
    .title { font-size: 1.05em; font-weight: 700; text-align: center; letter-spacing: 0.04em; }
    .box {
      border: 2px solid #000;
      margin: 8px 0;
      padding: 8px 4px;
      text-align: center;
      width: 100%;
      overflow: hidden;
    }
    .box-label { font-size: 0.85em; font-weight: 700; letter-spacing: 0.08em; }
    .box-num { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: 0.04em; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 4px 0; }
    .lbl { font-weight: 700; flex-shrink: 0; }
    .val { text-align: right; min-width: 0; flex: 1; overflow-wrap: anywhere; word-break: break-word; }
    .footer { text-align: center; margin-top: 10px; }
    .brand { text-align: center; margin-top: 8px; font-size: 0.8em; font-weight: 700; letter-spacing: 0.08em; }
  </style>
</head>
<body>
  ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="CareFlow" />` : ''}
  <div class="center name">${clinicName}</div>
  ${clinicAddress}
  ${clinicPhone}
  <div class="stars">${stars}</div>
  <div class="title">PATIENT TOKEN SLIP</div>
  <div class="stars">${stars}</div>
  <div class="box">
    <div class="box-label">TOKEN NO.</div>
    <div class="box-num">${escapeHtml(num)}</div>
  </div>
  <div class="stars">${stars}</div>
  <div class="row"><div class="lbl">Patient</div><div class="val">${escapeHtml(`${token.patient.firstName} ${token.patient.lastName}`.trim())}</div></div>
  ${mr}
  <div class="row"><div class="lbl">Doctor</div><div class="val">${escapeHtml(`Dr. ${token.doctor.firstName} ${token.doctor.lastName}`.trim())}</div></div>
  <div class="row"><div class="lbl">Date</div><div class="val">${escapeHtml(date)}</div></div>
  <div class="row"><div class="lbl">Time</div><div class="val">${escapeHtml(time)}</div></div>
  ${note}
  ${reason}
  <div class="stars">${stars}</div>
  <div class="footer">Please wait for your token to be called.<br/>${POS_RECEIPT.thankYou}</div>
  <div class="brand">CAREFLOW</div>
</body>
</html>`;
}

export async function printTokenSlip(
  token: Token,
  options?: { silent?: boolean },
): Promise<void> {
  const settings = (await window.clinic?.settings.get?.()) ?? {};
  const logoSrc = await getCareflowLogoDataUrl();
  const html = buildTokenSlipHtml(
    token,
    {
      clinicName: settings.clinicName,
      clinicAddress: settings.clinicAddress,
      clinicPhone: settings.clinicPhone,
    },
    logoSrc,
  );
  const result = await window.clinic.print.html(html, {
    printDialog: options?.silent === false,
    paper: 'pos80',
  });
  if (!result?.ok) {
    throw new Error(result?.error || 'Print failed');
  }
}
