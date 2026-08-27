import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps, telInputDialogProps,
} from '@/components/DialogUI';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { PhoneInputField } from '@/components/PhoneInputField';
import { GenderRadioGroup } from '@/components/GenderRadioGroup';
import { patientsService } from '@/services/patients.service';
import { ageToDateOfBirth, dateOfBirthToAgeParts, dateOfBirthToAge, type AgeUnit } from '@shared/patientAge';
import type { Patient, PatientInput } from '@/types/patient';

const patientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  ageValue: z.string(),
  ageUnit: z.enum(['years', 'months', 'days']),
  gender: z.string(),
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
  firstName: '', lastName: '', ageValue: '', ageUnit: 'years', gender: '', phone: '',
  email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
  bloodGroup: '', allergies: '', chronicConditions: '',
};

function toFormValues(patient?: Patient): PatientFormValues {
  if (!patient) return emptyFormValues;
  const parts = dateOfBirthToAgeParts(patient.dateOfBirth);
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    ageValue: parts ? String(parts.value) : (patient.age != null ? String(patient.age) : ''),
    ageUnit: parts ? parts.unit : 'years',
    gender: patient.gender ?? '',
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
  const num = values.ageValue.trim() ? parseFloat(values.ageValue) : null;
  const dob = num != null && !Number.isNaN(num) ? ageToDateOfBirth(num, values.ageUnit) : null;
  const ageYears = values.ageUnit === 'years' ? (num != null ? Math.floor(num) : null) : (dob ? dateOfBirthToAge(dob) : null);

  return {
    ...values,
    age: ageYears,
    dateOfBirth: dob ? dob.toISOString() : null,
    gender: values.gender || null,
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

interface PatientDialogProps {
  patient?: Patient;
  open: boolean;
  onClose: () => void;
}

export function PatientDialog({ patient, open, onClose }: PatientDialogProps): React.JSX.Element {
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
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps} {...telInputDialogProps}>
      <FormDialogTitle
        title={isEditing ? 'Edit patient' : 'Add patient'}
        subtitle={isEditing ? 'Update patient details and medical info.' : 'Register a new patient in the clinic.'}
      />
      <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            {mutation.isError && <Alert severity="error">Unable to save the patient. Please try again.</Alert>}
            <Controller
              name="gender"
              control={form.control}
              render={({ field }) => (
                <GenderRadioGroup value={field.value} onChange={field.onChange} />
              )}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label="First name" error={Boolean(errors.firstName)} helperText={errors.firstName?.message} {...form.register('firstName')} />
              <TextField fullWidth label="Last name" error={Boolean(errors.lastName)} helperText={errors.lastName?.message} {...form.register('lastName')} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '110px 130px minmax(0, 1fr)' }, alignItems: 'start' }}>
              <TextField
                fullWidth
                label="Age"
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 150, step: 1 } }}
                {...form.register('ageValue')}
              />
              <Controller
                name="ageUnit"
                control={form.control}
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    label="Unit"
                    value={field.value || 'years'}
                    onChange={field.onChange}
                  >
                    <MenuItem value="years">Years</MenuItem>
                    <MenuItem value="months">Months</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </TextField>
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
            </Box>
            <TextField fullWidth label="Email" type="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...form.register('email')} />
            <TextField fullWidth label="Address" minRows={2} multiline {...form.register('address')} />
            <Typography color="text.secondary" variant="subtitle2">Emergency contact</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label="Name" {...form.register('emergencyContactName')} />
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
            </Box>

            <Typography color="text.secondary" variant="subtitle2">Medical Information</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              <TextField select fullWidth label="Blood Group" {...form.register('bloodGroup')}>
                <MenuItem value="">— Unknown —</MenuItem>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => (
                  <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                ))}
              </TextField>
              <TextField fullWidth label="Allergies" placeholder="e.g. Penicillin, Dust" {...form.register('allergies')} />
              <TextField fullWidth label="Chronic Conditions" placeholder="e.g. Diabetes, Hypertension" {...form.register('chronicConditions')} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={mutation.isPending} sx={dialogCancelBtnSx}>Cancel</Button>
          <SubmitButton type="submit" loading={mutation.isPending}>
            {isEditing ? 'Save changes' : 'Add patient'}
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
