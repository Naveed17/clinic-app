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
  Skeleton,
  Switch,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { PhoneInputField } from '@/components/PhoneInputField';
import { DoctorAvatarPicker } from '@/components/DoctorAvatar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { doctorsService } from '@/services/doctors.service';
import type { Doctor, DoctorUpdateInput } from '@/types/doctor';
import { VisibilityOffOutlinedIcon, VisibilityOutlinedIcon } from '@/icons/fluent';

const editSchema = z.object({
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
  password: z.string().refine((v) => !v || v.length >= 6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof editSchema>;

function toFormValues(doctor: Doctor): FormValues {
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

const useStyles = makeStyles({
  surface: {
    maxWidth: '560px',
    width: '100%',
    maxHeight: '90vh',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: '1fr 1fr',
  },
  section: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  actions: {
    padding: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
  },
});

export function DoctorEditDialog({
  doctorId,
  open,
  onClose,
}: {
  doctorId: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);

  const { data: doctor } = useQuery<Doctor>({
    queryKey: ['doctor', doctorId],
    queryFn: () => window.clinic.doctors.getOne(doctorId),
    enabled: open && Boolean(doctorId),
  });
  const [avatar, setAvatar] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema) as import('react-hook-form').Resolver<FormValues>,
    defaultValues: {
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
    },
  });

  useEffect(() => {
    if (open && doctor) {
      form.reset(toFormValues(doctor));
      setShowPw(false);
      setAvatar(doctor.doctorProfile?.avatar ?? null);
    }
  }, [open, doctor, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: DoctorUpdateInput = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        isActive: values.isActive,
        specialization: values.specialization,
        qualification: values.qualification || undefined,
        experienceYears: values.experienceYears,
        consultationFee: values.consultationFee,
        phone: values.phone || undefined,
        bio: values.bio || undefined,
        avatar,
        ...(values.password ? { password: values.password } : {}),
      };
      return doctorsService.update(doctorId, input);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['doctors'] });
      await qc.invalidateQueries({ queryKey: ['doctor', doctorId] });
      onClose();
    },
    meta: { toast: 'Doctor updated', errorToast: 'Unable to save doctor.' },
  });

  const { errors } = form.formState;

  if (!doctor && open) {
    return (
      <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
        <DialogSurface className={styles.surface}>
          <DialogBody>
            <DialogContent className={styles.body}>
              <Skeleton style={{ height: 40 }} />
              <Skeleton style={{ height: 40 }} />
              <Skeleton style={{ height: 40 }} />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <FormDialogTitle title="Edit Doctor" subtitle="Update account details and doctor profile." />
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <DialogBody>
            <DialogContent className={styles.body}>
              {mutation.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>Unable to save. Please try again.</MessageBarBody>
                </MessageBar>
              ) : null}
              <Text className={styles.section}>Account</Text>
              <div className={styles.grid2}>
                <Field
                  label="First name"
                  validationMessage={errors.firstName?.message}
                  validationState={errors.firstName ? 'error' : 'none'}
                >
                  <Input autoFocus {...form.register('firstName')} />
                </Field>
                <Field
                  label="Last name"
                  validationMessage={errors.lastName?.message}
                  validationState={errors.lastName ? 'error' : 'none'}
                >
                  <Input {...form.register('lastName')} />
                </Field>
              </div>
              <Field
                label="Email"
                validationMessage={errors.email?.message}
                validationState={errors.email ? 'error' : 'none'}
              >
                <Input type="email" {...form.register('email')} />
              </Field>
              <div className={styles.grid2}>
                <Field
                  label="New password (leave blank to keep)"
                  validationMessage={errors.password?.message}
                  validationState={errors.password ? 'error' : 'none'}
                >
                  <Input
                    type={showPw ? 'text' : 'password'}
                    {...form.register('password')}
                    contentAfter={
                      <Button
                        appearance="transparent"
                        size="small"
                        icon={
                          showPw ? (
                            <VisibilityOutlinedIcon style={{ fontSize: 18 }} />
                          ) : (
                            <VisibilityOffOutlinedIcon style={{ fontSize: 18 }} />
                          )
                        }
                        onClick={() => setShowPw((v) => !v)}
                      />
                    }
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onChange={(_, d) => field.onChange(d.checked)}
                      label="Active"
                    />
                  )}
                />
              </div>
              <Divider />
              <Text className={styles.section}>Doctor Profile</Text>
              <DoctorAvatarPicker value={avatar} onChange={setAvatar} />
              <Field
                label="Specialization"
                validationMessage={errors.specialization?.message}
                validationState={errors.specialization ? 'error' : 'none'}
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
                      setValueAs: (v) => (v === '' ? 0 : Number(v)),
                    })}
                  />
                </Field>
              </div>
              <Field label="Consultation fee">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  contentBefore="Rs."
                  {...form.register('consultationFee', {
                    setValueAs: (v) => (v === '' ? 0 : Number(v)),
                  })}
                />
              </Field>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <PhoneInputField
                    label="Contact phone"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
              <Field label="Bio">
                <Textarea rows={2} {...form.register('bio')} />
              </Field>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actions}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              Save changes
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
