import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Switch,
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
  Delete24Regular,
  Edit24Regular,
  Eye24Regular,
  EyeOff24Regular,
} from '@fluentui/react-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersService } from '@/services/users.service';
import type { User, UserInput, UserUpdateInput } from '@/types/user';
import {
  actionBtnStyle,
  StatusDot,
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import {
  ConfirmDialog,
  FormDialogTitle,
  SubmitButton,
} from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { DoctorAvatar, DoctorAvatarPicker, avatarFallbackFromRole } from '@/components/DoctorAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  LAB_TECHNICIAN: 'Lab Technician',
  PHARMACIST: 'Pharmacist',
};

type RoleBadgeColor = 'brand' | 'informative' | 'subtle' | 'warning' | 'success';

const roleColors: Record<string, RoleBadgeColor> = {
  ADMIN: 'brand',
  DOCTOR: 'informative',
  RECEPTIONIST: 'subtle',
  LAB_TECHNICIAN: 'warning',
  PHARMACIST: 'success',
};

const doctorProfileSchema = z.object({
  specialization: z.string().trim(),
  qualification: z.string().trim(),
  experienceYears: z.number().min(0).max(60),
  consultationFee: z.number().min(0),
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
  doctorProfile: { specialization: '', qualification: '', experienceYears: 0, consultationFee: 0, phone: '', bio: '' },
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
      consultationFee: Number(user.doctorProfile?.consultationFee ?? 0),
      phone: user.doctorProfile?.phone ?? '',
      bio: user.doctorProfile?.bio ?? '',
    },
  };
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
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
    gap: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalXS,
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr',
    '@media (min-width: 600px)': {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  roleActiveRow: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr',
    alignItems: 'end',
    '@media (min-width: 600px)': {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  switchField: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minHeight: '32px',
    paddingBottom: tokens.spacingVerticalXS,
  },
  sectionLabel: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
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
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statusActive: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  statusInactive: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  statusTextActive: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteGreenForeground1,
  },
  statusTextInactive: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
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

function UserDialog({ user, open, onClose }: { user?: User; open: boolean; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const isEditing = Boolean(user);
  const { can } = useLicense();
  const extraAdmins = can('manageUsers');
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
          consultationFee: values.doctorProfile.consultationFee,
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
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={isEditing ? 'Edit user' : 'Add user'}
          subtitle={isEditing ? 'Update account role and access.' : 'Create a new staff account.'}
        />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>Unable to save the user. Please try again.</MessageBarBody>
                  </MessageBar>
                )}

                <div className={styles.grid2}>
                  <Field
                    label="First name"
                    validationState={errors.firstName ? 'error' : undefined}
                    validationMessage={errors.firstName?.message}
                  >
                    <Input autoFocus {...form.register('firstName')} />
                  </Field>
                  <Field
                    label="Last name"
                    validationState={errors.lastName ? 'error' : undefined}
                    validationMessage={errors.lastName?.message}
                  >
                    <Input {...form.register('lastName')} />
                  </Field>
                </div>

                <Field
                  label="Email"
                  validationState={errors.email ? 'error' : undefined}
                  validationMessage={errors.email?.message}
                >
                  <Input type="email" {...form.register('email')} />
                </Field>

                <Field
                  label={isEditing ? 'New password (leave blank to keep current)' : 'Password'}
                  validationState={errors.password ? 'error' : undefined}
                  validationMessage={errors.password?.message}
                >
                  <Input
                    type={showPw ? 'text' : 'password'}
                    {...form.register('password')}
                    contentAfter={
                      <Button
                        appearance="transparent"
                        size="small"
                        icon={showPw ? <EyeOff24Regular /> : <Eye24Regular />}
                        onClick={() => setShowPw((v) => !v)}
                        type="button"
                      />
                    }
                  />
                </Field>

                <div className={styles.roleActiveRow}>
                  <Field
                    label="Role"
                    validationState={errors.role ? 'error' : undefined}
                    validationMessage={errors.role?.message}
                  >
                    <Controller
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <Dropdown
                          value={roleLabels[field.value] ?? field.value}
                          selectedOptions={[field.value]}
                          onOptionSelect={(_, data) => {
                            if (data.optionValue) field.onChange(data.optionValue);
                          }}
                        >
                          {(extraAdmins || user?.role === 'ADMIN') && (
                            <Option value="ADMIN" text="Admin">Admin</Option>
                          )}
                          {can('doctorDashboard') && (
                            <Option value="DOCTOR" text="Doctor">Doctor</Option>
                          )}
                          <Option value="RECEPTIONIST" text="Receptionist">Receptionist</Option>
                          {can('labDashboard') && (
                            <Option value="LAB_TECHNICIAN" text="Lab Technician">Lab Technician</Option>
                          )}
                        </Dropdown>
                      )}
                    />
                  </Field>
                  <Controller
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <div className={styles.switchField}>
                        <Switch
                          checked={field.value}
                          onChange={(_, data) => field.onChange(data.checked)}
                        />
                        <Text>Active</Text>
                      </div>
                    )}
                  />
                </div>

                <DoctorAvatarPicker
                  value={avatar}
                  onChange={setAvatar}
                  name={`${form.watch('firstName')} ${form.watch('lastName')}`.trim()}
                  fallback={avatarFallbackFromRole(role)}
                />

                {isDoctor && (
                  <>
                    <Divider />
                    <Text className={styles.sectionLabel}>Doctor Profile</Text>
                    <Field
                      label="Specialization"
                      validationState={errors.doctorProfile?.specialization ? 'error' : undefined}
                      validationMessage={errors.doctorProfile?.specialization?.message}
                    >
                      <Input {...form.register('doctorProfile.specialization')} />
                    </Field>
                    <div className={styles.grid2}>
                      <Field label="Qualification (e.g. MBBS, MD)">
                        <Input {...form.register('doctorProfile.qualification')} />
                      </Field>
                      <Field label="Experience (years)">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          {...form.register('doctorProfile.experienceYears', { valueAsNumber: true })}
                        />
                      </Field>
                    </div>
                    <Field label="Consultation fee">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        contentBefore={<Text size={200}>Rs.</Text>}
                        {...form.register('doctorProfile.consultationFee', { valueAsNumber: true })}
                      />
                    </Field>
                    <Controller
                      control={form.control}
                      name="doctorProfile.phone"
                      render={({ field }) => (
                        <PhoneInputField label="Contact phone" value={field.value ?? ''} onChange={field.onChange} />
                      )}
                    />
                    <Field label="Bio">
                      <Textarea
                        rows={2}
                        {...form.register('doctorProfile.bio')}
                      />
                    </Field>
                  </>
                )}
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending} type="button">
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Add user'}
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

