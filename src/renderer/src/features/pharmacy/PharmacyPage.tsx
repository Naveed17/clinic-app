import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert, Button, Chip, IconButton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
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
  actionBtnSx,
} from '@/components/TableUI';
import { useAuth } from '@/features/auth/AuthContext';
import { StockDialog, type InventoryMedicineRow } from './StockDialog';
import { ConfirmDialog } from '@/components/DialogUI';
import { BatchDialog } from './BatchDialog';
import { SupplierDialog } from './SupplierDialog';
import { PurchaseDialog } from './PurchaseDialog';
import { MovementDialog } from './MovementDialog';
import { CategoryDialog } from './CategoryDialog';
import { daysUntil, medicinePrice, medicineStock, money } from './inventoryUtils';

type TabKey = 'medicines' | 'batches' | 'suppliers' | 'purchases' | 'movements' | 'categories';

function toRow(med: InventoryMedicine): InventoryMedicineRow {
  return {
    id: med.id,
    name: med.name,
    unit: med.unit,
    category: med.category?.name ?? 'General',
    categoryId: med.categoryId ?? null,
    minStockAlert: med.minStockAlert ?? 10,
    stock: medicineStock(med),
    price: medicinePrice(med),
    genericName: med.genericName ?? null,
    rackNumber: med.rackNumber ?? null,
  };
}

