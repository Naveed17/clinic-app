import type { Invoice } from '@/types/invoice';
// cspell:ignore bwipjs
import bwipjs from 'bwip-js';
import { POS_PAPER } from '@shared/invoicePaper';

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
): string {
  const css = POS_PAPER;
  const doctorFee = Math.max(0, invoice.total + invoice.discount - invoice.subtotal);
  const items = invoice.items ?? [];
  const barcode = barcodeDataUrl(invoice.invoiceNumber);
  const stars = '* * * * * * * * * * * * * * * * * * * * * * *';
  const clinicName = escapeHtml(clinic.clinicName?.trim() || 'CLINIC MANAGEMENT');
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
      <div class="row muted">
        <div class="desc">Discount</div>
        <div class="qty"></div>
        <div class="price">- ${money(invoice.discount)}</div>
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
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      padding: ${css.bodyPadding};
      font-family: ${css.fontName};
      font-size: ${css.fontSize};
      color: #111;
      width: ${css.bodyWidth};
      max-width: ${css.bodyMaxWidth};
      margin: 0 auto;
    }
    .center { text-align: center; }
    .name { font-size: ${css.nameSize}; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 0.9em; color: #444; margin-bottom: 2px; text-align: center; }
    .stars { font-size: 0.85em; color: #888; text-align: center; margin: 8px 0; letter-spacing: 0.02em; }
    .title { font-size: 1.05em; font-weight: 700; text-align: center; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 3px 0; }
    .row.muted { color: #333; font-size: 0.92em; }
    .desc { flex: 1; min-width: 0; word-break: break-word; }
    .qty { width: 28px; text-align: center; flex-shrink: 0; }
    .price { width: 78px; text-align: right; flex-shrink: 0; }
    .head { font-weight: 700; }
    .total { font-size: 1.1em; font-weight: 700; }
    .thanks { font-size: 1.1em; font-weight: 700; text-align: center; margin-top: 4px; }
    .barcode { display: block; width: min(170px, 90%); height: 48px; margin: 8px auto 4px; object-fit: contain; }
    .code { font-size: 0.85em; color: #555; text-align: center; }
  </style>
</head>
<body>
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
  <div class="row total"><div class="desc">Total</div><div class="price">${money(invoice.total)}</div></div>
  ${discountRow}
  ${notesRow}
  <div class="stars">${stars}</div>
  <div class="thanks">THANK YOU!</div>
  <div class="stars">${stars}</div>
  ${barcodeBlock}
  <div class="code">${escapeHtml(invoice.invoiceNumber)}</div>
</body>
</html>`;
}

/** Open POS 80mm in-app print preview for this invoice. */
export async function printInvoiceReceipt(invoice: Invoice): Promise<void> {
  const settings = (await window.clinic?.settings.get?.()) ?? {};
  const html = buildInvoiceReceiptHtml(invoice, {
    clinicName: settings.clinicName,
    clinicAddress: settings.clinicAddress,
    clinicPhone: settings.clinicPhone,
  });
  const result = await window.clinic.print.html(html);
  if (!result?.ok) {
    throw new Error(result?.error || 'Print failed');
  }
}
