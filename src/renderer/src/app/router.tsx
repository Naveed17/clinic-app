import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { PatientProfilePage } from '@/features/patients/PatientProfilePage';
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { InvoicesPage } from '@/features/billing/InvoicesPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { LabPage } from '@/features/lab/LabPage';
import { UsersPage } from '@/features/users/UsersPage';
import { DoctorsPage } from '@/features/doctors/DoctorsPage';
import { DoctorSchedulePage } from '@/features/doctors/DoctorSchedulePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { TokensPage } from '@/features/tokens/TokensPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteAccessGate } from '@/components/RouteAccessGate';
import { LicensePage } from '@/features/auth/LicensePage';
import { useState, useEffect } from 'react';

const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: '/dashboard',
            element: (
              <RouteAccessGate route="/dashboard">
                <DashboardPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/patients',
            element: (
              <RouteAccessGate route="/patients">
                <PatientsPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/patients/:id',
            element: (
              <RouteAccessGate route="/patients">
                <PatientProfilePage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/appointments',
            element: (
              <RouteAccessGate route="/appointments">
                <AppointmentsPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/billing',
            element: (
              <RouteAccessGate route="/billing">
                <InvoicesPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/lab',
            element: (
              <RouteAccessGate route="/lab">
                <LabPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/statistics',
            element: (
              <RouteAccessGate route="/statistics">
                <StatisticsPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/users',
            element: (
              <RouteAccessGate route="/users">
                <UsersPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/doctors',
            element: (
              <RouteAccessGate route="/doctors">
                <DoctorsPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/schedule',
            element: (
              <RouteAccessGate route="/schedule">
                <DoctorSchedulePage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/tokens',
            element: (
              <RouteAccessGate route="/tokens">
                <TokensPage />
              </RouteAccessGate>
            ),
          },
          {
            path: '/settings',
            element: (
              <RouteAccessGate route="/settings">
                <SettingsPage />
              </RouteAccessGate>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export function AppRouter(): React.JSX.Element {
  const [licensed, setLicensed] = useState<boolean | null>(null);

  useEffect(() => {
    window.clinic.license.status().then((ok) => setLicensed(ok));
  }, []);

  if (licensed === null) return <></>;
  if (!licensed) return <LicensePage onActivated={() => setLicensed(true)} />;

  return <RouterProvider router={router} />;
}