export function PharmacyPage(): React.JSX.Element {
  const { user } = useAuth();
  const canManage = user?.role === 'pharmacist';
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('medicines');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  const [editMed, setEditMed] = useState<InventoryMedicineRow | null | undefined>(undefined);
  const [deleteMed, setDeleteMed] = useState<InventoryMedicineRow | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const { data: rawMedicines = [], isLoading: medLoading } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-medicines'],
    queryFn: () => window.clinic.inventory.medicines.list(),
  });
  const { data: lowStockRaw = [] } = useQuery<InventoryMedicine[]>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => window.clinic.inventory.medicines.lowStock(),
  });
  const { data: batches = [], isLoading: batchLoading } = useQuery<InventoryBatch[]>({
    queryKey: ['inventory-batches'],
    queryFn: () => window.clinic.inventory.batches.list(),
  });
  const { data: suppliers = [], isLoading: supplierLoading } = useQuery<InventorySupplier[]>({
    queryKey: ['inventory-suppliers'],
    queryFn: () => window.clinic.inventory.suppliers.list(),
  });
  const { data: purchases = [], isLoading: purchaseLoading } = useQuery<InventoryPurchaseOrder[]>({
    queryKey: ['inventory-purchases'],
    queryFn: () => window.clinic.inventory.purchases.list(),
  });
  const { data: movements = [], isLoading: movementLoading } = useQuery<InventoryStockMovement[]>({
    queryKey: ['inventory-movements'],
    queryFn: () => window.clinic.inventory.movements.list(),
  });
  const { data: categories = [], isLoading: categoryLoading } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory-categories'],
    queryFn: () => window.clinic.inventory.categories.list(),
  });

  const medicines = useMemo(() => rawMedicines.map(toRow), [rawMedicines]);
  const lowStock = useMemo(
    () => lowStockRaw.map((m) => ({ name: m.name, stock: (m as InventoryMedicine & { stock?: number }).stock ?? medicineStock(m) })),
    [lowStockRaw],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.inventory.medicines.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory-medicines'] });
      void qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      void qc.invalidateQueries({ queryKey: ['medicines'] });
      setDeleteMed(null);
    },
  });

  function changeTab(next: TabKey) {
    setTab(next);
    setSearch('');
    setPage(0);
  }

  const q = search.trim().toLowerCase();

  const filteredMedicines = medicines.filter((m) =>
    !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || (m.genericName ?? '').toLowerCase().includes(q),
  );
  const filteredBatches = batches.filter((b) =>
    !q ||
    (b.medicine?.name ?? '').toLowerCase().includes(q) ||
    b.batchNumber.toLowerCase().includes(q),
  );
  const filteredSuppliers = suppliers.filter((s) =>
    !q || s.name.toLowerCase().includes(q) || (s.companyName ?? '').toLowerCase().includes(q) || (s.phone ?? '').includes(q),
  );
  const filteredPurchases = purchases.filter((p) =>
    !q ||
    p.invoiceNumber.toLowerCase().includes(q) ||
    (p.supplier?.name ?? '').toLowerCase().includes(q),
  );
  const filteredMovements = movements.filter((m) =>
    !q ||
    (m.batch?.medicine?.name ?? '').toLowerCase().includes(q) ||
    (m.batch?.batchNumber ?? '').toLowerCase().includes(q) ||
    m.type.toLowerCase().includes(q) ||
    (m.reference ?? '').toLowerCase().includes(q),
  );
  const filteredCategories = categories.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
  );

  const listByTab: Record<TabKey, unknown[]> = {
    medicines: filteredMedicines,
    batches: filteredBatches,
    suppliers: filteredSuppliers,
    purchases: filteredPurchases,
    movements: filteredMovements,
    categories: filteredCategories,
  };
  const loadingByTab: Record<TabKey, boolean> = {
    medicines: medLoading,
    batches: batchLoading,
    suppliers: supplierLoading,
    purchases: purchaseLoading,
    movements: movementLoading,
    categories: categoryLoading,
  };

  const filtered = listByTab[tab];
  const isLoading = loadingByTab[tab];
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const addAction = (() => {
    if (!canManage) return undefined;
    if (tab === 'medicines') return { label: 'Add Medicine', onClick: () => setEditMed(null) };
    if (tab === 'batches') return { label: 'Add Batch', onClick: () => setBatchOpen(true) };
    if (tab === 'suppliers') return { label: 'Add Supplier', onClick: () => setSupplierOpen(true) };
    if (tab === 'purchases') return { label: 'New Purchase', onClick: () => setPurchaseOpen(true) };
    if (tab === 'movements') return { label: 'Record Movement', onClick: () => setMovementOpen(true) };
    if (tab === 'categories') return { label: 'Add Category', onClick: () => setCategoryOpen(true) };
    return undefined;
  })();

  return (
    <>
      <TablePageShell
        title="Inventory"
        subtitle={canManage ? 'Full pharmacy inventory management' : 'Pharmacy stock (view only)'}
        action={
          addAction ? (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={addAction.onClick}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {addAction.label}
            </Button>
          ) : undefined
        }
        toolbar={
          <Stack spacing={1.5} sx={{ width: '100%' }}>
            <Tabs
              value={tab}
              onChange={(_, v: TabKey) => changeTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
            >
              <Tab value="medicines" label={`Medicines (${medicines.length})`} />
              <Tab value="batches" label={`Batches (${batches.length})`} />
              <Tab value="suppliers" label={`Suppliers (${suppliers.length})`} />
              <Tab value="purchases" label={`Purchases (${purchases.length})`} />
              <Tab value="movements" label={`Movements (${movements.length})`} />
              <Tab value="categories" label={`Categories (${categories.length})`} />
            </Tabs>
            <SearchField
              value={search}
              onChange={(v) => { setSearch(v); setPage(0); }}
              placeholder={`Search ${tab}…`}
              sx={{ flex: 1, maxWidth: 360 }}
            />
          </Stack>
        }
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
      >
        {tab === 'medicines' && lowStock.length > 0 && (
          <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mx: 2, mt: 1.5, mb: 1 }}>
            <strong>{lowStock.length}</strong> low stock: {lowStock.slice(0, 5).map((m) => m.name).join(', ')}
            {lowStock.length > 5 ? ` +${lowStock.length - 5} more` : ''}
          </Alert>
        )}

        {tab === 'medicines' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Sale Price</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Min Alert</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={canManage ? 7 : 6} text="Loading medicines..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={canManage ? 7 : 6} text="No medicines found." />
              ) : (
                (paginated as InventoryMedicineRow[]).map((med) => {
                  const isLow = med.stock <= med.minStockAlert;
                  return (
                    <TableRow key={med.id} sx={tableSx.row}>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={13.5}>{med.name}</Typography>
                        {med.genericName && (
                          <Typography variant="caption" color="text.secondary" display="block">{med.genericName}</Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip label={med.category} size="small" sx={chipSx} /></TableCell>
                      <TableCell>{med.unit}</TableCell>
                      <TableCell align="right"><Typography fontWeight={600} fontSize={13.5}>{money(med.price)}</Typography></TableCell>
                      <TableCell align="right">
                        <Chip label={med.stock} size="small" color={isLow ? 'warning' : 'success'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{med.minStockAlert}</TableCell>
                      {canManage && (
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
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </>
        )}

        {tab === 'batches' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell>Batch #</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Purchase</TableCell>
                <TableCell align="right">Sale</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={6} text="Loading batches..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={6} text="No batches found." />
              ) : (
                (paginated as InventoryBatch[]).map((b) => {
                  const days = daysUntil(b.expiryDate);
                  const expiring = days <= 60;
                  const expired = days < 0;
                  return (
                    <TableRow key={b.id} sx={tableSx.row}>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={13.5}>{b.medicine?.name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>{b.batchNumber}</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <span>{new Date(b.expiryDate).toLocaleDateString()}</span>
                          {expired && <Chip label="Expired" size="small" color="error" sx={chipSx} />}
                          {!expired && expiring && <Chip label={`${days}d`} size="small" color="warning" sx={chipSx} />}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={b.quantity} size="small" color={b.quantity <= 0 ? 'default' : 'success'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{money(Number(b.purchasePrice))}</TableCell>
                      <TableCell align="right">{money(Number(b.salePrice))}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </>
        )}

        {tab === 'suppliers' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Purchases</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={5} text="Loading suppliers..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={5} text="No suppliers found." />
              ) : (
                (paginated as InventorySupplier[]).map((s) => (
                  <TableRow key={s.id} sx={tableSx.row}>
                    <TableCell><Typography fontWeight={600} fontSize={13.5}>{s.name}</Typography></TableCell>
                    <TableCell>{s.companyName || '—'}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell align="right">{s._count?.purchases ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        )}

        {tab === 'purchases' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={5} text="Loading purchases..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={5} text="No purchases found." />
              ) : (
                (paginated as InventoryPurchaseOrder[]).map((p) => (
                  <TableRow key={p.id} sx={tableSx.row}>
                    <TableCell><Typography fontWeight={600} fontSize={13.5}>{p.invoiceNumber}</Typography></TableCell>
                    <TableCell>{p.supplier?.name ?? '—'}</TableCell>
                    <TableCell>{new Date(p.purchaseDate).toLocaleDateString()}</TableCell>
                    <TableCell align="right">{p.items?.length ?? 0}</TableCell>
                    <TableCell align="right"><Typography fontWeight={600}>{money(Number(p.totalAmount))}</Typography></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        )}

        {tab === 'movements' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Medicine / Batch</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Reference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={5} text="Loading movements..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={5} text="No stock movements yet." />
              ) : (
                (paginated as InventoryStockMovement[]).map((m) => (
                  <TableRow key={m.id} sx={tableSx.row}>
                    <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600} fontSize={13.5}>{m.batch?.medicine?.name ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.batch?.batchNumber}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={m.type}
                        size="small"
                        color={m.quantity < 0 ? 'warning' : 'success'}
                        variant="outlined"
                        sx={chipSx}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={m.quantity < 0 ? 'error.main' : 'success.main'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell>{m.reference || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        )}

        {tab === 'categories' && (
          <>
            <TableHead sx={tableSx.head}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Medicines</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <EmptyRow cols={3} text="Loading categories..." />
              ) : paginated.length === 0 ? (
                <EmptyRow cols={3} text="No categories found." />
              ) : (
                (paginated as InventoryCategory[]).map((c) => (
                  <TableRow key={c.id} sx={tableSx.row}>
                    <TableCell><Typography fontWeight={600} fontSize={13.5}>{c.name}</Typography></TableCell>
                    <TableCell>{c.description || '—'}</TableCell>
                    <TableCell align="right">{c._count?.medicines ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        )}
      </TablePageShell>

      {canManage && editMed !== undefined && (
        <StockDialog medicine={editMed} onClose={() => setEditMed(undefined)} />
      )}
      {canManage && batchOpen && <BatchDialog onClose={() => setBatchOpen(false)} />}
      {canManage && supplierOpen && <SupplierDialog onClose={() => setSupplierOpen(false)} />}
      {canManage && purchaseOpen && <PurchaseDialog onClose={() => setPurchaseOpen(false)} />}
      {canManage && movementOpen && <MovementDialog onClose={() => setMovementOpen(false)} />}
      {canManage && categoryOpen && <CategoryDialog onClose={() => setCategoryOpen(false)} />}
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

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
        {text}
      </TableCell>
    </TableRow>
  );
}
