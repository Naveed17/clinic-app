import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  TableCellLayout,
  Text,
  Tooltip,
  createTableColumn,
  makeStyles,
  tokens,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Delete24Regular,
  Edit24Regular,
  Pill24Regular,
} from '@fluentui/react-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ConfirmDialog,
  FormDialogTitle,
  SubmitButton,
} from '@/components/DialogUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  DataGridTable,
  TablePager,
  TablePageShell,
  actionBtnStyle,
  SearchField,
} from '@/components/TableUI';
import { medicinesService } from '@/services/medicines.service';
import type { Medicine } from '@/types/medicine';

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

const useStyles = makeStyles({
  name: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  price: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalXXS,
    justifyContent: 'flex-end',
  },
  errorBar: {
    marginLeft: tokens.spacingHorizontalL,
    marginRight: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalS,
  },
  deleteError: {
    marginTop: tokens.spacingVerticalM,
  },
  surface: {
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionsBar: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
});

export function MedicinesPage(): React.JSX.Element {
  const styles = useStyles();
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

  const columns = useMemo<TableColumnDefinition<Medicine>[]>(() => {
    const colsDef: TableColumnDefinition<Medicine>[] = [
      createTableColumn<Medicine>({
        columnId: 'medicine',
        compare: (a, b) => a.name.localeCompare(b.name),
        renderHeaderCell: () => 'Medicine',
        renderCell: (med) => (
          <TableCellLayout media={<Avatar icon={<Pill24Regular />} color="brand" size={32} />}>
            <Text className={styles.name}>{med.name}</Text>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Medicine>({
        columnId: 'price',
        compare: (a, b) => a.price - b.price,
        renderHeaderCell: () => 'Price',
        renderCell: (med) => <Text className={styles.price}>{money(med.price)}</Text>,
      }),
      createTableColumn<Medicine>({
        columnId: 'updated',
        compare: (a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''),
        renderHeaderCell: () => 'Updated',
        renderCell: (med) => (
          <Text size={300}>
            {med.updatedAt
              ? new Date(med.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </Text>
        ),
      }),
    ];
    if (canManage) {
      colsDef.push(
        createTableColumn<Medicine>({
          columnId: 'actions',
          renderHeaderCell: () => 'Actions',
          renderCell: (med) => (
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <Tooltip content="Edit" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Edit24Regular />}
                  style={actionBtnStyle}
                  onClick={() => {
                    setEditing(med);
                    setDialogOpen(true);
                  }}
                />
              </Tooltip>
              <Tooltip content="Delete" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  style={actionBtnStyle}
                  onClick={() => setDeleteMed(med)}
                />
              </Tooltip>
            </div>
          ),
        }),
      );
    }
    return colsDef;
  }, [canManage, styles]);

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
              appearance="primary"
              icon={<Add24Regular />}
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              Add medicine
            </Button>
          ) : undefined
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Search by name"
          />
        }
        error={
          isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load medicines.</MessageBarBody>
            </MessageBar>
          )
        }
        fetching={isFetching && !isLoading}
        pager={
          filtered.length > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={filtered.length} onPageChange={setPage} />
          ) : undefined
        }
      >
        {isLoading ? (
          <TableRowsSkeleton cols={cols} />
        ) : (
          <DataGridTable
            items={paginated}
            columns={columns}
            getRowId={(m) => m.id}
            emptyMessage="No medicines found."
          />
        )}
      </TablePageShell>

      {canManage && dialogOpen && (
        <MedicineFormDialog
          key={editing?.id ?? 'new'}
          medicine={editing}
          onClose={() => {
            setDialogOpen(false);
            setEditing(undefined);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteMed)}
        title="Delete medicine?"
        message={
          deleteMed
            ? `Delete ${deleteMed.name} from the catalog? Existing invoices keep their billed items.`
            : ''
        }
        loading={deleteMutation.isPending}
        error={
          deleteMutation.isError ? (
            <MessageBar intent="error" className={styles.deleteError}>
              <MessageBarBody>Unable to delete this medicine.</MessageBarBody>
            </MessageBar>
          ) : undefined
        }
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
  const styles = useStyles();
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
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={isEdit ? 'Edit Medicine' : 'Add New Medicine'}
          subtitle={isEdit ? 'Update the name or sale price.' : 'Add a medicine to the catalog used on invoices.'}
        />
        <div className={styles.form}>
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {error ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                ) : null}
                <Field label="Medicine name">
                  <Input value={name} onChange={(_, data) => setName(data.value)} autoFocus />
                </Field>
                <Field label="Price">
                  <Input
                    type="number"
                    value={price}
                    onChange={(_, data) => setPrice(data.value)}
                    contentBefore={<Text size={200}>Rs.</Text>}
                    min={0}
                    step="any"
                  />
                </Field>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <SubmitButton
              icon={isEdit ? <Edit24Regular /> : <Add24Regular />}
              disabled={!name.trim()}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {isEdit ? 'Save' : 'Add Medicine'}
            </SubmitButton>
          </DialogActions>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
