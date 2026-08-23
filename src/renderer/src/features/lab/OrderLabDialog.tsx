import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Dropdown,
  Field,
  Option,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormDialogTitle, SubmitButton } from '@/components/DialogUI';
import { LAB_TEST_OPTIONS } from './labTestCatalog';

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
  body: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
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

export function OrderLabDialog({
  open,
  patientId,
  patientName,
  orderedById,
  tokenId,
  onClose,
}: {
  open: boolean;
  patientId: string;
  patientName: string;
  orderedById: string;
  tokenId?: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const qc = useQueryClient();
  const [test, setTest] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      window.clinic.lab.create({
        patientId,
        orderedById,
        tokenId: tokenId || undefined,
        test,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lab-orders'] }),
        qc.invalidateQueries({ queryKey: ['lab-orders-token'] }),
      ]);
      setTest('');
      setNotes('');
      onClose();
    },
    meta: { toast: 'Lab order sent', errorToast: 'Could not send lab order.' },
  });

  function handleClose(): void {
    if (mutation.isPending) return;
    setTest('');
    setNotes('');
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
        <FormDialogTitle title="Order lab test" subtitle={`${patientName} — sent to the laboratory queue.`} />
        <DialogBody>
          <DialogContent className={styles.body}>
            <Field label="Test" required>
              <Dropdown
                placeholder="Select a test"
                value={test}
                selectedOptions={test ? [test] : []}
                onOptionSelect={(_, data) => setTest(data.optionValue ?? '')}
              >
                {LAB_TEST_OPTIONS.map((name) => (
                  <Option key={name} value={name} text={name}>
                    {name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Notes (optional)">
              <Textarea rows={2} value={notes} onChange={(_, d) => setNotes(d.value)} />
            </Field>
          </DialogContent>
        </DialogBody>
        <DialogActions className={styles.actions}>
          <Button appearance="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <SubmitButton disabled={!test} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Send to lab
          </SubmitButton>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
