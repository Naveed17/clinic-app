import { MessageBar, MessageBarBody, makeStyles, tokens } from '@fluentui/react-components';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense, useLicenseModulesLoaded } from '@/features/auth/LicenseModulesContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/features/dashboard/DoctorDashboard';
import { ReceptionistDashboard } from '@/features/dashboard/ReceptionistDashboard';
import { LabDashboard } from '@/features/dashboard/LabDashboard';
import { StatCardsSkeleton } from '@/components/LoadingUI';

const useStyles = makeStyles({
  pad: {
    padding: tokens.spacingVerticalS,
  },
});

function RoleDisabled(): React.JSX.Element {
  return (
    <MessageBar intent="error">
      <MessageBarBody>This role is not enabled for this clinic.</MessageBarBody>
    </MessageBar>
  );
}

export function DashboardPage(): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const modulesLoaded = useLicenseModulesLoaded();

  if (!modulesLoaded && user?.role !== 'doctor') {
    return (
      <div className={styles.pad}>
        <StatCardsSkeleton count={4} />
      </div>
    );
  }

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'doctor':
      return !modulesLoaded || can('doctorDashboard') ? <DoctorDashboard /> : <RoleDisabled />;
    case 'receptionist':
      return <ReceptionistDashboard />;
    case 'lab_technician':
      return can('labDashboard') ? <LabDashboard /> : <RoleDisabled />;
    case 'pharmacist':
      return <RoleDisabled />;
    default:
      return <AdminDashboard />;
  }
}
