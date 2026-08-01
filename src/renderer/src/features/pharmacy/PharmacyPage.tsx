import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import {
  Alert, Box, Button, Chip, IconButton, Paper,
  Stack, Tab, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
  Table,
} from '@mui/material';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchField, tableSx, chipSx, actionBtnSx } from '@/components/TableUI';
import { StockDialog } from './StockDialog';
import { SaleDialog } from './SaleDialog';
import { PharmacySalePrint } from './PharmacySalePrint';

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK');

// ─── Reusable table wrapper ───────────────────────────────────────────────────
function PharmacyTable({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <TableContainer sx={{ px: 1.5, pb: 1.5, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
        <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
          {children}
        </Table>
      </TableContainer>
    </Paper>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────
function StockTab(): React.JSX.Element {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editMed, setEditMed] = useState<PharmacyMedicine | null | undefined>(undefined);

  const { data: medicines = [], isLoading } = useQuery<PharmacyMedicine[]>({
    queryKey: ['pharmacy-medicines'],
    queryFn: () => window.clinic.pharmacy.medicines.list(),
  });

  const { data: lowStock = [] } = useQuery<PharmacyMedicine[]>({
    queryKey: ['pharmacy-low-stock'],
    queryFn: () => window.clinic.pharmacy.medicines.lowStock(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.pharmacy.medicines.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pharmacy-medicines'] });
      void qc.invalidateQueries({ queryKey: ['pharmacy-low-stock'] });
    },
  });

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      {lowStock.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 2 }}>
          <strong>{lowStock.length} medicine{lowStock.length > 1 ? 's' : ''}</strong> at or below reorder level:{' '}
          {lowStock.slice(0, 5).map(m => m.name).join(', ')}
          {lowStock.length > 5 ? ` +${lowStock.length - 5} more` : ''}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <SearchField value={search} onChange={setSearch} placeholder="Search medicines…" sx={{ width: 280 }} />
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditMed(null)}>
          Add Medicine
        </Button>
      </Stack>

      <PharmacyTable>
        <TableHead>
          <TableRow>
            {['Name', 'Category', 'Unit', 'Price', 'Stock', 'Reorder Lvl', ''].map(h => (
              <TableCell key={h} align={['Price', 'Stock', 'Reorder Lvl', ''].includes(h) ? 'right' : 'left'}
                sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', py: 1.5, px: 2, bgcolor: 'background.paper' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading…</Typography>
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No medicines found.</Typography>
              </TableCell>
            </TableRow>
          ) : filtered.map(med => {
            const isLow = med.stock <= med.reorderLevel;
            return (
              <TableRow key={med.id} sx={tableSx.row}>
                <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                  <Typography fontWeight={600} fontSize={13}>{med.name}</Typography>
                </TableCell>
                <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                  <Chip label={med.category} size="small" sx={chipSx} />
                </TableCell>
                <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>{med.unit}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>{money(med.price)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                  <Chip label={med.stock} size="small" color={isLow ? 'warning' : 'success'} variant="outlined" />
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>{med.reorderLevel}</TableCell>
                <TableCell align="right" sx={{ py: 0.75, px: 2, border: 'none' }}>
                  <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                    <Tooltip title="Edit">
                      <IconButton size="small" sx={actionBtnSx} onClick={() => setEditMed(med)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" sx={{ ...actionBtnSx, '&:hover': { color: 'error.main' } }}
                        onClick={() => { if (window.confirm(`Delete "${med.name}"?`)) deleteMutation.mutate(med.id); }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </PharmacyTable>

      {editMed !== undefined && (
        <StockDialog medicine={editMed} onClose={() => setEditMed(undefined)} />
      )}
    </Box>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────
function SalesTab({ clinicName, clinicPhone }: { clinicName?: string; clinicPhone?: string }): React.JSX.Element {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(today);
  const [saleOpen, setSaleOpen] = useState(false);
  const [printId, setPrintId]   = useState<string | null>(null);

  const { data: sales = [], isLoading, refetch } = useQuery<PharmacySale[]>({
    queryKey: ['pharmacy-sales', fromDate, toDate],
    queryFn: () => window.clinic.pharmacy.sales.list({ from: fromDate, to: toDate }),
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
        <Stack direction="row" gap={1.5} alignItems="center">
          <TextField label="From" type="date" size="small" value={fromDate}
            onChange={e => setFromDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" size="small" value={toDate}
            onChange={e => setToDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Stack direction="row" gap={1.5} alignItems="center">
          {sales.length > 0 && (
            <Chip label={`Revenue: ${money(totalRevenue)}`} color="success" variant="outlined" />
          )}
          <Button variant="contained" startIcon={<ShoppingCartOutlinedIcon />} onClick={() => setSaleOpen(true)}>
            New Sale
          </Button>
        </Stack>
      </Stack>

      <PharmacyTable>
        <TableHead>
          <TableRow>
            {['Date', 'Patient', 'Medicines', 'Sold By', 'Total', ''].map(h => (
              <TableCell key={h} align={['Total', ''].includes(h) ? 'right' : 'left'}
                sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', py: 1.5, px: 2, bgcolor: 'background.paper' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading…</Typography>
              </TableCell>
            </TableRow>
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No sales for this period.</Typography>
              </TableCell>
            </TableRow>
          ) : sales.map(sale => (
            <TableRow key={sale.id} sx={tableSx.row}>
              <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>{fmtDate(sale.saleDate)}</TableCell>
              <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                {sale.patientName ?? <Typography color="text.secondary" fontSize={12}>Walk-in</Typography>}
              </TableCell>
              <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                <Typography fontSize={12} noWrap sx={{ maxWidth: 260 }}>
                  {sale.items.map(i => `${i.medicineName} ×${i.quantity}`).join(', ')}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>{sale.soldByName}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, py: 0.75, px: 2, border: 'none' }}>
                <Typography fontWeight={600} fontSize={13}>{money(sale.total)}</Typography>
              </TableCell>
              <TableCell align="right" sx={{ py: 0.75, px: 2, border: 'none' }}>
                <Tooltip title="Print Receipt">
                  <IconButton size="small" sx={actionBtnSx} onClick={() => setPrintId(sale.id)}>
                    <ReceiptOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </PharmacyTable>

      {saleOpen && (
        <SaleDialog
          onClose={() => setSaleOpen(false)}
          onSaved={sale => { setSaleOpen(false); setPrintId(sale.id); void refetch(); }}
        />
      )}
      {printId && (
        <PharmacySalePrint
          saleId={printId}
          clinicName={clinicName}
          clinicPhone={clinicPhone}
          onClose={() => setPrintId(null)}
        />
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PharmacyPage(): React.JSX.Element {
  const [tab, setTab] = useState(0);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.clinic.settings.get(),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700}>Pharmacy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Stock management and medicine sales
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Stock" />
        <Tab label="Sales" />
      </Tabs>

      {tab === 0 && <StockTab />}
      {tab === 1 && <SalesTab clinicName={settings?.clinicName} clinicPhone={settings?.clinicPhone} />}
    </Box>
  );
}
