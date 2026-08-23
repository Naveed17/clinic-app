import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { FluentDateField, formatDateIso, parseDateIso } from '@/components/FluentDateField';
import { PhoneInputField } from '@/components/PhoneInputField';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { patientsService } from '@/services/patients.service';
import type { Patient, PatientInput } from '@/types/patient';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const patientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  dateOfBirth: z.string(),
  phone: z.string().trim(),
  email: z.string().trim().refine(
    (value) => !value || z.email().safeParse(value).success,
    'Enter a valid email address.',
  ),
  address: z.string().trim(),
  emergencyContactName: z.string().trim(),
  emergencyContactPhone: z.string().trim(),
  bloodGroup: z.string(),
  allergies: z.string().trim(),
  chronicConditions: z.string().trim(),
});

export type PatientFormValues = z.infer<typeof patientSchema>;

const emptyFormValues: PatientFormValues = {
  firstName: '', lastName: '', dateOfBirth: '', phone: '',
  email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
  bloodGroup: '', allergies: '', chronicConditions: '',
};

function toFormValues(patient?: Patient): PatientFormValues {
  if (!patient) return emptyFormValues;
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 10) : '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
    bloodGroup: patient.bloodGroup ?? '',
    allergies: patient.allergies ?? '',
    chronicConditions: patient.chronicConditions ?? '',
  };
}

function toPatientInput(values: PatientFormValues, primaryDoctorId?: string | null): PatientInput {
  return {
    ...values,
    dateOfBirth: values.dateOfBirth || null,
    phone: values.phone || null,
    email: values.email || null,
    address: values.address || null,
    emergencyContactName: values.emergencyContactName || null,
    emergencyContactPhone: values.emergencyContactPhone || null,
    bloodGroup: values.bloodGroup || null,
    allergies: values.allergies || null,
    chronicConditions: values.chronicConditions || null,
    ...(primaryDoctorId ? { primaryDoctorId } : {}),
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
    gap: tokens.spacingVerticalM,
  },
  grid2: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr 1fr',
  },
  grid3: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: '1fr 1fr 1fr',
  },
  sectionLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
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
});

interface PatientDialogProps {
  patient?: Patient;
  open: boolean;
  onClose: () => void;
}

export function PatientDialog({ patient, open, onClose }: PatientDialogProps): React.JSX.Element {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = Boolean(patient);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: emptyFormValues,
  });
  const mutation = useMutation({
    mutationFn: (values: PatientFormValues) => {
      const linkDoctorId =
        !patient && user?.role === 'doctor' ? user.id : undefined;
      return patient
        ? patientsService.update(patient.id, toPatientInput(values))
        : patientsService.create(toPatientInput(values, linkDoctorId));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      onClose();
    },
    meta: {
      toast: patient ? 'Patient updated' : 'Patient created',
      errorToast: 'Unable to save the patient.',
    },
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(patient));
  }, [form, open, patient]);

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
          title={isEditing ? 'Edit patient' : 'Add patient'}
          subtitle={isEditing ? 'Update patient details and medical info.' : 'Register a new patient in the clinic.'}
        />
        <form className={styles.form} onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                {mutation.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>Unable to save the patient. Please try again.</MessageBarBody>
                  </MessageBar>
                )}
                <div className={styles.grid2}>
                  <Field
                    label="First name"
                    required
                    validationState={errors.firstName ? 'error' : undefined}
                    validationMessage={errors.firstName?.message}
                  >
                    <Input autoFocus {...form.register('firstName')} />
                  </Field>
                  <Field
                    label="Last name"
                    required
                    validationState={errors.lastName ? 'error' : undefined}
                    validationMessage={errors.lastName?.message}
                  >
                    <Input {...form.register('lastName')} />
                  </Field>
                </div>
                <div className={styles.grid2}>
                  <Controller
                    name="dateOfBirth"
                    control={form.control}
                    render={({ field }) => (
                      <FluentDateField
                        label="Date of birth"
                        value={parseDateIso(field.value)}
                        onSelectDate={(d) => field.onChange(formatDateIso(d))}
                      />
                    )}
                  />
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field }) => (
                      <PhoneInputField
                        label="Phone"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <Field
                  label="Email"
                  validationState={errors.email ? 'error' : undefined}
                  validationMessage={errors.email?.message}
                >
                  <Input type="email" {...form.register('email')} />
                </Field>
                <Field label="Address">
                  <Textarea rows={2} {...form.register('address')} />
                </Field>
                <Text className={styles.sectionLabel}>Emergency contact</Text>
                <div className={styles.grid2}>
                  <Field label="Name">
                    <Input {...form.register('emergencyContactName')} />
                  </Field>
                  <Controller
                    name="emergencyContactPhone"
                    control={form.control}
                    render={({ field }) => (
                      <PhoneInputField
                        label="Phone"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>

                <Text className={styles.sectionLabel}>Medical Information</Text>
                <div className={styles.grid3}>
                  <Controller
                    name="bloodGroup"
                    control={form.control}
                    render={({ field }) => (
                      <Field label="Blood Group">
                        <Dropdown
                          placeholder="— Unknown —"
                          value={field.value || '— Unknown —'}
                          selectedOptions={[field.value || '__unknown__']}
                          onOptionSelect={(_, data) => {
                            const next = data.optionValue ?? '';
                            field.onChange(next === '__unknown__' ? '' : next);
                          }}
                        >
                          <Option value="__unknown__" text="— Unknown —">— Unknown —</Option>
                          {BLOOD_GROUPS.map((bg) => (
                            <Option key={bg} value={bg} text={bg}>{bg}</Option>
                          ))}
                        </Dropdown>
                      </Field>
                    )}
                  />
                  <Field label="Allergies">
                    <Input placeholder="e.g. Penicillin, Dust" {...form.register('allergies')} />
                  </Field>
                  <Field label="Chronic Conditions">
                    <Input placeholder="e.g. Diabetes, Hypertension" {...form.register('chronicConditions')} />
                  </Field>
                </div>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actionsBar}>
            <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <SubmitButton type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Add patient'}
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
