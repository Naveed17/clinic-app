import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersService } from '@/services/users.service';
import type { User, UserInput, UserUpdateInput } from '@/types/user';
import { tableSx, chipSx, actionBtnSx, TablePageShell, SearchField, TablePager, Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  ConfirmDialog, FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps, telInputDialogProps,
} from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { DoctorAvatar, DoctorAvatarPicker, avatarFallbackFromRole } from '@/components/DoctorAvatar';
import { useLicense } from '@/features/auth/LicenseModulesContext';

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  LAB_TECHNICIAN: 'Lab Technician',
  PHARMACIST: 'Pharmacist',
};

const roleColors: Record<string, 'primary' | 'secondary' | 'default' | 'warning' | 'success'> = {
  ADMIN: 'primary',
  DOCTOR: 'secondary',
  RECEPTIONIST: 'default',
  LAB_TECHNICIAN: 'warning',
  PHARMACIST: 'success',
};

const doctorProfileSchema = z.object({
  specialization: z.string().trim(),
  qualification: z.string().trim(),
  experienceYears: z.number().min(0).max(60),
  phone: z.string().trim(),
  bio: z.string().trim(),
});

const baseSchema = {
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST']),
  isActive: z.boolean(),
  doctorProfile: doctorProfileSchema.optional(),
};

const doctorRefine = (val: { role: string; doctorProfile?: { specialization?: string } }, ctx: z.RefinementCtx) => {
  if (val.role === 'DOCTOR' && !val.doctorProfile?.specialization?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Specialization is required.', path: ['doctorProfile', 'specialization'] });
  }
};

const createSchema = z.object({ ...baseSchema, password: z.string().min(6, 'Password must be at least 6 characters.') }).superRefine(doctorRefine);
const editSchema = z.object({ ...baseSchema, password: z.string().refine((v) => !v || v.length >= 6, 'Password must be at least 6 characters.') }).superRefine(doctorRefine);

type FormValues = z.infer<typeof createSchema>;

const emptyFormValues: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'RECEPTIONIST',
  isActive: true,
  doctorProfile: { specialization: '', qualification: '', experienceYears: 0, phone: '', bio: '' },
};

function toFormValues(user?: User): FormValues {
  if (!user) return emptyFormValues;
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: '',
    role: user.role,
    isActive: user.isActive,
    doctorProfile: {
      specialization: user.doctorProfile?.specialization ?? '',
      qualification: user.doctorProfile?.qualification ?? '',
      experienceYears: user.doctorProfile?.experienceYears ?? 0,
      phone: user.doctorProfile?.phone ?? '',
      bio: user.doctorProfile?.bio ?? '',
    },
  };
}

