import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/features/dashboard/DoctorDashboard';
import { ReceptionistDashboard } from '@/features/dashboard/ReceptionistDashboard';
import { LabDashboard } from '@/features/dashboard/LabDashboard';

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();
  const modules = useLicenseModules();

  switch (user?.role) {
    case 'admin':          return <AdminDashboard />;
    case 'doctor':         return modules.doctorDashboard ? <DoctorDashboard /> : <ReceptionistDashboard />;
    case 'receptionist':   return <ReceptionistDashboard />;
    case 'lab_technician': return modules.labDashboard ? <LabDashboard /> : <ReceptionistDashboard />;
    default:               return <AdminDashboard />;
  }
}
