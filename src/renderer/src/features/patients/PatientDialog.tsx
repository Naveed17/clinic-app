import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, SubmitButton, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogFormSx, dialogPaperProps,
} from '@/components/DialogUI';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { patientsService } from '@/services/patients.service';
import type { Patient, PatientInput } from '@/types/patient';

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

function toPatientInput(values: PatientFormValues): PatientInput {
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
  };
}

interface PatientDialogProps {
  patient?: Patient;
  open: boolean;
  onClose: () => void;
}

export function PatientDialog({ patient, open, onClose }: PatientDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const isEditing = Boolean(patient);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: emptyFormValues,
  });
  const mutation = useMutation({
    mutationFn: (values: PatientFormValues) =>
      patient
        ? patientsService.update(patient.id, toPatientInput(values))
        : patientsService.create(toPatientInput(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      onClose();
    },
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(patient));
  }, [form, open, patient]);

  const { errors } = form.formState;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title={isEditing ? 'Edit patient' : 'Add patient'}
        subtitle={isEditing ? 'Update patient details and medical info.' : 'Register a new patient in the clinic.'}
      />
      <Box component="form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} sx={dialogFormSx}>
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            {mutation.isError && <Alert severity="error">Unable to save the patient. Please try again.</Alert>}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField autoFocus fullWidth label="First name" error={Boolean(errors.firstName)} helperText={errors.firstName?.message} {...form.register('firstName')} />
              <TextField fullWidth label="Last name" error={Boolean(errors.lastName)} helperText={errors.lastName?.message} {...form.register('lastName')} />
            </Box>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <Controller
                  name="dateOfBirth"
                  control={form.control}
                  render={({ field }) => (
                    <DatePicker
                      label="Date of birth"
                      value={field.value ? new Date(field.value) : null}
                      onChange={(value) => field.onChange(value ? value.toISOString().slice(0, 10) : '')}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}
                />
                <TextField fullWidth label="Phone" {...form.register('phone')} />
              </Box>
            </LocalizationProvider>
            <TextField fullWidth label="Email" type="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...form.register('email')} />
            <TextField fullWidth label="Address" minRows={2} multiline {...form.register('address')} />
            <Typography color="text.secondary" variant="subtitle2">Emergency contact</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label="Name" {...form.register('emergencyContactName')} />
              <TextField fullWidth label="Phone" {...form.register('emergencyContactPhone')} />
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
