import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { PatientProfilePage } from '@/features/patients/PatientProfilePage';
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { AppointmentDetailPage } from '@/features/appointments/AppointmentDetailPage';
import { InvoicesPage } from '@/features/billing/InvoicesPage';
import { InvoiceDetailPage } from '@/features/billing/InvoiceDetailPage';
import { OpdReportsPage } from '@/features/reports/OpdReportsPage';
import { OpdFeeDetailPage } from '@/features/reports/OpdFeeDetailPage';
import { MedicinesPage } from '@/features/medicines/MedicinesPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { LabPage } from '@/features/lab/LabPage';
import { LabOrderDetailPage } from '@/features/lab/LabOrderDetailPage';
import { UsersPage } from '@/features/users/UsersPage';
import { DoctorsPage } from '@/features/doctors/DoctorsPage';
import { DoctorDetailPage } from '@/features/doctors/DoctorDetailPage';
import { DoctorSchedulePage } from '@/features/doctors/DoctorSchedulePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { TokensPage } from '@/features/tokens/TokensPage';
import { WaitingRoomPage } from '@/features/waiting-room/WaitingRoomPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteAccessGate } from '@/components/RouteAccessGate';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { LicensePage } from '@/features/auth/LicensePage';
import { LicenseDisabledOverlay } from '@/features/auth/LicenseDisabledOverlay';
import { SetupWizard } from '@/features/auth/SetupWizard';
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import { CircularProgress } from '@mui/material';
import careflowLogo from '@/assets/careflow-logo.png';

const router = createHashRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        errorElement: <RouteErrorPage />,
        children: [
          {
            element: <AppShell />,
            errorElement: <RouteErrorPage />,
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
                  <RouteAccessGate route="/patients/:id">
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
                path: '/appointments/:id',
                element: (
                  <RouteAccessGate route="/appointments">
                    <AppointmentDetailPage />
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
                path: '/billing/:id',
                element: (
                  <RouteAccessGate route="/billing">
                    <InvoiceDetailPage />
                  </RouteAccessGate>
                ),
              },
              {
                path: '/opd-reports',
                element: (
                  <RouteAccessGate route="/opd-reports">
                    <OpdReportsPage />
                  </RouteAccessGate>
                ),
              },
              {
                path: '/opd-reports/invoices/:id',
                element: (
                  <RouteAccessGate route="/opd-reports">
                    <InvoiceDetailPage />
                  </RouteAccessGate>
                ),
              },
              {
                path: '/opd-reports/fees/:id',
                element: (
                  <RouteAccessGate route="/opd-reports">
                    <OpdFeeDetailPage />
                  </RouteAccessGate>
                ),
              },
              {
                path: '/medicines',
                element: (
                  <RouteAccessGate route="/medicines">
                    <MedicinesPage />
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
                path: '/lab/:id',
                element: (
                  <RouteAccessGate route="/lab">
                    <LabOrderDetailPage />
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
                path: '/doctors/:id',
                element: (
                  <RouteAccessGate route="/doctors">
                    <DoctorDetailPage />
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
                path: '/waiting-room',
                element: (
                  <RouteAccessGate route="/waiting-room">
                    <WaitingRoomPage />
                  </RouteAccessGate>
                ),
              },
              {
                path: '/chat',
                element: (
                  <RouteAccessGate route="/chat">
                    <ChatPage />
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
    ],
  },
]);


export function AppRouter(): React.JSX.Element {
  const [gate, setGate] = useState<{ state: 'ok' | 'none' | 'blocked'; reason?: string } | null>(null);
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const loadSetup = useCallback(() => {
    void window.clinic.settings.get().then((s) => setSetupDone(Boolean(s.setupDone)));
  }, []);

  const refreshGate = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setChecking(true);
    try {
      const next = await window.clinic.license.gate();
      setGate(next);
      if (next.state === 'ok') loadSetup();
    } catch {
      setGate((prev) => prev ?? { state: 'none' });
    } finally {
      if (!opts?.silent) setChecking(false);
    }
  }, [loadSetup]);

  useEffect(() => {
    void refreshGate();
  }, [refreshGate]);

  useEffect(() => {
    if (gate?.state !== 'blocked' && gate?.state !== 'ok') return;
    const ms = gate.state === 'blocked' ? 12_000 : 30_000;
    const id = window.setInterval(() => {
      void refreshGate({ silent: true });
    }, ms);
    return () => window.clearInterval(id);
  }, [gate?.state, refreshGate]);

  if (gate === null || (gate.state === 'ok' && setupDone === null)) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
          userSelect: 'none',
        }}
      >
        {/* Real CareFlow App Logo */}
        <Box
          sx={{
            width: 74,
            height: 74,
            mb: 2.5,
            borderRadius: 3.5,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1.2,
            boxShadow: 2,
          }}
        >
          <Box
            component="img"
            src={careflowLogo}
            alt="CareFlow"
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </Box>

        {/* Brand Title: CareFlow */}
        <Box
          sx={{
            fontSize: 26,
            fontWeight: 800,
            color: 'text.primary',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Care<Box component="span" sx={{ color: 'primary.main' }}>Flow</Box>
        </Box>

        {/* Subtitle */}
        <Box
          sx={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            mt: 0.6,
            mb: 3.5,
          }}
        >
          Clinic Management System
        </Box>

        {/* Matte Primary Emerald Spinner */}
        <CircularProgress
          size={36}
          thickness={3.6}
          color="primary"
        />

        {/* Status Text */}
        <Box
          sx={{
            fontSize: 12.5,
            fontWeight: 500,
            color: 'text.secondary',
            mt: 2,
            letterSpacing: '0.02em',
          }}
        >
          Starting CareFlow...
        </Box>
      </Box>
    );
  }

  if (gate.state === 'none') {
    return <LicensePage onActivated={() => {
      setGate({ state: 'ok' });
      loadSetup();
    }} />;
  }

  if (gate.state === 'blocked') {
    return (
      <LicenseDisabledOverlay
        reason={gate.reason || 'This license has been disabled. Contact CareFlow customer support.'}
        checking={checking}
        onCheck={() => void refreshGate()}
      />
    );
  }

  if (!setupDone) {
    return <SetupWizard onDone={() => setSetupDone(true)} />;
  }

  return <RouterProvider router={router} />;
}
