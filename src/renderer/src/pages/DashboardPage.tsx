import { useAuth } from '@/features/auth/AuthContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/features/dashboard/DoctorDashboard';
import { ReceptionistDashboard } from '@/features/dashboard/ReceptionistDashboard';
import { LabDashboard } from '@/features/dashboard/LabDashboard';

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':          return <AdminDashboard />;
    case 'doctor':         return <DoctorDashboard />;
    case 'receptionist':   return <ReceptionistDashboard />;
    case 'lab_technician': return <LabDashboard />;
    default:               return <AdminDashboard />;
  }
}