function UserDialog({ user, open, onClose }: { user?: User; open: boolean; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const isEditing = Boolean(user);
  const { can } = useLicense();
  const canManageStaff = can('manageUsers');
  const form = useForm<FormValues>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: emptyFormValues,
  });

  const [showPw, setShowPw] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const role = form.watch('role');
  const isDoctor = role === 'DOCTOR';

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const doctorProfile = isDoctor && values.doctorProfile
        ? {
          specialization: values.doctorProfile.specialization,
          qualification: values.doctorProfile.qualification || undefined,
          experienceYears: values.doctorProfile.experienceYears,
          phone: values.doctorProfile.phone || undefined,
          bio: values.doctorProfile.bio || undefined,
          avatar,
        }
        : undefined;

      if (user) {
        const input: UserUpdateInput = {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          role: values.role,
          isActive: values.isActive,
          avatar,
          ...(values.password ? { password: values.password } : {}),
          doctorProfile,
        };
        return usersService.update(user.id, input);
      }
      return usersService.create({ ...values, avatar, doctorProfile } as UserInput);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    meta: {
      toast: user ? 'User updated' : 'User created',
      errorToast: 'Unable to save the user.',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(user));
      setShowPw(false);
      setAvatar(user?.avatar || user?.doctorProfile?.avatar || null);
    }
  }, [form, open, user]);

  const { errors } = form.formState;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps} {...telInputDialogProps}>
      <FormDialogTitle
        title={isEditing ? 'Edit user' : 'Add user'}
        subtitle={isEditing ? 'Update account role and access.' : 'Create a new staff account.'}
      />
      <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            {mutation.isError && <Alert severity="error">Unable to save the user. Please try again.</Alert>}

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField autoFocus fullWidth label="First name" error={Boolean(errors.firstName)} helperText={errors.firstName?.message} {...form.register('firstName')} />
              <TextField fullWidth label="Last name" error={Boolean(errors.lastName)} helperText={errors.lastName?.message} {...form.register('lastName')} />
            </Box>
            <TextField fullWidth label="Email" type="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...form.register('email')} />
            <TextField fullWidth label={isEditing ? 'New password (leave blank to keep current)' : 'Password'} type={showPw ? 'text' : 'password'} error={Boolean(errors.password)} helperText={errors.password?.message} {...form.register('password')}
              slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw(v => !v)} edge="end">{showPw ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}</IconButton></InputAdornment> } }}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormControl fullWidth error={Boolean(errors.role)}>
                    <InputLabel>Role</InputLabel>
                    <Select label="Role" {...field}>
                      {(canManageStaff || user?.role === 'ADMIN') && <MenuItem value="ADMIN">Admin</MenuItem>}
                      {can('doctorDashboard') && <MenuItem value="DOCTOR">Doctor</MenuItem>}
                      <MenuItem value="RECEPTIONIST">Receptionist</MenuItem>
                      {can('labDashboard') && <MenuItem value="LAB_TECHNICIAN">Lab Technician</MenuItem>}
                    </Select>
                    {errors.role && <FormHelperText>{errors.role.message}</FormHelperText>}
                  </FormControl>
                )}
              />
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={field.value} onChange={field.onChange} />} label="Active" />
                )}
              />
            </Box>

            <DoctorAvatarPicker
              value={avatar}
              onChange={setAvatar}
              name={`${form.watch('firstName')} ${form.watch('lastName')}`.trim()}
              fallback={avatarFallbackFromRole(role)}
            />

            {isDoctor && (
              <>
                <Divider />
                <Typography variant="subtitle2" color="text.secondary">Doctor Profile</Typography>
                <TextField
                  fullWidth
                  label="Specialization"
                  error={Boolean(errors.doctorProfile?.specialization)}
                  helperText={errors.doctorProfile?.specialization?.message}
                  {...form.register('doctorProfile.specialization')}
                />
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                  <TextField fullWidth label="Qualification (e.g. MBBS, MD)" {...form.register('doctorProfile.qualification')} />
                  <TextField fullWidth label="Experience (years)" type="number" slotProps={{ htmlInput: { min: 0, max: 60 } }} {...form.register('doctorProfile.experienceYears', { valueAsNumber: true })} />
                </Box>
                <Controller
                  control={form.control}
                  name="doctorProfile.phone"
                  render={({ field }) => (
                    <PhoneInputField label="Contact phone" value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
                <TextField fullWidth label="Bio" multiline minRows={2} {...form.register('doctorProfile.bio')} />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>
            {isEditing ? 'Save changes' : 'Add user'}
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function UsersPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { can } = useLicense();
  const canManageStaff = can('manageUsers');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogUser, setDialogUser] = useState<User | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | undefined>();

  const usersQuery = useQuery({
    queryKey: ['users', { page, rowsPerPage, search: deferredSearch }],
    queryFn: () => usersService.list({ page: page + 1, pageSize: rowsPerPage, search: deferredSearch }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteUser(undefined); },
    meta: { toast: 'User deleted', errorToast: 'Unable to delete this user.' },
  });
  const users = usersQuery.data?.data ?? [];

  return (
    <>
      <TablePageShell
        title="Users"
        subtitle="Manage staff accounts and role assignments."
        action={
          <Button onClick={() => { setDialogUser(undefined); setDialogOpen(true); }} startIcon={<AddOutlinedIcon />} variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>Add user</Button>
        }
        toolbar={<SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search by name or email" sx={{ flex: 1, maxWidth: 360 }} />}
        pager={
          (usersQuery.data?.total ?? 0) > rowsPerPage ? (
            <TablePager page={page} rowsPerPage={rowsPerPage} total={usersQuery.data?.total ?? 0} onPageChange={setPage} />
          ) : undefined
        }
        error={usersQuery.isError && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>Unable to load users.</Alert>}
        fetching={usersQuery.isFetching && !usersQuery.isLoading}
      >
        <TableHead sx={tableSx.head}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Specialization</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {usersQuery.isLoading ? (
            <TableRowsSkeleton cols={6} />
          ) : users.length === 0 ? (
            <TableRow><TableCell colSpan={6} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No users found.</TableCell></TableRow>
          ) : (
            users.map((user: User) => (
              <TableRow key={user.id} sx={tableSx.row}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    {user.role === 'DOCTOR' ? (
                      <DoctorAvatar
                        src={user.avatar || user.doctorProfile?.avatar}
                        name={`Dr. ${user.firstName} ${user.lastName}`}
                        size={34}
                        fallback="doctor"
                      />
                    ) : (
                      <DoctorAvatar
                        src={user.avatar}
                        name={`${user.firstName} ${user.lastName}`}
                        size={34}
                        fallback={avatarFallbackFromRole(user.role)}
                      />
                    )}
                    <Box>
                      <Typography fontSize={13.5} fontWeight={600}>{user.firstName} {user.lastName}</Typography>
                      <Typography fontSize={11.5} color="text.secondary">{roleLabels[user.role] ?? user.role}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell><Chip label={roleLabels[user.role] ?? user.role} color={roleColors[user.role] ?? 'default'} size="small" sx={{ ...chipSx, border: 'none' }} /></TableCell>
                <TableCell>{user.doctorProfile ? <Typography variant="body2">{user.doctorProfile.specialization}</Typography> : <Typography variant="body2" color="text.disabled">—</Typography>}</TableCell>
                <TableCell>
                  <Box sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.25,
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: user.isActive ? 'rgba(46,125,50,0.12)' : 'rgba(0,0,0,0.06)',
                    bgcolor: user.isActive ? 'rgba(46,125,50,0.1)' : 'rgba(0,0,0,0.06)',
                  }}>
                    <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: user.isActive ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                    <Typography fontSize={12} fontWeight={600} color={user.isActive ? 'success.dark' : 'text.secondary'}>{user.isActive ? 'Active' : 'Inactive'}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" gap={0.5} justifyContent="flex-end">
                    <Tooltip title="Edit"><IconButton sx={actionBtnSx} onClick={() => { setDialogUser(user); setDialogOpen(true); }}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    {canManageStaff && (
                      <Tooltip title="Delete"><IconButton sx={actionBtnSx} onClick={() => setDeleteUser(user)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </TablePageShell>
      <UserDialog open={isDialogOpen} user={dialogUser} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleteUser)}
        title="Delete user?"
        message={deleteUser ? `Delete ${deleteUser.firstName} ${deleteUser.lastName}?` : ''}
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Unable to delete this user. They may have linked records.</Alert> : undefined}
        onClose={() => setDeleteUser(undefined)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
      />
    </>
  );
}
