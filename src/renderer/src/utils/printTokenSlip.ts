import type { Token } from '@/types/token';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';
import { tokenNetFee } from '@shared/tokenFee';

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
  const feeAmount = Number(token.consultationFee ?? 0);
  const discountAmount = Number(token.feeDiscount ?? 0);
  const payable = tokenNetFee(token.consultationFee, token.feeDiscount, token.feeRefunded);
  const rs = (v: number) =>
    `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)}`;
  let fee = '';
  if (feeAmount > 0) {
    fee = `<div class="row"><div class="lbl">Fee</div><div class="val">${escapeHtml(rs(feeAmount))}</div></div>`;
    if (discountAmount > 0) {
      fee += `<div class="row"><div class="lbl">Discount</div><div class="val">${escapeHtml(`- ${rs(discountAmount)}`)}</div></div>`;
      fee += `<div class="row"><div class="lbl">Payable</div><div class="val">${escapeHtml(`${rs(payable)}${Number(token.feeRefunded ?? 0) > 0 ? ' (refunded)' : ''}`)}</div></div>`;
    } else if (Number(token.feeRefunded ?? 0) > 0) {
      fee = `<div class="row"><div class="lbl">Fee</div><div class="val">${escapeHtml(`${rs(feeAmount)} (refunded)`)}</div></div>`;
    }
  }
  const reason = token.reason
    ? `<div class="row"><div class="lbl">Reason</div><div class="val">${escapeHtml(token.reason)}</div></div>`
    : '';
  const mr = token.patient.mrNumber
    ? `<div class="row"><div class="lbl">MR #</div><div class="val">${escapeHtml(token.patient.mrNumber)}</div></div>`
    : '';
  const age = token.patient.age != null
    ? `<div class="row"><div class="lbl">Age</div><div class="val">${escapeHtml(String(token.patient.age))}</div></div>`
    : '';
  const gender = token.patient.gender
    ? `<div class="row"><div class="lbl">Gender</div><div class="val">${escapeHtml(token.patient.gender)}</div></div>`
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
    html {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      overflow-x: hidden;
    }
    @media print {
      html, body { color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sub, .val, .footer { color: ${POS_RECEIPT.muted} !important; }
    }
    body {
      padding: ${css.bodyPadding};
      font-family: ${css.fontName};
      font-size: ${css.fontSize};
      line-height: 1.2;
      color: #000;
      width: ${css.bodyWidth};
      max-width: ${css.bodyMaxWidth};
      margin: ${css.bodyMargin};
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
    .name { font-size: ${css.nameSize}; font-weight: 700; margin-bottom: 4px; color: #000; }
    .sub { font-size: 12px; text-align: center; margin-bottom: 2px; word-break: break-word; color: ${POS_RECEIPT.muted}; }
    .stars {
      text-align: center;
      margin: 8px 0;
      overflow: hidden;
      white-space: nowrap;
      color: #000;
    }
    .title { font-size: 1.05em; font-weight: 700; text-align: center; letter-spacing: 0.04em; color: #000; }
    .box {
      border: 2px solid #000;
      margin: 8px 2px;
      padding: 8px 4px;
      text-align: center;
      width: auto;
      overflow: hidden;
    }
    .box-label { font-size: 0.85em; font-weight: 700; letter-spacing: 0.08em; color: #000; }
    .box-num { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: 0.04em; color: #000; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 4px 0; }
    .lbl { font-weight: 700; flex-shrink: 0; color: #000; }
    .val { font-size: 12px; text-align: right; min-width: 0; flex: 1; overflow-wrap: anywhere; word-break: break-word; color: ${POS_RECEIPT.muted}; }
    .footer { text-align: center; margin-top: 10px; color: ${POS_RECEIPT.muted}; }
    .brand { text-align: center; margin-top: 8px; font-size: 0.8em; font-weight: 700; letter-spacing: 0.04em; color: #000; }
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
  ${mr}
  <div class="row"><div class="lbl">Patient</div><div class="val">${escapeHtml([token.patient.firstName, token.patient.lastName].filter(Boolean).join(' ').trim())}</div></div>
  ${age}
  ${gender}
  <div class="row"><div class="lbl">Doctor</div><div class="val">${escapeHtml(['Dr.', token.doctor.firstName, token.doctor.lastName].filter(Boolean).join(' ').trim())}</div></div>
  ${fee}
  <div class="row"><div class="lbl">Date</div><div class="val">${escapeHtml(date)}</div></div>
  <div class="row"><div class="lbl">Time</div><div class="val">${escapeHtml(time)}</div></div>
  ${note}
  ${reason}
  <div class="stars">${stars}</div>
  <div class="footer">Please wait for your token to be called.<br/>${POS_RECEIPT.thankYou}</div>
  <div class="brand">${POS_RECEIPT.poweredBy}</div>
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
