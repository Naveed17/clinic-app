import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Divider,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
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
  CalendarMonth24Regular,
  Delete24Regular,
  Edit24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Open24Regular,
} from '@fluentui/react-icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { doctorsService } from '@/services/doctors.service';
import type { Doctor, DoctorInput, DoctorUpdateInput } from '@/types/doctor';
import {
  actionBtnStyle,
  TablePageShell,
  SearchField,
  TablePager,
  DataGridTable,
  StatusDot,
} from '@/components/TableUI';
import { TableRowsSkeleton } from '@/components/LoadingUI';
import { ConfirmDialog, FormDialogTitle, SubmitButton } from '@/components/DialogUI';
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

const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;

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
    gap: tokens.spacingVerticalM,
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr 1fr',
  },
  sectionLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  switchField: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalL,
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

function DoctorDialog({ doctor, open, onClose }: { doctor?: Doctor; open: boolean; onClose: () => void }): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const isEditing = Boolean(doctor);
  const schema: z.ZodType<FormValues> = isEditing ? editSchema : createSchema;

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver<FormValues, unknown, FormValues>(schema as never),
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
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          isActive: values.isActive,
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

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(doctor));
      setShowPw(false);
      setAvatar(doctor?.doctorProfile?.avatar ?? null);
    }
  }, [form, open, doctor]);

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
          title={isEditing ? 'Edit doctor' : 'Add doctor'}
          subtitle={isEditing ? 'Update doctor profile and account.' : 'Register a new doctor account.'}
        />
        <form className={styles.form} onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>Unable to save. Please try again.</MessageBarBody>
                  </MessageBar>
                )}

                <Text className={styles.sectionLabel}>Account</Text>
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

                <div className={styles.grid2}>
                  <Field
                    label={isEditing ? 'New password (leave blank to keep)' : 'Password'}
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

                <Divider />
                <Text className={styles.sectionLabel}>Doctor Profile</Text>
                <DoctorAvatarPicker value={avatar} onChange={setAvatar} />

                <Field
                  label="Specialization"
                  validationState={errors.specialization ? 'error' : undefined}
                  validationMessage={errors.specialization?.message}
                >
                  <Input {...form.register('specialization')} />
                </Field>

                <div className={styles.grid2}>
                  <Field label="Qualification (e.g. MBBS, MD)">
                    <Input {...form.register('qualification')} />
                  </Field>
                  <Field label="Experience (years)">
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      {...form.register('experienceYears', {
                        setValueAs: (value) => (value === '' ? 0 : Number(value)),
                      })}
                    />
                  </Field>
                </div>

                <Field label="Consultation fee">
                  <Input
                    type="number"
                    min={0}
                    contentBefore={<Text size={200}>Rs.</Text>}
                    {...form.register('consultationFee', {
                      setValueAs: (value) => (value === '' ? 0 : Number(value)),
                    })}
                  />
                </Field>

                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneInputField label="Contact phone" value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />

                <Field label="Bio">
                  <Textarea rows={2} {...form.register('bio')} />
                </Field>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Add doctor'}
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

