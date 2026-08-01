import { Dialog, DialogContent, Box, Button, Stack, Typography, Divider } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { useQuery } from '@tanstack/react-query';

interface Props {
  saleId: string;
  clinicName?: string;
  clinicPhone?: string;
  onClose: () => void;
}

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

export function PharmacySalePrint({ saleId, clinicName, clinicPhone, onClose }: Props): React.JSX.Element {
  const { data: sale, isLoading } = useQuery<PharmacySale | null>({
    queryKey: ['pharmacy-sale', saleId],
    queryFn: () => window.clinic.pharmacy.sales.get(saleId),
  });

  const handlePrint = async () => {
    if (!sale) return;
    const html = buildReceiptHtml(sale, clinicName, clinicPhone);
    await window.clinic.print.html(html);
  };

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2 }}>
        <Typography fontWeight={700} fontSize={16}>Sale Receipt</Typography>
        <Button size="small" color="inherit" startIcon={<CloseOutlinedIcon />} onClick={onClose}>Close</Button>
      </Box>

      <DialogContent>
        {isLoading || !sale ? (
          <Typography color="text.secondary" textAlign="center" py={3}>Loading…</Typography>
        ) : (
          <Box sx={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
            {/* Header */}
            <Typography fontWeight={700} fontSize={15} textAlign="center">{clinicName ?? 'Clinic'}</Typography>
            {clinicPhone && <Typography fontSize={11} textAlign="center" color="text.secondary">{clinicPhone}</Typography>}
            <Divider sx={{ my: 1 }} />

            {/* Meta */}
            <Stack direction="row" justifyContent="space-between">
              <Typography fontSize={12} color="text.secondary">Date:</Typography>
              <Typography fontSize={12}>{sale.saleDate}</Typography>
            </Stack>
            {sale.patientName && (
              <Stack direction="row" justifyContent="space-between">
                <Typography fontSize={12} color="text.secondary">Patient:</Typography>
                <Typography fontSize={12}>{sale.patientName}</Typography>
              </Stack>
            )}
            <Stack direction="row" justifyContent="space-between">
              <Typography fontSize={12} color="text.secondary">Sold by:</Typography>
              <Typography fontSize={12}>{sale.soldByName}</Typography>
            </Stack>

            <Divider sx={{ my: 1 }} />

            {/* Items */}
            {sale.items.map((item, i) => (
              <Box key={i}>
                <Typography fontSize={12} fontWeight={600}>{item.medicineName}</Typography>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontSize={11} color="text.secondary">
                    {item.quantity} × {money(item.unitPrice)}
                  </Typography>
                  <Typography fontSize={12}>{money(item.lineTotal)}</Typography>
                </Stack>
              </Box>
            ))}

            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>Total</Typography>
              <Typography fontWeight={700}>{money(sale.total)}</Typography>
            </Stack>

            {sale.notes && (
              <Typography fontSize={11} color="text.secondary" sx={{ mt: 1 }}>Note: {sale.notes}</Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <Box sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained" fullWidth startIcon={<PrintOutlinedIcon />}
          disabled={!sale || isLoading}
          onClick={handlePrint}
        >
          Print Receipt
        </Button>
      </Box>
    </Dialog>
  );
}

// ─── HTML receipt for PDF printing ───────────────────────────────────────────
function buildReceiptHtml(sale: PharmacySale, clinicName?: string, clinicPhone?: string): string {
  const rows = sale.items.map(i => `
    <tr>
      <td>${i.medicineName}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${money(i.unitPrice)}</td>
      <td style="text-align:right">${money(i.lineTotal)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: monospace; font-size: 13px; margin: 20px; }
  h2 { text-align: center; margin: 0; }
  p  { text-align: center; margin: 2px 0; color: #555; font-size: 11px; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #666; padding-bottom: 4px; }
  td { padding: 2px 0; font-size: 12px; }
  .total { font-weight: bold; font-size: 14px; }
  .right { text-align: right; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; }
</style>
</head><body>
  <h2>${clinicName ?? 'Pharmacy'}</h2>
  ${clinicPhone ? `<p>${clinicPhone}</p>` : ''}
  <hr>
  <div class="meta"><span>Date: ${sale.saleDate}</span>${sale.patientName ? `<span>Patient: ${sale.patientName}</span>` : ''}</div>
  <div class="meta"><span>Sold by: ${sale.soldByName}</span></div>
  <hr>
  <table>
    <thead><tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr>
  <div class="meta total"><span>TOTAL</span><span>${money(sale.total)}</span></div>
  ${sale.notes ? `<hr><p style="text-align:left">Note: ${sale.notes}</p>` : ''}
</body></html>`;
}
