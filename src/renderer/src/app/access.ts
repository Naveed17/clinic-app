import type { UserRole } from '@/features/auth/AuthContext';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';

/** All app routes that have access control */
export type AppRoute =
  | '/dashboard'
  | '/patients'
  | '/patients/:id'
  | '/appointments'
  | '/tokens'
  | '/waiting-room'
  | '/billing'
  | '/lab'
  | '/statistics'
  | '/users'
  | '/doctors'
  | '/schedule'
  | '/settings';

/** Which roles can access each route */
export const ROUTE_ACCESS: Record<AppRoute, UserRole[]> = {
  '/dashboard':    ['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist'],
  '/patients':     ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/patients/:id': ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/appointments': ['admin', 'doctor', 'receptionist'],
  '/tokens':       ['admin', 'receptionist'],
  '/waiting-room': ['doctor'],
  '/billing':      ['admin', 'receptionist'],
  '/lab':          ['admin', 'lab_technician'],
  '/statistics':   ['admin'],
  '/users':        ['admin'],
  '/doctors':      ['admin'],
  '/schedule':     ['admin'],
  '/settings':     ['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist'],
};

/**
 * Which module key gates each route.
 * Routes not listed here are always accessible (no module gate).
 * `/waiting-room` is core doctor queue (not the Token System add-on).
 * `/tokens` (reception desk) stays gated by `tokens`.
 */
export const ROUTE_MODULE: Partial<Record<AppRoute, keyof LicenseModules>> = {
  '/billing':    'billing',
  '/lab':        'labDashboard',
  '/statistics': 'statistics',
  '/tokens':     'tokens',
  '/doctors':    'manageDoctors',
  '/schedule':   'manageDoctors',
  '/patients/:id': 'managePatients',
};

/** First route a role lands on after login */
export const ROLE_HOME: Record<UserRole, AppRoute> = {
  admin:          '/dashboard',
  doctor:         '/dashboard',
  receptionist:   '/dashboard',
  lab_technician: '/lab',
  pharmacist:     '/dashboard',
};

export function canAccess(role: UserRole, route: AppRoute): boolean {
  return ROUTE_ACCESS[route]?.includes(role) ?? false;
}

/** License flag must be explicitly true. */
export function isLicensed(
  modules: LicenseModules | undefined,
  key: keyof LicenseModules,
): boolean {
  return modules?.[key] === true;
}

export function isModuleEnabled(
  modules: LicenseModules | undefined,
  route: AppRoute,
  _role?: UserRole,
): boolean {
  if (!modules) return true;
  const key = ROUTE_MODULE[route];
  if (!key) return true;
  return isLicensed(modules, key);
}
