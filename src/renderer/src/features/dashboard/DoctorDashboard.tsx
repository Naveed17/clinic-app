import { alpha, Box, Typography, useTheme } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { appointmentsService } from '@/services/appointments.service';
import { AppointmentCalendar } from '@/components/AppointmentCalendar';
import type { Appointment } from '@/types/appointment';

export function DoctorDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();
  const theme = useTheme();
  const greeting = today.getHours() < 12 ? 'Morning' : today.getHours() < 17 ? 'Afternoon' : 'Evening';

  const { data: raw = [] } = useQuery({ queryKey: ['appointments'], queryFn: appointmentsService.list });
  const appointments = raw as Appointment[];

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Appointment['status'] }) => {
      const result = await appointmentsService.updateStatus(id, status);
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (error) => {
      console.error('status mutation error', error);
    },
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>
          Good {greeting},{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>{user?.name}</Box>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Here's what's on your agenda today.
        </Typography>
      </Box>
      <AppointmentCalendar
        appointments={appointments}
        onStatusChange={(id, status) => {
          console.log('status change clicked', id, status);
          statusMutation.mutate({ id, status: status as Appointment['status'] });
        }}
      />
    </Box>
  );
}

