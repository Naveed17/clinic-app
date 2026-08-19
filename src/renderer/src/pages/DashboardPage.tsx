import { useAuth } from '@/features/auth/AuthContext';
import { useLicense, useLicenseModulesLoaded } from '@/features/auth/LicenseModulesContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/features/dashboard/DoctorDashboard';
import { ReceptionistDashboard } from '@/features/dashboard/ReceptionistDashboard';
import { LabDashboard } from '@/features/dashboard/LabDashboard';
import { Alert, Box } from '@mui/material';
import { StatCardsSkeleton } from '@/components/LoadingUI';

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();
  const { can } = useLicense();
  const modulesLoaded = useLicenseModulesLoaded();

  // Doctor calendar has its own skeleton — skip the 2-column stat cards flash.
  if (!modulesLoaded && user?.role !== 'doctor') {
    return (
      <Box sx={{ p: 1 }}>
        <StatCardsSkeleton count={4} />
      </Box>
    );
  }

  switch (user?.role) {
    case 'admin':          return <AdminDashboard />;
    case 'doctor':         return !modulesLoaded || can('doctorDashboard') ? <DoctorDashboard /> : <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    case 'receptionist':   return <ReceptionistDashboard />;
    case 'lab_technician': return can('labDashboard') ? <LabDashboard /> : <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    case 'pharmacist':     return <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    default:               return <AdminDashboard />;
  }
}
