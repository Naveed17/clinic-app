import {
  Avatar,
  Badge,
  Button,
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
  History24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
  actionBtnStyle,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog } from '@/components/DialogUI';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import type { Patient } from '@/types/patient';
import { PatientDialog } from './PatientDialog';
import { PatientHistoryDialog } from './PatientHistoryDialog';

const useStyles = makeStyles({
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
  ellipsis: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
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
});

export function PatientsPage(): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = useLicense();
  const canViewRecords = can('managePatients');
  const isDoctor = user?.role === 'doctor';
  const isLabTech = user?.role === 'lab_technician';
  const isAdmin = user?.role === 'admin';
  const canManagePatients = canViewRecords && !isAdmin && !isLabTech;
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogPatient, setDialogPatient] = useState<Patient | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deletePatient, setDeletePatient] = useState<Patient | undefined>();
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();

  const patientsQuery = useQuery({
    queryKey: ['patients', { page, rowsPerPage, search: deferredSearch, providerId: isDoctor ? user?.id : undefined }],
    queryFn: () =>
      patientsService.list({
        page: page + 1,
        pageSize: rowsPerPage,
        search: deferredSearch,
        providerId: isDoctor ? user?.id : undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsService.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeletePatient(undefined);
    },
    meta: { toast: 'Patient deleted', errorToast: 'Unable to delete this patient.' },
  });

  const openCreate = () => {
    setDialogPatient(undefined);
    setDialogOpen(true);
  };
  const openEdit = (patient: Patient) => {
    setDialogPatient(patient);
    setDialogOpen(true);
  };
  const patients = patientsQuery.data?.data ?? [];

  const columns = useMemo<TableColumnDefinition<Patient>[]>(
    () => [
      createTableColumn<Patient>({
        columnId: 'patient',
        compare: (a, b) => a.lastName.localeCompare(b.lastName),
        renderHeaderCell: () => 'Patient',
        renderCell: (patient) => (
          <TableCellLayout
            media={
              <Avatar name={`${patient.firstName} ${patient.lastName}`} color="colorful" size={32} />
            }
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>
                {patient.firstName} {patient.lastName}
              </Text>
              <Text className={styles.muted}>{patient.phone?.trim() || '—'}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Patient>({
        columnId: 'allergies',
        compare: (a, b) => (a.allergies ?? '').localeCompare(b.allergies ?? ''),
        renderHeaderCell: () => 'Allergies',
        renderCell: (patient) =>
          patient.allergies ? (
            <Badge appearance="tint" color="danger" size="small">
              {patient.allergies}
            </Badge>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<Patient>({
        columnId: 'chronic',
        compare: (a, b) => (a.chronicConditions ?? '').localeCompare(b.chronicConditions ?? ''),
        renderHeaderCell: () => 'Chronic conditions',
        renderCell: (patient) =>
          patient.chronicConditions ? (
            <Badge appearance="tint" color="informative" size="small">
              {patient.chronicConditions}
            </Badge>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<Patient>({
        columnId: 'dob',
        compare: (a, b) => String(a.dateOfBirth ?? '').localeCompare(String(b.dateOfBirth ?? '')),
        renderHeaderCell: () => 'Date of Birth',
        renderCell: (patient) => (
          <Text size={300}>
            {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
          </Text>
        ),
      }),
      createTableColumn<Patient>({
        columnId: 'blood',
        compare: (a, b) => (a.bloodGroup ?? '').localeCompare(b.bloodGroup ?? ''),
        renderHeaderCell: () => 'Blood Group',
        renderCell: (patient) =>
          patient.bloodGroup ? (
            <Badge appearance="tint" color="danger" size="small">
              {patient.bloodGroup}
            </Badge>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<Patient>({
        columnId: 'address',
        compare: (a, b) => (a.address ?? '').localeCompare(b.address ?? ''),
        renderHeaderCell: () => 'Address',
        renderCell: (patient) => <Text className={styles.ellipsis}>{patient.address ?? '—'}</Text>,
      }),
      createTableColumn<Patient>({
        columnId: 'emergency',
        compare: (a, b) =>
          (a.emergencyContactName ?? '').localeCompare(b.emergencyContactName ?? ''),
        renderHeaderCell: () => 'Emergency Contact',
        renderCell: (patient) =>
          patient.emergencyContactName ? (
            <div className={styles.personMeta}>
              <Text weight="semibold" size={300}>
                {patient.emergencyContactName}
              </Text>
              <Text className={styles.muted}>{patient.emergencyContactPhone ?? ''}</Text>
            </div>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<Patient>({
        columnId: 'actions',
        renderHeaderCell: () => 'Actions',
        renderCell: (patient) => (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            {canViewRecords && (
              <>
                <Tooltip content="View profile" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Person24Regular />}
                    style={actionBtnStyle}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  />
                </Tooltip>
                <Tooltip content="View history" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<History24Regular />}
                    style={actionBtnStyle}
                    onClick={() => setHistoryPatient(patient)}
                  />
                </Tooltip>
              </>
            )}
            {canManagePatients && (
              <>
                <Tooltip content="Edit" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    style={actionBtnStyle}
                    onClick={() => openEdit(patient)}
                  />
                </Tooltip>
                <Tooltip content="Delete" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    style={actionBtnStyle}
                    onClick={() => setDeletePatient(patient)}
                  />
                </Tooltip>
              </>
            )}
          </div>
        ),
      }),
    ],
    [canManagePatients, canViewRecords, navigate, styles],
  );

  return (
    <>
      <TablePageShell
        title="Patients"
        subtitle="Manage patient records and contact details."
        {...(canManagePatients && {
          action: (
            <Button appearance="primary" icon={<Add24Regular />} onClick={openCreate}>
              Add patient
            </Button>
          ),
        })}
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Search by name, phone, or email"
          />
        }
        pager={
          (patientsQuery.data?.total ?? 0) > rowsPerPage ? (
            <TablePager
              page={page}
              rowsPerPage={rowsPerPage}
              total={patientsQuery.data?.total ?? 0}
              onPageChange={setPage}
            />
          ) : undefined
        }
        error={
          patientsQuery.isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load patients.</MessageBarBody>
            </MessageBar>
          )
        }
        fetching={patientsQuery.isFetching && !patientsQuery.isLoading}
      >
        {patientsQuery.isLoading ? (
          <TableRowsSkeleton cols={8} />
        ) : (
          <DataGridTable
            items={patients}
            columns={columns}
            getRowId={(p) => p.id}
            emptyMessage="No patients found."
          />
        )}
      </TablePageShell>

      <PatientDialog open={isDialogOpen} patient={dialogPatient} onClose={() => setDialogOpen(false)} />
      {canViewRecords && historyPatient && (
        <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />
      )}

      <ConfirmDialog
        open={Boolean(deletePatient)}
        title="Delete patient?"
        message={
          deletePatient
            ? `Delete ${deletePatient.firstName} ${deletePatient.lastName}? This also removes their appointments, tokens, prescriptions, invoices/payments, lab orders, and documents.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        error={
          deleteMutation.isError ? (
            <MessageBar intent="error" className={styles.deleteError}>
              <MessageBarBody>Unable to delete this patient. Please try again.</MessageBarBody>
            </MessageBar>
          ) : undefined
        }
        onClose={() => setDeletePatient(undefined)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
      />
    </>
  );
}
