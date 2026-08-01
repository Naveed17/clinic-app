import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert, Box, Button, Chip, IconButton, Paper,
  Stack, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography, Table,
} from '@mui/material';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchField, tableSx, chipSx, actionBtnSx } from '@/components/TableUI';
import { StockDialog } from './StockDialog';

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

export function PharmacyPage(): React.JSX.Element {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Pharmacy</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Medicine stock management
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditMed(null)}>
          Add Medicine
        </Button>
      </Box>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />}>
          <strong>{lowStock.length} medicine{lowStock.length > 1 ? 's' : ''}</strong> at or below reorder level:{' '}
          {lowStock.slice(0, 5).map(m => m.name).join(', ')}
          {lowStock.length > 5 ? ` +${lowStock.length - 5} more` : ''}
        </Alert>
      )}

      {/* Search */}
      <SearchField value={search} onChange={setSearch} placeholder="Search medicines…" sx={{ width: 300 }} />

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <TableContainer sx={{ px: 1.5, pb: 1.5, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
            <TableHead>
              <TableRow>
                {['Name', 'Category', 'Unit', 'Price', 'Stock', 'Reorder Lvl', ''].map(h => (
                  <TableCell key={h}
                    align={['Price', 'Stock', 'Reorder Lvl', ''].includes(h) ? 'right' : 'left'}
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
                          <IconButton size="small"
                            sx={{ ...actionBtnSx, '&:hover': { color: 'error.main' } }}
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
          </Table>
        </TableContainer>
      </Paper>

      {editMed !== undefined && (
        <StockDialog medicine={editMed} onClose={() => setEditMed(undefined)} />
      )}
    </Box>
  );
}
