import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, FormControlLabel,
  InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorsService } from '@/services/doctors.service';
import { useEffect, useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SlotState {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const defaultSlots = (): SlotState[] =>
  DAYS.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '17:00', isActive: i >= 1 && i <= 5 }));

export function DoctorSchedulePage(): React.JSX.Element {
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState<SlotState[]>(defaultSlots());
  const [saved, setSaved] = useState(false);

  const doctors = useQuery<{ id: string; firstName: string; lastName: string; isActive: boolean }[]>({
    queryKey: ['schedule-doctors'],
    queryFn: async () => {
      const res = await window.clinic.doctors.list({ page: 1, pageSize: 100, search: '' });
      return (res as { data: { id: string; firstName: string; lastName: string; isActive: boolean }[] }).data;
    },
  });

  const selectedDoctor = (doctors.data ?? []).find((d) => d.id === doctorId);

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => doctorsService.update(doctorId, { isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule-doctors'] });
      void qc.invalidateQueries({ queryKey: ['doctors'] });
    },
  });

  const scheduleQuery = useQuery({
    queryKey: ['schedule', doctorId],
    queryFn: () => window.clinic.schedule.get(doctorId),
    enabled: Boolean(doctorId),
  });

  useEffect(() => {
    if (!scheduleQuery.data) return;
    const base = defaultSlots();
    for (const s of scheduleQuery.data) {
      const idx = base.findIndex((b) => b.dayOfWeek === s.dayOfWeek);
      if (idx >= 0) base[idx] = { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive };
    }
    setSlots(base);
  }, [scheduleQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => window.clinic.schedule.upsert(doctorId, slots),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule', doctorId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const updateSlot = (day: number, patch: Partial<SlotState>) =>
    setSlots((prev) => prev.map((s) => (s.dayOfWeek === day ? { ...s, ...patch } : s)));

  const doctorList = (doctors.data ?? []) as { id: string; firstName: string; lastName: string; isActive: boolean }[];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Doctor Schedule</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Set weekly availability for each doctor.
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" gap={3} flexWrap="wrap">
          <FormControl sx={{ minWidth: 280 }}>
            <InputLabel>Select Doctor</InputLabel>
            <Select
              label="Select Doctor"
              value={doctorId}
              onChange={(e) => { setDoctorId(e.target.value); setSlots(defaultSlots()); }}
              sx={{ borderRadius: 1 }}
            >
              {doctorList.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedDoctor && (
            <FormControlLabel
              control={
                <Switch
                  checked={selectedDoctor.isActive}
                  disabled={statusMutation.isPending}
                  onChange={(e) => statusMutation.mutate(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Typography fontSize={13.5} fontWeight={600} color={selectedDoctor.isActive ? 'success.dark' : 'text.secondary'}>
                  {selectedDoctor.isActive ? 'Active' : 'Inactive'}
                </Typography>
              }
            />
          )}
        </Stack>
      </Paper>

      {doctorId && (
        <>
          {scheduleQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={1.5}>
                {slots.map((slot) => (
                  <Box
                    key={slot.dayOfWeek}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '130px 1fr 1fr 80px',
                      alignItems: 'center',
                      gap: 2,
                      py: 1.25,
                      px: 2,
                      borderRadius: 2,
                      bgcolor: slot.isActive ? 'action.hover' : 'transparent',
                      opacity: slot.isActive ? 1 : 0.5,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Switch
                        size="small"
                        checked={slot.isActive}
                        onChange={(e) => updateSlot(slot.dayOfWeek, { isActive: e.target.checked })}
                        color="primary"
                      />
                      <Typography fontSize={13.5} fontWeight={slot.isActive ? 700 : 400}>
                        {DAYS[slot.dayOfWeek]}
                      </Typography>
                    </Box>
                    <TextField
                      label="Start"
                      type="time"
                      size="small"
                      value={slot.startTime}
                      disabled={!slot.isActive}
                      onChange={(e) => updateSlot(slot.dayOfWeek, { startTime: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      label="End"
                      type="time"
                      size="small"
                      value={slot.endTime}
                      disabled={!slot.isActive}
                      onChange={(e) => updateSlot(slot.dayOfWeek, { endTime: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    {slot.isActive ? (
                      <Chip label="Active" color="success" size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
                    ) : (
                      <Chip label="Off" size="small" sx={{ fontWeight: 600, fontSize: 11 }} />
                    )}
                  </Box>
                ))}
              </Stack>

              <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />}
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  sx={{ borderRadius: 2 }}
                >
                  Save schedule
                </Button>
                {saved && <Alert severity="success" sx={{ py: 0.5, px: 2, borderRadius: 2 }}>Schedule saved!</Alert>}
                {saveMutation.isError && <Alert severity="error" sx={{ py: 0.5, px: 2, borderRadius: 2 }}>Failed to save.</Alert>}
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
