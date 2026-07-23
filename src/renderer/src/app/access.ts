import type { UserRole } from '@/features/auth/AuthContext';

/** All app routes that have access control */
export type AppRoute =
  | '/dashboard'
  | '/patients'
  | '/appointments'
  | '/tokens'
  | '/billing'
  | '/lab'
  | '/statistics'
  | '/users'
  | '/doctors'
  | '/schedule'
  | '/settings';

/** Which roles can access each route */
export const ROUTE_ACCESS: Record<AppRoute, UserRole[]> = {
  '/dashboard':    ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/patients':     ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/appointments': ['admin', 'doctor', 'receptionist'],
  '/tokens':       ['admin', 'doctor', 'receptionist'],
  '/billing':      ['admin', 'receptionist'],
  '/lab':          ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/statistics':   ['admin'],
  '/users':        ['admin'],
  '/doctors':      ['admin'],
  '/schedule':     ['admin'],
  '/settings':     ['admin'],
};

/** First route a role lands on after login */
export const ROLE_HOME: Record<UserRole, AppRoute> = {
  admin:          '/dashboard',
  doctor:         '/dashboard',
  receptionist:   '/dashboard',
  lab_technician: '/lab',
};

export function canAccess(role: UserRole, route: AppRoute): boolean {
  return ROUTE_ACCESS[route]?.includes(role) ?? false;
}
