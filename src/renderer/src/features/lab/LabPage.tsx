import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  TableCellLayout,
  Text,
  Textarea,
  Tooltip,
  createTableColumn,
  makeStyles,
  tokens,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Beaker24Regular,
  BeakerEdit24Regular,
  Eye24Regular,
  Print24Regular,
} from '@fluentui/react-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import type { LabOrder, LabOrderStatus } from '@/types/lab';
import {
  actionBtnStyle,
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { LabReportPrint } from './LabReportPrint';
import { LabReportBuilderDialog } from './LabReportBuilderDialog';
import { LAB_TEST_OPTIONS } from './labTestCatalog';
import { labReportNumber } from './labReportNumber';
import { DoctorAvatar } from '@/components/DoctorAvatar';

type BadgeColor = 'warning' | 'brand' | 'success' | 'danger' | 'subtle';

const statusColor: Record<LabOrderStatus, BadgeColor> = {
  PENDING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const useStyles = makeStyles({
  surface: {
    maxWidth: '420px',
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
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    width: '100%',
  },
  statusFilter: {
    minWidth: '150px',
  },
  chips: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    marginLeft: 'auto',
  },
  personCell: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  personMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  name: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  muted: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  testCell: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  reportNo: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    fontFamily: 'ui-monospace, Consolas, monospace',
    letterSpacing: '0.02em',
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalXXS,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  errorBar: {
    marginLeft: tokens.spacingHorizontalL,
    marginRight: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalS,
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
});

export function LabPage(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const isLabTech = user?.role === 'lab_technician';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [builderOrder, setBuilderOrder] = useState<LabOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null);
  const [form, setForm] = useState({ patientId: '', test: '', notes: '' });

  const { data: orders = [], isLoading, isFetching, isError } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders'],
    queryFn: () => window.clinic.lab.list(),
    refetchInterval: 15_000,
  });

  const { data: patients = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ['lab-patients'],
    queryFn: () => window.clinic.lab.patients(),
    enabled: dialogOpen,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lab-orders'] });

  const createMutation = useMutation({
    mutationFn: () =>
      window.clinic.lab.create({
        patientId: form.patientId,
        orderedById: user!.id,
        test: form.test,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ patientId: '', test: '', notes: '' });
      setDialogOpen(false);
    },
    meta: { toast: 'Lab order created', errorToast: 'Unable to create lab order.' },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      window.clinic.lab.updateStatus(id, status),
    onSuccess: invalidate,
    meta: { toast: 'Lab status updated' },
  });

  const filtered = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    const reportNo = labReportNumber(order.id).toLowerCase();
    const needle = q.replace(/[^a-z0-9]/g, '');
    const matchSearch =
      !q ||
      order.patientName.toLowerCase().includes(q) ||
      reportNo.includes(needle) ||
      reportNo.replace(/^lab/, '').includes(needle.replace(/^lab/, ''));
    const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const completed = orders.filter((o) => o.status === 'COMPLETED').length;

  const patientLabel =
    patients.find((p) => p.id === form.patientId)
      ? `${patients.find((p) => p.id === form.patientId)!.firstName} ${patients.find((p) => p.id === form.patientId)!.lastName}`
      : '';

  const columns = useMemo<TableColumnDefinition<LabOrder>[]>(
    () => [
      createTableColumn<LabOrder>({
        columnId: 'patient',
        compare: (a, b) => a.patientName.localeCompare(b.patientName),
        renderHeaderCell: () => 'Patient',
        renderCell: (order) => (
          <TableCellLayout media={<Avatar name={order.patientName} color="brand" size={32} />}>
            <div className={styles.personMeta}>
              <Text className={styles.name}>{order.patientName}</Text>
              <Text className={styles.muted}>{order.patientPhone?.trim() || '—'}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<LabOrder>({
        columnId: 'test',
        compare: (a, b) => a.test.localeCompare(b.test),
        renderHeaderCell: () => 'Test',
        renderCell: (order) => (
          <div className={styles.testCell}>
            <Beaker24Regular style={{ fontSize: 16 }} />
            {order.test}
          </div>
        ),
      }),
      createTableColumn<LabOrder>({
        columnId: 'reportNo',
        compare: (a, b) => labReportNumber(a.id).localeCompare(labReportNumber(b.id)),
        renderHeaderCell: () => 'Report no.',
        renderCell: (order) => <Text className={styles.reportNo}>{labReportNumber(order.id)}</Text>,
      }),
      createTableColumn<LabOrder>({
        columnId: 'orderedBy',
        compare: (a, b) => a.orderedByName.localeCompare(b.orderedByName),
        renderHeaderCell: () => 'Ordered by',
        renderCell: (order) => (
          <TableCellLayout media={<DoctorAvatar name={order.orderedByName} size={28} />}>
            <div className={styles.personMeta}>
              <Text size={300}>{order.orderedByName}</Text>
              <Text className={styles.muted}>Doctor</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<LabOrder>({
        columnId: 'orderedAt',
        compare: (a, b) => a.orderedAt.localeCompare(b.orderedAt),
        renderHeaderCell: () => 'Date & time',
        renderCell: (order) => (
          <Text className={styles.nowrap} size={300}>
            {new Date(order.orderedAt).toLocaleString()}
          </Text>
        ),
      }),
      createTableColumn<LabOrder>({
        columnId: 'status',
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => 'Status',
        renderCell: (order) => (
          <Badge appearance="tint" color={statusColor[order.status]} size="small">
            {order.status.replace('_', ' ')}
          </Badge>
        ),
      }),
      createTableColumn<LabOrder>({
        columnId: 'actions',
        renderHeaderCell: () => 'Actions',
        renderCell: (order) => (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <Tooltip content="View details" relationship="label">
              <Button
                appearance="subtle"
                icon={<Eye24Regular />}
                style={actionBtnStyle}
                onClick={() => navigate(`/lab/${order.id}`)}
              />
            </Tooltip>
            {order.status === 'COMPLETED' && (
              <Tooltip content="Print report" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Print24Regular />}
                  style={actionBtnStyle}
                  onClick={() => setPrintOrder(order)}
                />
              </Tooltip>
            )}
            {(isLabTech || isDoctor || isAdmin) &&
              (order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') && (
                <Tooltip
                  content={order.status === 'COMPLETED' ? 'Open report' : 'Build report'}
                  relationship="label"
                >
                  <Button
                    appearance={order.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                    size="small"
                    icon={<BeakerEdit24Regular />}
                    onClick={() => setBuilderOrder(order)}
                  >
                    {order.status === 'IN_PROGRESS' ? 'Build report' : 'Open report'}
                  </Button>
                </Tooltip>
              )}
            {isLabTech && order.status === 'PENDING' && (
              <Button
                appearance="secondary"
                size="small"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: order.id, status: 'IN_PROGRESS' })}
              >
                Start
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [isAdmin, isDoctor, isLabTech, navigate, statusMutation, styles],
  );

  return (
    <>
      <TablePageShell
        title="Lab Orders"
        subtitle="Manage lab test orders and results."
        {...(isLabTech && {
          action: (
            <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>
              New order
            </Button>
          ),
        })}
        toolbar={
          <div className={styles.toolbar}>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              placeholder="Search by patient or report no."
            />
            <Dropdown
              className={styles.statusFilter}
              value={
                filterStatus === 'ALL'
                  ? 'All'
                  : filterStatus === 'IN_PROGRESS'
                    ? 'In progress'
                    : filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase().replace('_', ' ')
              }
              selectedOptions={[filterStatus]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  setFilterStatus(data.optionValue);
                  setPage(0);
                }
              }}
            >
              <Option value="ALL" text="All">All</Option>
              <Option value="PENDING" text="Pending">Pending</Option>
              <Option value="IN_PROGRESS" text="In progress">In progress</Option>
              <Option value="COMPLETED" text="Completed">Completed</Option>
              <Option value="CANCELLED" text="Cancelled">Cancelled</Option>
            </Dropdown>
            <div className={styles.chips}>
              <Badge appearance="outline" color="warning" size="medium">{pending} Pending</Badge>
              <Badge appearance="outline" color="brand" size="medium">{inProgress} In progress</Badge>
              <Badge appearance="outline" color="success" size="medium">{completed} Completed</Badge>
            </div>
          </div>
        }
        error={
          isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Failed to load lab orders.</MessageBarBody>
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
          <TableRowsSkeleton cols={7} />
        ) : (
          <DataGridTable
            items={paginated}
            columns={columns}
            getRowId={(o) => o.id}
            emptyMessage="No lab orders found."
            onRowClick={(order) => navigate(`/lab/${order.id}`)}
          />
        )}
      </TablePageShell>

      <Dialog
        open={dialogOpen}
        onOpenChange={(_, data) => {
          if (!data.open) setDialogOpen(false);
        }}
      >
        <DialogSurface className={styles.surface}>
          <FormDialogTitle title="New Lab Order" subtitle="Create a lab test order for a patient." />
          <div className={styles.form}>
            <DialogBody>
              <DialogContent className={styles.body}>
                <div className={styles.fields}>
                  <Field label="Patient">
                    <Dropdown
                      placeholder="Select patient"
                      value={patientLabel}
                      selectedOptions={form.patientId ? [form.patientId] : []}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setForm((f) => ({ ...f, patientId: data.optionValue! }));
                        }
                      }}
                    >
                      {patients.map((p) => (
                        <Option key={p.id} value={p.id} text={`${p.firstName} ${p.lastName}`}>
                          {p.firstName} {p.lastName}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Test">
                    <Dropdown
                      placeholder="Select test"
                      value={form.test}
                      selectedOptions={form.test ? [form.test] : []}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setForm((f) => ({ ...f, test: data.optionValue! }));
                        }
                      }}
                    >
                      {LAB_TEST_OPTIONS.map((test) => (
                        <Option key={test} value={test} text={test}>
                          {test}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Notes (optional)">
                    <Textarea
                      rows={2}
                      value={form.notes}
                      onChange={(_, data) => setForm((f) => ({ ...f, notes: data.value }))}
                    />
                  </Field>
                </div>
              </DialogContent>
            </DialogBody>
            <DialogActions className={styles.actionsBar}>
              <Button
                appearance="secondary"
                onClick={() => setDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <SubmitButton
                disabled={!form.patientId || !form.test}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Create order
              </SubmitButton>
            </DialogActions>
          </div>
        </DialogSurface>
      </Dialog>

      {builderOrder && (
        <LabReportBuilderDialog
          order={builderOrder}
          onClose={() => setBuilderOrder(null)}
          onSaved={() => {
            invalidate();
            setBuilderOrder(null);
          }}
        />
      )}

      {printOrder && <LabReportPrint order={printOrder} onClose={() => setPrintOrder(null)} />}
    </>
  );
}
