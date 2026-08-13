import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, Stack, TextField } from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FormDialogTitle,
  SubmitButton,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogFormSx,
  dialogPaperProps,
} from '@/components/DialogUI';

const connectMetaSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Business email is required.')
    .refine((v) => z.email().safeParse(v).success, 'Enter a valid email address.'),
  website: z
    .string()
    .trim()
    .min(1, 'Website is required.')
    .refine((v) => {
      const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      try {
        const u = new URL(href);
        return Boolean(u.hostname.includes('.'));
      } catch {
        return false;
      }
    }, 'Enter a valid URL (e.g. https://yourclinic.com).'),
});

export type ConnectMetaFormValues = z.infer<typeof connectMetaSchema>;

const defaultValues: ConnectMetaFormValues = {
  email: '',
  website: '',
};

export function WhatsAppConnectMetaDialog({
  open,
  connecting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  connecting: boolean;
  onClose: () => void;
  onSubmit: (values: ConnectMetaFormValues) => void | Promise<void>;
}): React.JSX.Element {
  const form = useForm<ConnectMetaFormValues>({
    resolver: zodResolver(connectMetaSchema),
    defaultValues,
    mode: 'onTouched',
  });

  const { register, handleSubmit, reset, formState: { errors } } = form;

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
  }, [open, reset]);

  return (
    <Dialog
      open={open}
      onClose={connecting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={dialogPaperProps}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((values) => void onSubmit(values))}
        sx={dialogFormSx}
      >
        <FormDialogTitle title="Connect with Meta" />
        <DialogContent sx={dialogContentSx}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="warning">
              Popup mein existing <strong>CareFlow</strong> WhatsApp account mat select karo — uski Business ID invalid hai.
              Dono jagah <strong>Create new</strong> choose karo, phir asli number + OTP + card.
            </Alert>
            <TextField
              label="Business email"
              type="email"
              size="small"
              fullWidth
              required
              disabled={connecting}
              error={Boolean(errors.email)}
              helperText={errors.email?.message || 'Meta naya Business portfolio isi email se banata hai'}
              {...register('email')}
            />
            <TextField
              label="Website"
              size="small"
              fullWidth
              required
              placeholder="https://yourclinic.com"
              disabled={connecting}
              error={Boolean(errors.website)}
              helperText={errors.website?.message || 'https ke sath. Instagram/Facebook page URL bhi chalega'}
              {...register('website')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={onClose} disabled={connecting} sx={dialogCancelBtnSx}>
            Cancel
          </Button>
          <SubmitButton type="submit" loading={connecting}>
            Continue
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
