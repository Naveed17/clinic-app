import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { patientsService } from '@/services/patients.service';
import type { Patient } from '@/types/patient';
import { PatientDialog } from './PatientDialog';
import { PatientHistoryDialog } from './PatientHistoryDialog';

export function PatientsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogPatient, setDialogPatient] = useState<Patient | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deletePatient, setDeletePatient] = useState<Patient | undefined>();
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();

  const patientsQuery = useQuery({
    queryKey: ['patients', { page, rowsPerPage, search: deferredSearch }],
    queryFn: () => patientsService.list({ page: page + 1, pageSize: rowsPerPage, search: deferredSearch }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsService.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeletePatient(undefined);
    },
  });

  const openCreate = () => { setDialogPatient(undefined); setDialogOpen(true); };
  const openEdit = (patient: Patient) => { setDialogPatient(patient); setDialogOpen(true); };
  const patients = patientsQuery.data?.data ?? [];

  return (
    <>
      <TablePageShell
        title="Patients"
        subtitle="Manage patient records and contact details."
        action={
          <Button onClick={openCreate} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>
            Add patient
          </Button>
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search by name, phone, or email"
            sx={{ flex: 1, maxWidth: 360 }}
          />
        }
        error={patientsQuery.isError && (
          <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load patients.</Alert>
        )}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Date of birth</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patientsQuery.isLoading ? (
            <TableRow><TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Loading patients...</TableCell></TableRow>
          ) : patients.length === 0 ? (
            <TableRow><TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No patients found.</TableCell></TableRow>
          ) : (
            patients.map((patient) => (
              <TableRow key={patient.id} sx={tableSx.row}>
                <TableCell>
                  <Typography fontSize={13.5} fontWeight={600}>{patient.firstName} {patient.lastName}</Typography>
                </TableCell>
                <TableCell>{patient.phone ?? '—'}</TableCell>
                <TableCell>{patient.email ?? '—'}</TableCell>
                <TableCell>{patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" gap={0.5} justifyContent="flex-end">
                    <Tooltip title="View profile">
                      <IconButton sx={actionBtnSx} onClick={() => navigate(`/patients/${patient.id}`)}><PersonOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="View history">
                      <IconButton sx={actionBtnSx} onClick={() => setHistoryPatient(patient)}><HistoryOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton sx={actionBtnSx} onClick={() => openEdit(patient)}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton sx={{ ...actionBtnSx, '&:hover': { bgcolor: 'error.lighter', color: 'error.main' } }} onClick={() => setDeletePatient(patient)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </TablePageShell>

      <TablePager
        page={page}
        rowsPerPage={rowsPerPage}
        total={patientsQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      <PatientDialog open={isDialogOpen} patient={dialogPatient} onClose={() => setDialogOpen(false)} />
      {historyPatient && <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />}

      <Dialog open={Boolean(deletePatient)} onClose={() => setDeletePatient(undefined)}>
        <DialogTitle>Delete patient?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete {deletePatient?.firstName} {deletePatient?.lastName}? This action cannot be undone.
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>Unable to delete this patient. Linked records may need to be removed first.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeletePatient(undefined)}>Cancel</Button>
          <Button color="error" disabled={deleteMutation.isPending} onClick={() => deletePatient && deleteMutation.mutate(deletePatient.id)} variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
