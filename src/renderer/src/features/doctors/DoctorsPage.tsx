import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { doctorsService } from '@/services/doctors.service';
import { useAuth } from '@/features/auth/AuthContext';
import type { Doctor, DoctorInput, DoctorUpdateInput } from '@/types/doctor';
import { tableSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps, telInputDialogProps,
} from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { DoctorAvatar, DoctorAvatarPicker } from '@/components/DoctorAvatar';

const baseSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  isActive: z.boolean(),
  specialization: z.string().trim().min(1, 'Specialization is required.'),
  qualification: z.string().trim(),
  experienceYears: z.coerce.number().int().min(0).max(60),
  consultationFee: z.coerce.number().min(0),
  phone: z.string().trim(),
  bio: z.string().trim(),
});

type FormValues = z.infer<typeof baseSchema> & { password: string };

const createSchema: z.ZodType<FormValues> = baseSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const editSchema: z.ZodType<FormValues> = baseSchema.extend({
  password: z.string().refine((v) => !v || v.length >= 6, 'Password must be at least 6 characters.'),
});

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  isActive: true,
  specialization: '',
  qualification: '',
  experienceYears: 0,
  consultationFee: 0,
  phone: '',
  bio: '',
};

function toFormValues(doctor?: Doctor): FormValues {
  if (!doctor) return emptyValues;
  return {
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    password: '',
    isActive: doctor.isActive,
    specialization: doctor.doctorProfile?.specialization ?? '',
    qualification: doctor.doctorProfile?.qualification ?? '',
    experienceYears: doctor.doctorProfile?.experienceYears ?? 0,
    consultationFee: Number(doctor.doctorProfile?.consultationFee ?? 0),
    phone: doctor.doctorProfile?.phone ?? '',
    bio: doctor.doctorProfile?.bio ?? '',
  };
}

