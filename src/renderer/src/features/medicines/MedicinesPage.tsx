import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ConfirmDialog,
  FormDialogTitle,
  SubmitButton,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  TableBody,
  TableCell,
  TableHead,
  TablePager,
  TablePageShell,
  TableRow,
  actionBtnSx,
  tableSx,
  SearchField,
} from '@/components/TableUI';
import { medicinesService } from '@/services/medicines.service';
import type { Medicine } from '@/types/medicine';

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

export function MedicinesPage(): React.JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = user?.role === 'receptionist';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | undefined>();
  const [deleteMed, setDeleteMed] = useState<Medicine | undefined>();

  const { data: medicines = [], isLoading, isFetching, isError } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => medicinesService.list(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter((m) => m.name.toLowerCase().includes(q));
  }, [medicines, search]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const cols = canManage ? 4 : 3;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => medicinesService.delete(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      setDeleteMed(undefined);
    },
    meta: { toast: 'Medicine deleted', errorToast: 'Unable to delete this medicine.' },
  });

  return (
    <>
      <TablePageShell
        title="Medicines"
        subtitle={
          canManage
            ? 'Add, edit, or remove medicines used when creating invoices.'
            : 'Medicine catalog used when creating invoices. Reception can add or change items.'
        }
        action={
          canManage ? (
            <Button
              onClick={() => { setEditing(undefined); setDialogOpen(true); }}
              startIcon={<AddOutlinedIcon />}
              variant="contained"
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              Add medicine
            </Button>
          ) : undefined
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search by name"
            sx={{ flex: 1, maxWidth: 360 }}
          />
        }
        error={isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load medicines.</Alert>}
        fetching={isFetching && !isLoading}
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Medicine</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Updated</TableCell>
            {canManage && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRowsSkeleton cols={cols} />
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={cols} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                No medicines found.
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((med) => (
              <TableRow key={med.id} sx={tableSx.row}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 16 }}>
                      <MedicationOutlinedIcon fontSize="small" />
                    </Avatar>
                    <Typography fontSize={13.5} fontWeight={600}>{med.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography fontSize={13.5} fontWeight={600}>{money(med.price)}</Typography>
                </TableCell>
                <TableCell>
                  {med.updatedAt
                    ? new Date(med.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton
                          sx={actionBtnSx}
                          onClick={() => { setEditing(med); setDialogOpen(true); }}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton sx={actionBtnSx} onClick={() => setDeleteMed(med)}>
                          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </TablePageShell>

      {canManage && dialogOpen && (
        <MedicineFormDialog
          key={editing?.id ?? 'new'}
          medicine={editing}
          onClose={() => { setDialogOpen(false); setEditing(undefined); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteMed)}
        title="Delete medicine?"
        message={deleteMed ? `Delete ${deleteMed.name} from the catalog? Existing invoices keep their billed items.` : ''}
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Unable to delete this medicine.</Alert> : undefined}
        onClose={() => setDeleteMed(undefined)}
        onConfirm={() => deleteMed && deleteMutation.mutate(deleteMed.id)}
      />
    </>
  );
}

function MedicineFormDialog({
  medicine,
  onClose,
}: {
  medicine?: Medicine;
  onClose: () => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const isEdit = Boolean(medicine);
  const [name, setName] = useState(medicine?.name ?? '');
  const [price, setPrice] = useState(medicine ? String(medicine.price) : '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      isEdit && medicine
        ? medicinesService.update(medicine.id, name.trim(), parseFloat(price) || 0)
        : medicinesService.create(name.trim(), parseFloat(price) || 0),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save medicine.'),
    meta: {
      toast: isEdit ? 'Medicine updated' : 'Medicine added',
      errorToast: 'Could not save medicine.',
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title={isEdit ? 'Edit Medicine' : 'Add New Medicine'}
        subtitle={isEdit ? 'Update the name or sale price.' : 'Add a medicine to the catalog used on invoices.'}
      />
      <DialogContent sx={dialogContentSx}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Medicine name"
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <TextField
            label="Price"
            size="small"
            type="number"
            fullWidth
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
        <SubmitButton
          startIcon={isEdit ? <EditOutlinedIcon /> : <AddOutlinedIcon />}
          disabled={!name.trim()}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {isEdit ? 'Save' : 'Add Medicine'}
        </SubmitButton>
      </DialogActions>
    </Dialog>
  );
}
