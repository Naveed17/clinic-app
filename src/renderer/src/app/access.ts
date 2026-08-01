import type { UserRole } from '@/features/auth/AuthContext';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';

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
  | '/settings'
  | '/pharmacy';

/** Which roles can access each route */
export const ROUTE_ACCESS: Record<AppRoute, UserRole[]> = {
  '/dashboard':    ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/patients':     ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/appointments': ['admin', 'doctor', 'receptionist'],
  '/tokens':       ['admin', 'receptionist'],
  '/billing':      ['admin', 'receptionist'],
  '/lab':          ['admin', 'receptionist', 'lab_technician'],
  '/statistics':   ['admin'],
  '/users':        ['admin'],
  '/doctors':      ['admin'],
  '/schedule':     ['admin'],
  '/settings':     ['admin'],
  '/pharmacy':     ['admin', 'receptionist'],
};

/**
 * Which module key gates each route.
 * Routes not listed here are always accessible (no module gate).
 */
export const ROUTE_MODULE: Partial<Record<AppRoute, keyof LicenseModules>> = {
  '/billing':    'billing',
  '/lab':        'labDashboard',
  '/statistics': 'statistics',
  '/tokens':     'tokens',
  '/doctors':    'manageDoctors',
  '/schedule':   'manageDoctors',
  '/users':      'manageUsers',
  '/patients':   'managePatients',
  '/pharmacy':   'pharmacy',
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

export function isModuleEnabled(modules: LicenseModules | undefined, route: AppRoute): boolean {
  if (!modules) return true;
  const key = ROUTE_MODULE[route];
  if (!key) return true;
  return modules[key] ?? true;
}
