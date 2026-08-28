import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import {
  Alert, Avatar, Box, Button, Chip, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { tableSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog } from '@/components/DialogUI';
import { patientsService } from '@/services/patients.service';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import type { Patient } from '@/types/patient';
import { PatientDialog } from './PatientDialog';
import { PatientHistoryDialog } from './PatientHistoryDialog';
import { calcAgeLabel, getAgeDisplayParts } from '@shared/patientAge';
import { formatTableDate } from '@/utils/formatDate';

export function PatientsPage(): React.JSX.Element {
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
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogPatient, setDialogPatient] = useState<Patient | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deletePatient, setDeletePatient] = useState<Patient | undefined>();
  const [historyPatient, setHistoryPatient] = useState<Patient | undefined>();

  const patientsQuery = useQuery({
    queryKey: ['patients', { page, rowsPerPage, search: debouncedSearch, providerId: isDoctor ? user?.id : undefined }],
    queryFn: () =>
      patientsService.list({
        page: page + 1,
        pageSize: rowsPerPage,
        search: debouncedSearch,
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

  const theme = useTheme();
  const openCreate = () => { setDialogPatient(undefined); setDialogOpen(true); };
  const openEdit = (patient: Patient) => { setDialogPatient(patient); setDialogOpen(true); };
  const rawPatients = patientsQuery.data?.data ?? [];
  const patients = useMemo(() => {
    return [...rawPatients].sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      const mrA = parseInt((a.mrNumber || '').replace(/\D/g, ''), 10) || 0;
      const mrB = parseInt((b.mrNumber || '').replace(/\D/g, ''), 10) || 0;
      return mrB - mrA;
    });
  }, [rawPatients]);

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
        {...(canManagePatients && {
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
        fetching={patientsQuery.isFetching && !patientsQuery.isLoading}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>MR #</TableCell>
            <TableCell>Chronic conditions</TableCell>
            <TableCell>Age</TableCell>
            <TableCell>Blood Group</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Emergency Contact</TableCell>
            <TableCell>Created At</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patientsQuery.isLoading ? (
            <TableRowsSkeleton cols={9} />
          ) : patients.length === 0 ? (
            <TableRow><TableCell colSpan={9} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No patients found.</TableCell></TableRow>
          ) : (
            patients.map((patient) => {
              const color = getAvatarColor(patient.firstName);
              return (
                <TableRow key={patient.id} sx={tableSx.row}>
                  {/* Avatar + Name + phone */}
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.25}>
                      <Avatar
                        sx={{
                          width: 34, height: 34, fontSize: 13, fontWeight: 700,
                          bgcolor: alpha(color, 0.15), color, flexShrink: 0,
                        }}
                      >
                        {getInitials(patient.firstName, patient.lastName)}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13.5} fontWeight={500} lineHeight={1.3}>
                          {patient.firstName} {patient.lastName}
                        </Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          {patient.phone?.trim() || '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* MR Number */}
                  <TableCell>
                    {patient.mrNumber ? (
                      <Chip
                        label={patient.mrNumber}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}
                      />
                    ) : (
                      <Typography fontSize={13.5} color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {/* Chronic conditions */}
                  <TableCell sx={{ maxWidth: 180 }}>
                    {patient.chronicConditions ? (
                      <Chip
                        label={patient.chronicConditions}
                        size="small"
                        sx={{ fontSize: 10, height: 18, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main', fontWeight: 600 }}
                      />
                    ) : (
                      <Typography fontSize={13.5} color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {/* Age */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      const parts = getAgeDisplayParts(patient.dateOfBirth, patient.age);
                      if (!parts) return <Typography fontSize={13} color="text.secondary">—</Typography>;
                      return (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, whiteSpace: 'nowrap' }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              flexShrink: 0,
                            }}
                          >
                            <CakeOutlinedIcon sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                            {parts.dateStr && (
                              <Typography
                                fontSize={13}
                                fontWeight={600}
                                sx={{
                                  fontVariantNumeric: 'tabular-nums',
                                  letterSpacing: '-0.01em',
                                  color: 'text.primary',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {parts.dateStr}
                              </Typography>
                            )}
                            <Typography
                              fontSize={11.5}
                              fontWeight={500}
                              sx={{
                                color: 'text.secondary',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {parts.ageText}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })()}
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {patient.address ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, whiteSpace: 'nowrap' }}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: alpha(theme.palette.secondary.main, 0.1),
                            color: 'secondary.main',
                            flexShrink: 0,
                          }}
                        >
                          <LocationOnOutlinedIcon sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Typography fontSize={13} fontWeight={500} color="text.primary" sx={{ whiteSpace: 'nowrap' }}>
                          {patient.address}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography fontSize={13} color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {/* Emergency Contact */}
                  <TableCell>
                    {patient.emergencyContactName ? (
                      <Box>
                        <Typography fontSize={13.5} fontWeight={500}>{patient.emergencyContactName}</Typography>
                        <Typography fontSize={11.5} color="text.secondary">{patient.emergencyContactPhone ?? ''}</Typography>
                      </Box>
                    ) : '—'}
                  </TableCell>

                  {/* Created At */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, whiteSpace: 'nowrap' }}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: 'info.main',
                          flexShrink: 0,
                        }}
                      >
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Typography fontSize={13} fontWeight={500} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatTableDate(patient.createdAt)}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                      {canViewRecords && (
                      <>
                      <Tooltip title="View profile">
                        <IconButton sx={actionBtnSx} onClick={() => navigate(`/patients/${patient.id}`)}><PersonOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="View history">
                        <IconButton sx={actionBtnSx} onClick={() => setHistoryPatient(patient)}><HistoryOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      </>
                      )}
                      {canManagePatients && (
                      <>
                      <Tooltip title="Edit">
                        <IconButton sx={actionBtnSx} onClick={() => openEdit(patient)}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton sx={{ ...actionBtnSx, '&:hover': { bgcolor: 'error.lighter', color: 'error.main' } }} onClick={() => setDeletePatient(patient)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TablePageShell>

      <PatientDialog open={isDialogOpen} patient={dialogPatient} onClose={() => setDialogOpen(false)} />
      {canViewRecords && historyPatient && <PatientHistoryDialog patient={historyPatient} onClose={() => setHistoryPatient(undefined)} />}

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
        error={deleteMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Unable to delete this patient. Please try again.</Alert> : undefined}
        onClose={() => setDeletePatient(undefined)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
      />
    </>
  );
}
