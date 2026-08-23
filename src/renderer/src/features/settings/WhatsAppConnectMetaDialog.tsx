import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Field,
  Input,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';

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

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
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
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
});

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
  const styles = useStyles();
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
      onOpenChange={(_, data) => {
        if (!data.open && !connecting) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <form
          className={styles.form}
          noValidate
          onSubmit={handleSubmit((values) => void onSubmit(values))}
        >
          <FormDialogTitle title="Connect with Meta" />
          <DialogBody>
            <DialogContent className={styles.body}>
              <div className={styles.fields}>
                <Field
                  label="Business email"
                  required
                  validationState={errors.email ? 'error' : undefined}
                  validationMessage={errors.email?.message}
                  hint={errors.email ? undefined : 'Meta uses this email to create the new business portfolio.'}
                >
                  <Input type="email" disabled={connecting} {...register('email')} />
                </Field>
                <Field
                  label="Website"
                  required
                  validationState={errors.website ? 'error' : undefined}
                  validationMessage={errors.website?.message}
                  hint={errors.website ? undefined : 'Include https://. An Instagram or Facebook page URL also works.'}
                >
                  <Input
                    placeholder="https://yourclinic.com"
                    disabled={connecting}
                    {...register('website')}
                  />
                </Field>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions className={styles.actions}>
            <Button appearance="secondary" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <SubmitButton type="submit" loading={connecting}>
              Continue
            </SubmitButton>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
