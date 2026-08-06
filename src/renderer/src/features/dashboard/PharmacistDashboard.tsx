import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert, Box, Button, Chip, IconButton, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { StockDialog, type InventoryMedicineRow } from '@/features/pharmacy/StockDialog';
import { tableSx, chipSx, actionBtnSx } from '@/components/TableUI';
import { ConfirmDialog } from '@/components/DialogUI';

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

function toRow(med: InventoryMedicine): InventoryMedicineRow {
  const batches = med.batches ?? [];
  const stock = batches.reduce((sum, b) => sum + Number(b.quantity ?? 0), 0);
  const priced = batches.find((b) => Number(b.salePrice) > 0) ?? batches[0];
  return {
    id: med.id,
    name: med.name,
    unit: med.unit,
    category: med.category?.name ?? 'General',
    categoryId: med.categoryId ?? null,
    minStockAlert: med.minStockAlert ?? 10,
    stock,
    price: Number(priced?.salePrice ?? 0),
    genericName: med.genericName ?? null,
    rackNumber: med.rackNumber ?? null,
  };
}

export function PharmacistDashboard(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editMed, setEditMed] = useState<InventoryMedicineRow | null | undefined>(undefined);
  const [deleteMed, setDeleteMed] = useState<InventoryMedicineRow | null>(null);

  const { data: rawMedicines = [], isLoading } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-medicines'],
    queryFn: () => window.clinic.inventory.medicines.list(),
  });

  const { data: lowStockRaw = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => window.clinic.inventory.medicines.lowStock(),
  });

  const { data: expiring = [] } = useQuery<InventoryBatch[]>({
    queryKey: ['inventory-expiring'],
    queryFn: () => window.clinic.inventory.batches.expiringSoon(60),
  });

  const medicines = useMemo(() => rawMedicines.map(toRow), [rawMedicines]);
  const lowStock = useMemo(() => lowStockRaw.map(toRow), [lowStockRaw]);
  const totalStock = useMemo(() => medicines.reduce((s, m) => s + m.stock, 0), [medicines]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.inventory.medicines.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory-medicines'] });
      void qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      void qc.invalidateQueries({ queryKey: ['medicines'] });
      setDeleteMed(null);
    },
  });

  const recent = medicines.slice(0, 8);

  return (
    <>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Pharmacy Dashboard — <Box component="span" color="primary.main">{user?.name}</Box>
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' } }}>
          {[
            { label: 'Medicines', value: medicines.length, icon: <LocalPharmacyOutlinedIcon />, color: theme.palette.primary.main },
            { label: 'Total Stock', value: totalStock, icon: <Inventory2OutlinedIcon />, color: theme.palette.secondary.main },
            { label: 'Low Stock', value: lowStock.length, icon: <WarningAmberOutlinedIcon />, color: theme.palette.warning.main },
            { label: 'Expiring (60d)', value: expiring.length, icon: <EventBusyOutlinedIcon />, color: theme.palette.error.main },
          ].map((c) => (
            <Paper key={c.label} variant="outlined" sx={{ p: 2.5, borderTop: `3px solid ${c.color}` }}>
              <Box sx={{ color: c.color, mb: 1 }}>{c.icon}</Box>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{c.value}</Typography>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            </Paper>
          ))}
        </Box>

        {lowStock.length > 0 && (
          <Alert severity="warning" icon={<WarningAmberOutlinedIcon />}>
            <strong>{lowStock.length}</strong> medicine{lowStock.length > 1 ? 's' : ''} at or below min alert:{' '}
            {lowStock.slice(0, 6).map((m) => m.name).join(', ')}
            {lowStock.length > 6 ? ` +${lowStock.length - 6} more` : ''}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          <Paper variant="outlined" sx={{ p: 2.5, gridColumn: { md: 'span 3' }, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography fontWeight={700}>Medicines</Typography>
              <Stack direction="row" gap={1}>
                <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditMed(null)} sx={{ borderRadius: 2 }}>
                  Add
                </Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/pharmacy')} sx={{ borderRadius: 2 }}>
                  View All
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Stock</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>Loading…</TableCell>
                    </TableRow>
                  ) : recent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No medicines yet.</TableCell>
                    </TableRow>
                  ) : (
                    recent.map((med) => {
                      const isLow = med.stock <= med.minStockAlert;
                      return (
                        <TableRow key={med.id} sx={tableSx.row}>
                          <TableCell>
                            <Typography fontWeight={600} fontSize={13}>{med.name}</Typography>
                          </TableCell>
                          <TableCell><Chip label={med.category} size="small" sx={chipSx} /></TableCell>
                          <TableCell align="right">
                            <Chip label={med.stock} size="small" color={isLow ? 'warning' : 'success'} variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{money(med.price)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                              <Tooltip title="Edit">
                                <IconButton size="small" sx={actionBtnSx} onClick={() => setEditMed(med)}>
                                  <EditOutlinedIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  sx={{ ...actionBtnSx, '&:hover': { color: 'error.main' } }}
                                  onClick={() => setDeleteMed(med)}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>

          <Stack spacing={2} sx={{ gridColumn: { md: 'span 1' }, minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography fontWeight={700} sx={{ mb: 1.5 }}>Expiring Soon</Typography>
              {expiring.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No batches expiring in 60 days.</Typography>
              ) : (
                <Stack spacing={1}>
                  {expiring.slice(0, 6).map((b) => (
                    <Box
                      key={b.id}
                      sx={{
                        p: 1.25, borderRadius: 1,
                        bgcolor: alpha(theme.palette.error.main, 0.04),
                        border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2),
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {b.medicine?.name ?? 'Medicine'} · {b.batchNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Qty {b.quantity} · Expiry {new Date(b.expiryDate).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography fontWeight={700} sx={{ mb: 1.5 }}>Quick Actions</Typography>
              <Stack spacing={1}>
                <Button variant="contained" fullWidth startIcon={<AddOutlinedIcon />} onClick={() => setEditMed(null)} sx={{ justifyContent: 'flex-start', borderRadius: 2 }}>
                  Add Medicine
                </Button>
                <Button variant="outlined" fullWidth startIcon={<LocalPharmacyOutlinedIcon />} onClick={() => navigate('/pharmacy')} sx={{ justifyContent: 'flex-start', borderRadius: 2 }}>
                  Open Full Inventory
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>

      {editMed !== undefined && (
        <StockDialog medicine={editMed} onClose={() => setEditMed(undefined)} />
      )}
      <ConfirmDialog
        open={Boolean(deleteMed)}
        title="Delete medicine?"
        message={deleteMed ? `Delete "${deleteMed.name}" from inventory?` : ''}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteMed(null)}
        onConfirm={() => deleteMed && deleteMutation.mutate(deleteMed.id)}
      />
    </>
  );
}
