import type { PropsWithChildren } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ROLE_HOME, canAccess, type AppRoute } from '@/app/access';
import { useAuth } from '@/features/auth/AuthContext';

interface RouteAccessGateProps {
  route: AppRoute;
}

export function RouteAccessGate({
  route,
  children,
}: PropsWithChildren<RouteAccessGateProps>): React.JSX.Element {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(user.role, route)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
