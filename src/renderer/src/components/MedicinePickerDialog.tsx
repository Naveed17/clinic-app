import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Medicine } from '@/types/medicine';
import { AddOutlinedIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
    width: '100%',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  actions: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalS,
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (medicine: Medicine) => void;
}

export function MedicinePickerDialog({ open, onClose, onAdded }: Props) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => window.clinic.medicines.create(name.trim(), parseFloat(price) || 0),
    onSuccess: async (med: Medicine) => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      setName('');
      setPrice('');
      setError('');
      onAdded(med);
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save medicine.'),
    meta: { toast: 'Medicine added', errorToast: 'Could not save medicine.' },
  });

  function handleClose() {
    setName('');
    setPrice('');
    setError('');
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) handleClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <FormDialogTitle title="Add New Medicine" subtitle="Quick-add a medicine to the catalog." />
        <DialogBody>
          <DialogContent className={styles.body}>
            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            ) : null}
            <Field label="Medicine name">
              <Input value={name} onChange={(_, d) => setName(d.value)} autoFocus />
            </Field>
            <Field label="Price">
              <Input
                type="number"
                value={price}
                onChange={(_, d) => setPrice(d.value)}
                contentBefore="Rs."
                min={0}
                step="any"
              />
            </Field>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <SubmitButton
            icon={<AddOutlinedIcon />}
            disabled={!name.trim()}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Add Medicine
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}

export function MedicineUpdatePriceDialog({
  medicine,
  onClose,
}: {
  medicine: Medicine;
  onClose: () => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(medicine.price));

  const mutation = useMutation({
    mutationFn: () => window.clinic.medicines.updatePrice(medicine.id, parseFloat(price) || 0),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['medicines'] });
      onClose();
    },
    meta: { toast: 'Price updated', errorToast: 'Unable to update price.' },
  });

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <FormDialogTitle
          title={`Update Price — ${medicine.name}`}
          subtitle="Set the new sale price for this medicine."
        />
        <DialogBody>
          <DialogContent className={styles.body}>
            <Field label="New Price">
              <Input
                type="number"
                value={price}
                onChange={(_, d) => setPrice(d.value)}
                contentBefore="Rs."
                autoFocus
                min={0}
                step="any"
              />
            </Field>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <SubmitButton loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
