import type { Invoice } from '@/types/invoice';
// cspell:ignore bwipjs
import bwipjs from 'bwip-js';
import { POS_PAPER, POS_RECEIPT } from '@shared/invoicePaper';
import { getCareflowLogoDataUrl } from '@/utils/careflowLogo';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function money(v: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(Number(v) || 0)}`;
}

function barcodeDataUrl(text: string): string | null {
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

export type InvoiceClinicInfo = {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
};

/** POS 80mm thermal cash receipt — fixed size, no paper adjustment. */
export function buildInvoiceReceiptHtml(
  invoice: Invoice,
  clinic: InvoiceClinicInfo,
  logoSrc = '',
): string {
  const css = POS_PAPER;
  const doctorFee = Math.max(0, invoice.total + invoice.discount - invoice.subtotal);
  const items = invoice.items ?? [];
  const barcode = barcodeDataUrl(invoice.invoiceNumber);
  const stars = POS_RECEIPT.starLine;
  const paid = Number(invoice.amountPaid ?? 0);
  const due = Math.max(0, Number(invoice.total) - paid);
  const clinicName = escapeHtml(clinic.clinicName?.trim() || POS_RECEIPT.clinicFallback);
  const clinicAddress = clinic.clinicAddress?.trim()
    ? `<div class="sub">${escapeHtml(clinic.clinicAddress.trim())}</div>`
    : '';
  const clinicPhone = clinic.clinicPhone?.trim()
    ? `<div class="sub">Tel: ${escapeHtml(clinic.clinicPhone.trim())}</div>`
    : '';

  const itemRows = items
    .map(
      (item) => `
      <div class="row">
        <div class="desc">${escapeHtml(item.description)}</div>
        <div class="qty">${item.quantity}</div>
        <div class="price">${money(item.lineTotal)}</div>
      </div>`,
    )
    .join('');

  const doctorRow =
    doctorFee > 0
      ? `
      <div class="row">
        <div class="desc">Doctor Fee</div>
        <div class="qty">-</div>
        <div class="price">${money(doctorFee)}</div>
      </div>`
      : '';

  const discountRow =
    invoice.discount > 0
      ? `
      <div class="row">
        <div class="desc">Discount</div>
        <div class="qty"></div>
        <div class="price">- ${money(invoice.discount)}</div>
      </div>`
      : '';

  const paidRows =
    paid > 0
      ? `
      <div class="row">
        <div class="desc">Paid</div>
        <div class="qty"></div>
        <div class="price">${money(paid)}</div>
      </div>
      <div class="row">
        <div class="desc">Balance</div>
        <div class="qty"></div>
        <div class="price">${money(due)}</div>
      </div>`
      : '';

  const notesRow = invoice.notes
    ? `
      <div class="stars">${stars}</div>
      <div class="row muted">
        <div class="desc">Notes</div>
        <div class="price" style="width:auto;flex:1;text-align:right">${escapeHtml(invoice.notes)}</div>
      </div>`
    : '';

  const barcodeBlock = barcode
    ? `<img class="barcode" src="${barcode}" alt="barcode" />`
    : '';

  return `<!DOCTYPE html>
<html data-paper="pos80">
<head>
  <meta charset="utf-8" />
  <meta name="careflow-paper" content="pos80" />
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page {
      size: ${css.pageSize};
      margin: ${css.pageMargin};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; overflow-x: hidden; }
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
    .name { font-size: ${css.nameSize}; font-weight: 700; margin-bottom: 4px; color: #000; }
    .sub { font-size: 0.9em; color: #000; margin-bottom: 2px; text-align: center; }
    .stars { font-size: 0.95em; color: #000; text-align: center; margin: 8px 0; overflow: hidden; white-space: nowrap; }
    .title { font-size: 1.05em; font-weight: 700; text-align: center; color: #000; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 3px 0; color: #000; }
    .row.muted { color: #000; font-size: 1em; }
    .desc { flex: 1; min-width: 0; word-break: break-word; }
    .qty { width: 28px; text-align: center; flex-shrink: 0; }
    .price { width: 78px; text-align: right; flex-shrink: 0; }
    .head { font-weight: 700; }
    .total { font-size: 1.1em; font-weight: 700; }
    .thanks { font-size: 1.1em; font-weight: 700; text-align: center; margin-top: 4px; color: #000; }
    .barcode { display: block; width: min(170px, 90%); height: 48px; margin: 8px auto 4px; object-fit: contain; }
    .code { font-size: 0.9em; color: #000; font-weight: 700; text-align: center; }
    .brand { text-align: center; margin-top: 8px; font-size: 0.8em; font-weight: 700; letter-spacing: 0.08em; }
  </style>
</head>
<body>
  ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="CareFlow" />` : ''}
  <div class="center name">${clinicName}</div>
  ${clinicAddress}
  ${clinicPhone}
  <div class="stars">${stars}</div>
  <div class="title">CASH RECEIPT</div>
  <div class="stars">${stars}</div>
  <div class="row muted"><div class="desc">Invoice #</div><div class="price" style="width:auto">${escapeHtml(invoice.invoiceNumber)}</div></div>
  <div class="row muted"><div class="desc">Patient</div><div class="price" style="width:auto">${escapeHtml(`${invoice.patient.firstName} ${invoice.patient.lastName}`)}</div></div>
  <div class="row muted"><div class="desc">Date</div><div class="price" style="width:auto">${escapeHtml(new Date(invoice.createdAt).toLocaleDateString())}</div></div>
  <div class="row muted"><div class="desc">Time</div><div class="price" style="width:auto">${escapeHtml(new Date(invoice.createdAt).toLocaleTimeString())}</div></div>
  <div class="stars">${stars}</div>
  <div class="row head"><div class="desc">Description</div><div class="qty">Qty</div><div class="price">Price</div></div>
  <div class="stars">${stars}</div>
  ${itemRows}
  ${doctorRow}
  <div class="stars">${stars}</div>
  ${discountRow}
  <div class="row total"><div class="desc">TOTAL</div><div class="price">${money(invoice.total)}</div></div>
  ${paidRows}
  ${notesRow}
  <div class="stars">${stars}</div>
  <div class="thanks">${POS_RECEIPT.thankYou}</div>
  <div class="stars">${stars}</div>
  ${barcodeBlock}
  <div class="code">${escapeHtml(invoice.invoiceNumber)}</div>
  <div class="brand">CAREFLOW</div>
</body>
</html>`;
}

/** Open POS 80mm in-app print preview for this invoice. */
export async function printInvoiceReceipt(invoice: Invoice): Promise<void> {
  const settings = (await window.clinic?.settings.get?.()) ?? {};
  const logoSrc = await getCareflowLogoDataUrl();
  const html = buildInvoiceReceiptHtml(
    invoice,
    {
      clinicName: settings.clinicName,
      clinicAddress: settings.clinicAddress,
      clinicPhone: settings.clinicPhone,
    },
    logoSrc,
  );
  const result = await window.clinic.print.html(html);
  if (!result?.ok) {
    throw new Error(result?.error || 'Print failed');
  }
}