function DoctorDialog({ doctor, open, onClose }: { doctor?: Doctor; open: boolean; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const isEditing = Boolean(doctor);
  const schema: z.ZodType<FormValues> = isEditing ? editSchema : createSchema;

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver<FormValues, unknown, FormValues>(schema as any),
    defaultValues: emptyValues,
  });

  const [showPw, setShowPw] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const profile = {
        specialization: values.specialization,
        qualification: values.qualification || undefined,
        experienceYears: values.experienceYears,
        consultationFee: values.consultationFee,
        phone: values.phone || undefined,
        bio: values.bio || undefined,
        avatar,
      };
      if (doctor) {
        const input: DoctorUpdateInput = {
          firstName: values.firstName, lastName: values.lastName,
          email: values.email, isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
          ...profile,
        };
        return doctorsService.update(doctor.id, input);
      }
      return doctorsService.create({ ...values, ...profile } as DoctorInput);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      onClose();
    },
    meta: {
      toast: doctor ? 'Doctor updated' : 'Doctor created',
      errorToast: 'Unable to save doctor.',
    },
  });
  const handleSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(doctor));
      setShowPw(false);
      setAvatar(doctor?.doctorProfile?.avatar ?? null);
    }
  }, [form, open, doctor]);

  const { errors } = form.formState;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps} {...telInputDialogProps}>
      <FormDialogTitle
        title={isEditing ? 'Edit doctor' : 'Add doctor'}
        subtitle={isEditing ? 'Update doctor profile and account.' : 'Register a new doctor account.'}
      />
      <Box
        component="form"
        onSubmit={form.handleSubmit(handleSubmit)}
        sx={dialogFormSx}
      >
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            {mutation.isError && <Alert severity="error">Unable to save. Please try again.</Alert>}

            <Typography variant="subtitle2" color="text.secondary">Account</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField autoFocus fullWidth label="First name" error={Boolean(errors.firstName)} helperText={errors.firstName?.message} {...form.register('firstName')} />
              <TextField fullWidth label="Last name" error={Boolean(errors.lastName)} helperText={errors.lastName?.message} {...form.register('lastName')} />
            </Box>
            <TextField fullWidth label="Email" type="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...form.register('email')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label={isEditing ? 'New password (leave blank to keep)' : 'Password'} type={showPw ? 'text' : 'password'} error={Boolean(errors.password)} helperText={errors.password?.message} {...form.register('password')}
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw(v => !v)} edge="end">{showPw ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}</IconButton></InputAdornment> } }}
              />
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={field.value} onChange={field.onChange} />} label="Active" />
                )}
              />
            </Box>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Doctor Profile</Typography>
            <DoctorAvatarPicker value={avatar} onChange={setAvatar} />

            <TextField fullWidth label="Specialization" error={Boolean(errors.specialization)} helperText={errors.specialization?.message} {...form.register('specialization')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label="Qualification (e.g. MBBS, MD)" {...form.register('qualification')} />
              <TextField
                fullWidth
                label="Experience (years)"
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 60, step: 1 } }}
                {...form.register('experienceYears', {
                  setValueAs: (value) => (value === '' ? 0 : Number(value)),
                })}
              />
            </Box>
            <TextField
              fullWidth
              label="Consultation fee"
              type="number"
              slotProps={{
                htmlInput: { min: 0, step: 'any' },
                input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> },
              }}
              {...form.register('consultationFee', {
                setValueAs: (value) => (value === '' ? 0 : Number(value)),
              })}
            />
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInputField label="Contact phone" value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
            <TextField fullWidth label="Bio" multiline minRows={2} {...form.register('bio')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>
            {isEditing ? 'Save changes' : 'Add doctor'}
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function DoctorsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogDoctor, setDialogDoctor] = useState<Doctor | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deleteDoctor, setDeleteDoctor] = useState<Doctor | undefined>();

  const doctorsQuery = useQuery({
    queryKey: ['doctors', { page, rowsPerPage, search: debouncedSearch }],
    queryFn: () => doctorsService.list({ page: page + 1, pageSize: rowsPerPage, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorsService.delete(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['doctors'] }); setDeleteDoctor(undefined); },
    meta: { toast: 'Doctor deleted', errorToast: 'Unable to delete this doctor.' },
  });
  const doctors = doctorsQuery.data?.data ?? [];

  return (
    <>
      <TablePageShell
        title="Doctors"
        subtitle="Manage doctor accounts and profiles."
        action={
          <Button onClick={() => { setDialogDoctor(undefined); setDialogOpen(true); }} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>Add doctor</Button>
        }
        toolbar={<SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search by name, email, or specialization" sx={{ flex: 1, maxWidth: 360 }} />}
        pager={
          (doctorsQuery.data?.total ?? 0) > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={doctorsQuery.data?.total ?? 0} onPageChange={setPage} />
          ) : undefined
        }
        error={doctorsQuery.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load doctors.</Alert>}
        fetching={doctorsQuery.isFetching && !doctorsQuery.isLoading}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Doctor</TableCell>
            <TableCell>Specialization</TableCell>
            <TableCell>Qualification</TableCell>
            <TableCell>Experience</TableCell>
            <TableCell>Fee</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {doctorsQuery.isLoading ? (
            <TableRowsSkeleton cols={7} />
          ) : doctors.length === 0 ? (
            <TableRow><TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No doctors found.</TableCell></TableRow>
          ) : (
            doctors.map((doc: Doctor) => {
              return (
                <TableRow key={doc.id} sx={tableSx.row}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <DoctorAvatar src={doc.doctorProfile?.avatar} name={`Dr. ${doc.firstName} ${doc.lastName}`} size={32} />
                      <Box>
                        <Typography fontSize={13.5} fontWeight={600}>Dr. {doc.firstName} {doc.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{doc.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{doc.doctorProfile?.specialization ?? '—'}</TableCell>
                  <TableCell>{doc.doctorProfile?.qualification ?? '—'}</TableCell>
                  <TableCell>{doc.doctorProfile ? `${doc.doctorProfile.experienceYears} yr${doc.doctorProfile.experienceYears !== 1 ? 's' : ''}` : '—'}</TableCell>
                  <TableCell>
                    {`Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(doc.doctorProfile?.consultationFee ?? 0))}`}
                  </TableCell>
                  <TableCell>
                    <Box sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1,
                      py: 0.25,
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: doc.isActive ? 'rgba(46,125,50,0.12)' : 'rgba(0,0,0,0.06)',
                      bgcolor: doc.isActive ? 'rgba(46,125,50,0.1)' : 'rgba(0,0,0,0.06)',
                    }}>
                      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: doc.isActive ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                      <Typography fontSize={12} fontWeight={600} color={doc.isActive ? 'success.dark' : 'text.secondary'}>{doc.isActive ? 'Active' : 'Inactive'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="View details"><IconButton sx={actionBtnSx} onClick={() => navigate(`/doctors/${doc.id}`)}><OpenInNewOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      <Tooltip title="Edit schedule"><IconButton sx={actionBtnSx} onClick={() => navigate(`/schedule?doctorId=${doc.id}`)}><CalendarMonthOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton sx={actionBtnSx} onClick={() => { setDialogDoctor(doc); setDialogOpen(true); }}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton sx={actionBtnSx} onClick={() => setDeleteDoctor(doc)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TablePageShell>
      <DoctorDialog open={isDialogOpen} doctor={dialogDoctor} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleteDoctor)}
        title="Delete doctor?"
        message={deleteDoctor ? `Delete Dr. ${deleteDoctor.firstName} ${deleteDoctor.lastName}?` : ''}
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Unable to delete. This doctor may have linked appointments.</Alert> : undefined}
        onClose={() => setDeleteDoctor(undefined)}
        onConfirm={() => deleteDoctor && deleteMutation.mutate(deleteDoctor.id)}
      />
    </>
  );
}