export function DoctorsPage(): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [dialogDoctor, setDialogDoctor] = useState<Doctor | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [deleteDoctor, setDeleteDoctor] = useState<Doctor | undefined>();

  const doctorsQuery = useQuery({
    queryKey: ['doctors', { page, rowsPerPage, search: deferredSearch }],
    queryFn: () => doctorsService.list({ page: page + 1, pageSize: rowsPerPage, search: deferredSearch }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorsService.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setDeleteDoctor(undefined);
    },
    meta: { toast: 'Doctor deleted', errorToast: 'Unable to delete this doctor.' },
  });
  const doctors = doctorsQuery.data?.data ?? [];

  const columns = useMemo<TableColumnDefinition<Doctor>[]>(
    () => [
      createTableColumn<Doctor>({
        columnId: 'doctor',
        compare: (a, b) => a.lastName.localeCompare(b.lastName),
        renderHeaderCell: () => 'Doctor',
        renderCell: (doc) => (
          <TableCellLayout
            media={
              <DoctorAvatar
                src={doc.doctorProfile?.avatar}
                name={`Dr. ${doc.firstName} ${doc.lastName}`}
                size={32}
              />
            }
          >
            <div className={styles.personMeta}>
              <Text className={styles.name}>
                Dr. {doc.firstName} {doc.lastName}
              </Text>
              <Text className={styles.muted}>{doc.email}</Text>
            </div>
          </TableCellLayout>
        ),
      }),
      createTableColumn<Doctor>({
        columnId: 'specialization',
        compare: (a, b) =>
          (a.doctorProfile?.specialization ?? '').localeCompare(b.doctorProfile?.specialization ?? ''),
        renderHeaderCell: () => 'Specialization',
        renderCell: (doc) => <Text size={300}>{doc.doctorProfile?.specialization ?? '—'}</Text>,
      }),
      createTableColumn<Doctor>({
        columnId: 'qualification',
        compare: (a, b) =>
          (a.doctorProfile?.qualification ?? '').localeCompare(b.doctorProfile?.qualification ?? ''),
        renderHeaderCell: () => 'Qualification',
        renderCell: (doc) => <Text size={300}>{doc.doctorProfile?.qualification ?? '—'}</Text>,
      }),
      createTableColumn<Doctor>({
        columnId: 'experience',
        compare: (a, b) =>
          (a.doctorProfile?.experienceYears ?? 0) - (b.doctorProfile?.experienceYears ?? 0),
        renderHeaderCell: () => 'Experience',
        renderCell: (doc) => (
          <Text size={300}>
            {doc.doctorProfile
              ? `${doc.doctorProfile.experienceYears} yr${doc.doctorProfile.experienceYears !== 1 ? 's' : ''}`
              : '—'}
          </Text>
        ),
      }),
      createTableColumn<Doctor>({
        columnId: 'fee',
        compare: (a, b) =>
          Number(a.doctorProfile?.consultationFee ?? 0) - Number(b.doctorProfile?.consultationFee ?? 0),
        renderHeaderCell: () => 'Fee',
        renderCell: (doc) => (
          <Text size={300}>{money(Number(doc.doctorProfile?.consultationFee ?? 0))}</Text>
        ),
      }),
      createTableColumn<Doctor>({
        columnId: 'status',
        compare: (a, b) => Number(b.isActive) - Number(a.isActive),
        renderHeaderCell: () => 'Status',
        renderCell: (doc) => (
          <span
            className={`${styles.statusPill} ${doc.isActive ? styles.statusActive : styles.statusInactive}`}
          >
            <StatusDot active={doc.isActive} />
            <Text className={doc.isActive ? styles.statusTextActive : styles.statusTextInactive}>
              {doc.isActive ? 'Active' : 'Inactive'}
            </Text>
          </span>
        ),
      }),
      createTableColumn<Doctor>({
        columnId: 'actions',
        renderHeaderCell: () => 'Actions',
        renderCell: (doc) => (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <Tooltip content="View details" relationship="label">
              <Button
                appearance="subtle"
                icon={<Open24Regular />}
                style={actionBtnStyle}
                onClick={() => navigate(`/doctors/${doc.id}`)}
              />
            </Tooltip>
            <Tooltip content="Edit schedule" relationship="label">
              <Button
                appearance="subtle"
                icon={<CalendarMonth24Regular />}
                style={actionBtnStyle}
                onClick={() => navigate(`/schedule?doctorId=${doc.id}`)}
              />
            </Tooltip>
            <Tooltip content="Edit" relationship="label">
              <Button
                appearance="subtle"
                icon={<Edit24Regular />}
                style={actionBtnStyle}
                onClick={() => {
                  setDialogDoctor(doc);
                  setDialogOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip content="Delete" relationship="label">
              <Button
                appearance="subtle"
                icon={<Delete24Regular />}
                style={actionBtnStyle}
                onClick={() => setDeleteDoctor(doc)}
              />
            </Tooltip>
          </div>
        ),
      }),
    ],
    [navigate, styles],
  );

  return (
    <>
      <TablePageShell
        title="Doctors"
        subtitle="Manage doctor accounts and profiles."
        action={
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => {
              setDialogDoctor(undefined);
              setDialogOpen(true);
            }}
          >
            Add doctor
          </Button>
        }
        toolbar={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Search by name, email, or specialization"
          />
        }
        pager={
          (doctorsQuery.data?.total ?? 0) > rowsPerPage ? (
            <TablePager
              page={page}
              rowsPerPage={rowsPerPage}
              total={doctorsQuery.data?.total ?? 0}
              onPageChange={setPage}
            />
          ) : undefined
        }
        error={
          doctorsQuery.isError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>Unable to load doctors.</MessageBarBody>
            </MessageBar>
          )
        }
        fetching={doctorsQuery.isFetching && !doctorsQuery.isLoading}
      >
        {doctorsQuery.isLoading ? (
          <TableRowsSkeleton cols={7} />
        ) : (
          <DataGridTable
            items={doctors}
            columns={columns}
            getRowId={(d) => d.id}
            emptyMessage="No doctors found."
          />
        )}
      </TablePageShell>

      <DoctorDialog open={isDialogOpen} doctor={dialogDoctor} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleteDoctor)}
        title="Delete doctor?"
        message={deleteDoctor ? `Delete Dr. ${deleteDoctor.firstName} ${deleteDoctor.lastName}?` : ''}
        loading={deleteMutation.isPending}
        error={
          deleteMutation.isError ? (
            <MessageBar intent="error" className={styles.deleteError}>
              <MessageBarBody>Unable to delete. This doctor may have linked appointments.</MessageBarBody>
            </MessageBar>
          ) : undefined
        }
        onClose={() => setDeleteDoctor(undefined)}
        onConfirm={() => deleteDoctor && deleteMutation.mutate(deleteDoctor.id)}
      />
    </>
  );
}
