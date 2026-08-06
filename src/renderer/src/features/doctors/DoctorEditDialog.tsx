import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  Divider, FormControlLabel, IconButton, InputAdornment,
  Stack, Switch, TextField, Typography,
} from '@mui/material';
import {
  FormDialogTitle, dialogActionsSx, dialogCancelBtnSx, dialogContentSx,
  dialogPaperProps, dialogSubmitBtnSx,
} from '@/components/DialogUI';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { doctorsService } from '@/services/doctors.service';
import type { Doctor, DoctorUpdateInput } from '@/types/doctor';

const editSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  isActive: z.boolean(),
  specialization: z.string().trim().min(1, 'Specialization is required.'),
  qualification: z.string().trim(),
  experienceYears: z.coerce.number().int().min(0).max(60),
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
    phone: doctor.doctorProfile?.phone ?? '',
    bio: doctor.doctorProfile?.bio ?? '',
  };
}

export function DoctorEditDialog({ doctorId, open, onClose }: { doctorId: string; open: boolean; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);

  const { data: doctor } = useQuery<Doctor>({
    queryKey: ['doctor', doctorId],
    queryFn: () => window.clinic.doctors.getOne(doctorId),
    enabled: open && Boolean(doctorId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema) as import('react-hook-form').Resolver<FormValues>,
    defaultValues: { firstName: '', lastName: '', email: '', password: '', isActive: true, specialization: '', qualification: '', experienceYears: 0, phone: '', bio: '' },
  });

  useEffect(() => {
    if (open && doctor) { form.reset(toFormValues(doctor)); setShowPw(false); }
  }, [open, doctor, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: DoctorUpdateInput = {
        firstName: values.firstName, lastName: values.lastName,
        email: values.email, isActive: values.isActive,
        specialization: values.specialization,
        qualification: values.qualification || undefined,
        experienceYears: values.experienceYears,
        phone: values.phone || undefined,
        bio: values.bio || undefined,
        ...(values.password ? { password: values.password } : {}),
      };
      return doctorsService.update(doctorId, input);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['doctors'] });
      await qc.invalidateQueries({ queryKey: ['doctor', doctorId] });
      onClose();
    },
  });

  const { errors } = form.formState;

  if (!doctor && open) {
    return (
      <Dialog open={open} onClose={onClose} PaperProps={dialogPaperProps}>
        <DialogContent><Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} PaperProps={dialogPaperProps}>
      <FormDialogTitle title="Edit Doctor" subtitle="Update account details and doctor profile." />
      <Box component="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
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
              <TextField fullWidth label="New password (leave blank to keep)" type={showPw ? 'text' : 'password'} error={Boolean(errors.password)} helperText={errors.password?.message} {...form.register('password')}
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw(v => !v)} edge="end">{showPw ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}</IconButton></InputAdornment> } }}
              />
              <Controller control={form.control} name="isActive" render={({ field }) => (
                <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={field.value} onChange={field.onChange} />} label="Active" />
              )} />
            </Box>
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Doctor Profile</Typography>
            <TextField fullWidth label="Specialization" error={Boolean(errors.specialization)} helperText={errors.specialization?.message} {...form.register('specialization')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField fullWidth label="Qualification (e.g. MBBS, MD)" {...form.register('qualification')} />
              <TextField fullWidth label="Experience (years)" type="number" slotProps={{ htmlInput: { min: 0, max: 60, step: 1 } }}
                {...form.register('experienceYears', { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} />
            </Box>
            <TextField fullWidth label="Contact phone" {...form.register('phone')} />
            <TextField fullWidth label="Bio" multiline minRows={2} {...form.register('bio')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} sx={dialogCancelBtnSx}>Cancel</Button>
          <Button disabled={mutation.isPending} type="submit" variant="contained" sx={dialogSubmitBtnSx}>Save changes</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
