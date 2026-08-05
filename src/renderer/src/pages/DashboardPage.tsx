import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules, useLicenseModulesLoaded } from '@/features/auth/LicenseModulesContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/features/dashboard/DoctorDashboard';
import { ReceptionistDashboard } from '@/features/dashboard/ReceptionistDashboard';
import { LabDashboard } from '@/features/dashboard/LabDashboard';
import { PharmacistDashboard } from '@/features/dashboard/PharmacistDashboard';
import { Alert, Box, CircularProgress } from '@mui/material';

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();
  const modules = useLicenseModules();
  const modulesLoaded = useLicenseModulesLoaded();

  if (!modulesLoaded) {
    return <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }

  switch (user?.role) {
    case 'admin':          return <AdminDashboard />;
    case 'doctor':         return modules.doctorDashboard ? <DoctorDashboard /> : <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    case 'receptionist':   return <ReceptionistDashboard />;
    case 'lab_technician': return modules.labDashboard ? <LabDashboard /> : <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    case 'pharmacist':     return modules.pharmacy ? <PharmacistDashboard /> : <Alert severity="error">This role is not enabled for this clinic.</Alert>;
    default:               return <AdminDashboard />;
  }
}
