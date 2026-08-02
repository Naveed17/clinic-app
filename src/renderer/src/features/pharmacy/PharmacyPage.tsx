import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert, Box, Button, Chip, IconButton,
  Stack, Tooltip, Typography,
} from '@mui/material';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TablePageShell,
  SearchField,
  TablePager,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  tableSx,
  chipSx,
  actionBtnSx
} from '@/components/TableUI';
import { StockDialog } from './StockDialog';

const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(n)}`;

export function PharmacyPage(): React.JSX.Element {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
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

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <TablePageShell
        title="Pharmacy"
        subtitle="Medicine stock management"
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setEditMed(null)}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Add Medicine
          </Button>
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search medicines…"
            sx={{ flex: 1, maxWidth: 360 }}
          />
        }
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager
              page={page}
              rowsPerPage={rowsPerPage}
              total={filtered.length}
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        {/* Low stock alert bar inside container structure */}
        {lowStock.length > 0 && (
          <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mx: 2, mt: 1.5, mb: 1 }}>
            <strong>{lowStock.length} medicine{lowStock.length > 1 ? 's' : ''}</strong> at or below reorder level:{' '}
            {lowStock.slice(0, 5).map(m => m.name).join(', ')}
            {lowStock.length > 5 ? ` +${lowStock.length - 5} more` : ''}
          </Alert>
        )}

        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell align="right">Price</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right">Reorder Lvl</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                Loading medicines...
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                No medicines found.
              </TableCell>
            </TableRow>
          ) : (
            paginated.map(med => {
              const isLow = med.stock <= med.reorderLevel;
              return (
                <TableRow key={med.id} sx={tableSx.row}>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={13.5}>{med.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={med.category} size="small" sx={chipSx} />
                  </TableCell>
                  <TableCell>{med.unit}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600} fontSize={13.5}>{money(med.price)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={med.stock} size="small" color={isLow ? 'warning' : 'success'} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{med.reorderLevel}</TableCell>
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
                          onClick={() => { if (window.confirm(`Delete "${med.name}"?`)) deleteMutation.mutate(med.id); }}
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
      </TablePageShell>

      {editMed !== undefined && (
        <StockDialog medicine={editMed} onClose={() => setEditMed(undefined)} />
      )}
    </>
  );
}