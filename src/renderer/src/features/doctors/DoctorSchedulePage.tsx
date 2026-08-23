import {
  Badge,
  Button,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Skeleton,
  Spinner,
  Switch,
  Text,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorsService } from '@/services/doctors.service';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SaveOutlinedIcon } from '@/icons/fluent';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SlotState {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const emptySlots = (): SlotState[] =>
  DAYS.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '17:00', isActive: false }));

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXL,
  },
  subtitle: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
  },
  card: {
    padding: tokens.spacingVerticalXXL,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  doctorRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingVerticalXXL,
    flexWrap: 'wrap',
  },
  doctorField: {
    minWidth: '280px',
  },
  slotList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  slotRow: {
    display: 'grid',
    gridTemplateColumns: '130px 1fr 1fr 80px',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusLarge,
    transitionProperty: 'opacity, background-color',
    transitionDuration: '0.15s',
  },
  dayCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  saveRow: {
    marginTop: tokens.spacingVerticalXXL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
  },
});

export function DoctorSchedulePage(): React.JSX.Element {
  const styles = useStyles();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctorId, setDoctorId] = useState(() => searchParams.get('doctorId') ?? '');
  const [slots, setSlots] = useState<SlotState[]>(emptySlots());

  const doctors = useQuery<{ id: string; firstName: string; lastName: string; isActive: boolean }[]>({
    queryKey: ['schedule-doctors'],
    queryFn: async () => {
      const res = await window.clinic.doctors.list({ page: 1, pageSize: 100, search: '' });
      return (res as { data: { id: string; firstName: string; lastName: string; isActive: boolean }[] })
        .data;
    },
  });

  const selectedDoctor = (doctors.data ?? []).find((d) => d.id === doctorId);

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => doctorsService.update(doctorId, { isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule-doctors'] });
      void qc.invalidateQueries({ queryKey: ['doctors'] });
    },
    meta: { toast: 'Doctor status updated' },
  });

  const scheduleQuery = useQuery({
    queryKey: ['schedule', doctorId],
    queryFn: () => window.clinic.schedule.get(doctorId),
    enabled: Boolean(doctorId),
  });

  useEffect(() => {
    if (scheduleQuery.data === undefined) return;
    if (scheduleQuery.data.length === 0) {
      setSlots(emptySlots());
      return;
    }
    const base = emptySlots();
    for (const s of scheduleQuery.data) {
      const idx = base.findIndex((b) => b.dayOfWeek === s.dayOfWeek);
      if (idx >= 0) {
        base[idx] = {
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        };
      }
    }
    setSlots(base);
  }, [scheduleQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => window.clinic.schedule.upsert(doctorId, slots),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule'] });
      void qc.invalidateQueries({ queryKey: ['doctor', doctorId] });
      void qc.invalidateQueries({ queryKey: ['doctors'] });
    },
    meta: { toast: 'Schedule saved', errorToast: 'Unable to save schedule.' },
  });

  const updateSlot = (day: number, patch: Partial<SlotState>) =>
    setSlots((prev) => prev.map((s) => (s.dayOfWeek === day ? { ...s, ...patch } : s)));

  const doctorList = (doctors.data ?? []) as {
    id: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }[];

  return (
    <div className={styles.page}>
      <div>
        <Title3>Doctor Schedule</Title3>
        <Text className={styles.subtitle} block>
          Set weekly availability for each doctor. Appointments and tokens are blocked outside these
          hours.
        </Text>
      </div>

      <div className={styles.card}>
        <div className={styles.doctorRow}>
          <Field label="Select Doctor" className={styles.doctorField}>
            <Dropdown
              placeholder="Select Doctor"
              value={
                selectedDoctor
                  ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}`
                  : ''
              }
              selectedOptions={doctorId ? [doctorId] : []}
              onOptionSelect={(_, data) => {
                const id = String(data.optionValue ?? '');
                setDoctorId(id);
                setSlots(emptySlots());
                setSearchParams(id ? { doctorId: id } : {});
              }}
            >
              {doctorList.map((d) => (
                <Option key={d.id} value={d.id} text={`${d.firstName} ${d.lastName}`}>
                  {d.firstName} {d.lastName}
                </Option>
              ))}
            </Dropdown>
          </Field>
          {selectedDoctor ? (
            <Switch
              checked={selectedDoctor.isActive}
              disabled={statusMutation.isPending}
              onChange={(_, d) => statusMutation.mutate(d.checked)}
              label={selectedDoctor.isActive ? 'Active' : 'Inactive'}
            />
          ) : null}
        </div>
      </div>

      {doctorId ? (
        scheduleQuery.isLoading ? (
          <div className={styles.card}>
            <div className={styles.slotList}>
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} style={{ height: 56, borderRadius: 8 }} />
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={styles.slotList}>
              {slots.map((slot) => (
                <div
                  key={slot.dayOfWeek}
                  className={styles.slotRow}
                  style={{
                    backgroundColor: slot.isActive
                      ? tokens.colorNeutralBackground1Hover
                      : 'transparent',
                    opacity: slot.isActive ? 1 : 0.5,
                  }}
                >
                  <div className={styles.dayCell}>
                    <Switch
                      checked={slot.isActive}
                      onChange={(_, d) => updateSlot(slot.dayOfWeek, { isActive: d.checked })}
                    />
                    <Text weight={slot.isActive ? 'semibold' : 'regular'}>
                      {DAYS[slot.dayOfWeek]}
                    </Text>
                  </div>
                  <Field label="Start">
                    <Input
                      type="time"
                      value={slot.startTime}
                      disabled={!slot.isActive}
                      onChange={(_, d) => updateSlot(slot.dayOfWeek, { startTime: d.value })}
                    />
                  </Field>
                  <Field label="End">
                    <Input
                      type="time"
                      value={slot.endTime}
                      disabled={!slot.isActive}
                      onChange={(_, d) => updateSlot(slot.dayOfWeek, { endTime: d.value })}
                    />
                  </Field>
                  {slot.isActive ? (
                    <Badge appearance="filled" color="success">
                      Active
                    </Badge>
                  ) : (
                    <Badge appearance="outline">Off</Badge>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.saveRow}>
              <Button
                appearance="primary"
                icon={saveMutation.isPending ? <Spinner size="tiny" /> : <SaveOutlinedIcon />}
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save schedule
              </Button>
              {saveMutation.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    {(saveMutation.error as Error)?.message || 'Failed to save.'}
                  </MessageBarBody>
                </MessageBar>
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