export function UsersPage(): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { can } = useLicense();
  const extraAdmins = can('manageUsers');
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

  const columns = useMemo<TableColumnDefinition<User>[]>(
    () => [
      createTableColumn<User>({
        columnId: 'name',
        compare: (a, b) => a.lastName.localeCompare(b.lastName),
        renderHeaderCell: () => 'Name',
        renderCell: (user) => (
          <TableCellLayout
            media={
              user.role === 'DOCTOR' ? (
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
              )
            }
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>
                {user.firstName} {user.lastName}
              </Text>
              <Text className={styles.muted}>{roleLabels[user.role] ?? user.role}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<User>({
        columnId: 'email',
        compare: (a, b) => a.email.localeCompare(b.email),
        renderHeaderCell: () => 'Email',
        renderCell: (user) => <Text size={300}>{user.email}</Text>,
      }),
      createTableColumn<User>({
        columnId: 'role',
        compare: (a, b) => a.role.localeCompare(b.role),
        renderHeaderCell: () => 'Role',
        renderCell: (user) => (
          <Badge appearance="tint" color={roleColors[user.role] ?? 'subtle'} size="small">
            {roleLabels[user.role] ?? user.role}
          </Badge>
        ),
      }),
      createTableColumn<User>({
        columnId: 'specialization',
        compare: (a, b) =>
          (a.doctorProfile?.specialization ?? '').localeCompare(b.doctorProfile?.specialization ?? ''),
        renderHeaderCell: () => 'Specialization',
        renderCell: (user) =>
          user.doctorProfile ? (
            <Text size={300}>{user.doctorProfile.specialization}</Text>
          ) : (
            <Text className={styles.muted}>—</Text>
          ),
      }),
      createTableColumn<User>({
        columnId: 'status',
        compare: (a, b) => Number(b.isActive) - Number(a.isActive),
        renderHeaderCell: () => 'Status',
        renderCell: (user) => (
          <span
            className={`${styles.statusPill} ${user.isActive ? styles.statusActive : styles.statusInactive}`}
          >
            <StatusDot active={user.isActive} />
            <Text className={user.isActive ? styles.statusTextActive : styles.statusTextInactive}>
              {user.isActive ? 'Active' : 'Inactive'}
            </Text>
          </span>
        ),
      }),
      createTableColumn<User>({
        columnId: 'actions',
        renderHeaderCell: () => 'Actions',
        renderCell: (user) => (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <Tooltip content="Edit" relationship="label">
              <Button
                appearance="subtle"
                icon={<Edit24Regular />}
                style={actionBtnStyle}
                onClick={() => {
                  setDialogUser(user);
                  setDialogOpen(true);
                }}
              />
            </Tooltip>
            {user.id !== me?.id && (user.role !== 'ADMIN' || extraAdmins) && (
              <Tooltip content="Delete" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  style={actionBtnStyle}
                  onClick={() => setDeleteUser(user)}
                />
              </Tooltip>
            )}
          </div>
        ),
      }),
    ],
    [extraAdmins, me?.id, styles],
  );

  return (
    <>
      <TablePageShell
        title="Users"
        subtitle="Manage staff accounts and role assignments."
        action={
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => {
              setDialogUser(undefined);
              setDialogOpen(true);
            }}
          >
            Add user
          </Button>
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Search by name or email"
          />
        }
        pager={
          (usersQuery.data?.total ?? 0) > rowsPerPage ? (
            <TablePager
              page={page}
              rowsPerPage={rowsPerPage}
              total={usersQuery.data?.total ?? 0}
              onPageChange={setPage}
            />
          ) : undefined
        }
        error={
          usersQuery.isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load users.</MessageBarBody>
            </MessageBar>
          )
        }
        fetching={usersQuery.isFetching && !usersQuery.isLoading}
      >
        {usersQuery.isLoading ? (
          <TableRowsSkeleton cols={6} />
        ) : (
          <DataGridTable
            items={users}
            columns={columns}
            getRowId={(u) => u.id}
            emptyMessage="No users found."
          />
        )}
      </TablePageShell>
      <UserDialog open={isDialogOpen} user={dialogUser} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleteUser)}
        title="Delete user?"
        message={deleteUser ? `Delete ${deleteUser.firstName} ${deleteUser.lastName}?` : ''}
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? (
          <MessageBar intent="error" className={styles.deleteError}>
            <MessageBarBody>Unable to delete this user. They may have linked records.</MessageBarBody>
          </MessageBar>
        ) : undefined}
        onClose={() => setDeleteUser(undefined)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
      />
    </>
  );
}
