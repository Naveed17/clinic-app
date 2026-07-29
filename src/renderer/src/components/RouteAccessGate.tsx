import type { PropsWithChildren } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ROLE_HOME, canAccess, isModuleEnabled, type AppRoute } from '@/app/access';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';

interface RouteAccessGateProps {
  route: AppRoute;
}

export function RouteAccessGate({
  route,
  children,
}: PropsWithChildren<RouteAccessGateProps>): React.JSX.Element {
  const { user } = useAuth();
  const modules = useLicenseModules();

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, route)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  if (user.role !== 'admin' && !isModuleEnabled(modules, route)) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return children ? <>{children}</> : <Outlet />;
}
