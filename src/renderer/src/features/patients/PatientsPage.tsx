import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import type { Patient } from '@/types/patient';
import { PatientDialog } from './PatientDialog';
import { PatientHistoryDialog } from './PatientHistoryDialog';

export function PatientsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const isLabTech = user?.role === 'lab_technician';
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
    queryFn: () => patientsService.list({ page: page + 1, pageSize: rowsPerPage, search: deferredSearch, providerId: isDoctor ? user?.id : undefined }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsService.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeletePatient(undefined);
    },
  });

  const theme = useTheme();
  const openCreate = () => { setDialogPatient(undefined); setDialogOpen(true); };
  const openEdit = (patient: Patient) => { setDialogPatient(patient); setDialogOpen(true); };
  const patients = patientsQuery.data?.data ?? [];

  const getInitials = (first: string, last: string) =>
    `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <>
      <TablePageShell
        title="Patients"
        subtitle="Manage patient records and contact details."
        {...(!isLabTech && {
          action: (
            <Button onClick={openCreate} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>
              Add patient
            </Button>
          )
        })}

        toolbar={
          <SearchField
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search by name, phone, or email"
            sx={{ flex: 1, maxWidth: 360 }}
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
        error={patientsQuery.isError && (
          <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load patients.</Alert>
        )}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Date of Birth</TableCell>
            <TableCell>Blood Group</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Emergency Contact</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patientsQuery.isLoading ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Loading patients...</TableCell></TableRow>
          ) : patients.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No patients found.</TableCell></TableRow>
          ) : (
            patients.map((patient) => {
              const color = getAvatarColor(patient.firstName);
              return (
                <TableRow key={patient.id} sx={tableSx.row}>
                  {/* Avatar + Name + extra info */}
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 38, height: 38, fontSize: 13, fontWeight: 700,
                          bgcolor: alpha(color, 0.15), color, flexShrink: 0,
                        }}
                      >
                        {getInitials(patient.firstName, patient.lastName)}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600} lineHeight={1.3}>
                          {patient.firstName} {patient.lastName}
                        </Typography>
                        <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mt: 0.4 }}>
                          {patient.allergies && (
                            <Chip
                              label={`⚠ ${patient.allergies}`}
                              size="small"
                              sx={{ fontSize: 10, height: 18, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', fontWeight: 600 }}
                            />
                          )}
                          {patient.chronicConditions && (
                            <Chip
                              label={patient.chronicConditions}
                              size="small"
                              sx={{ fontSize: 10, height: 18, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main', fontWeight: 600 }}
                            />
                          )}
                          {!patient.allergies && !patient.chronicConditions && (
                            <Typography fontSize={11} color="text.secondary">No conditions noted</Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* Phone + Email */}
                  <TableCell>
                    <Typography fontSize={13}>{patient.phone ?? '—'}</Typography>
                    {patient.email && (
                      <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.3 }}>{patient.email}</Typography>
                    )}
                  </TableCell>

                  {/* DOB */}
                  <TableCell>
                    <Typography fontSize={13}>
                      {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
                    </Typography>
                  </TableCell>

                  {/* Blood Group */}
                  <TableCell>
                    {patient.bloodGroup ? (
                      <Chip
                        label={patient.bloodGroup}
                        size="small"
                        sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', borderRadius: 1 }}
                      />
                    ) : '—'}
                  </TableCell>

                  {/* Address */}
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Typography fontSize={12} color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                      {patient.address ?? '—'}
                    </Typography>
                  </TableCell>

                  {/* Emergency Contact */}
                  <TableCell>
                    {patient.emergencyContactName ? (
                      <Box>
                        <Typography fontSize={13} fontWeight={500}>{patient.emergencyContactName}</Typography>
                        <Typography fontSize={11} color="text.secondary">{patient.emergencyContactPhone ?? ''}</Typography>
                      </Box>
                    ) : '—'}
                  </TableCell>

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
              );
            })
          )}
        </TableBody>
      </TablePageShell>

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
