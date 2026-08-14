import type { UserRole } from '@/features/auth/AuthContext';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';

/** All app routes that have access control */
export type AppRoute =
  | '/dashboard'
  | '/patients'
  | '/patients/:id'
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
  '/dashboard':    ['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist'],
  '/patients':     ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/patients/:id': ['admin', 'doctor', 'receptionist', 'lab_technician'],
  '/appointments': ['admin', 'doctor', 'receptionist'],
  '/tokens':       ['admin', 'receptionist'],
  '/billing':      ['admin', 'receptionist', 'pharmacist'],
  '/lab':          ['admin', 'receptionist', 'lab_technician'],
  '/statistics':   ['admin'],
  '/users':        ['admin'],
  '/doctors':      ['admin'],
  '/schedule':     ['admin'],
  '/settings':     ['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist'],
  '/pharmacy':     ['pharmacist'],
};

/**
 * Which module key gates each route.
 * Routes not listed here are always accessible (no module gate).
 * Users list is core (admin can always add Receptionist). manageUsers only
 * gates extra admins + delete on the Users page itself.
 */
export const ROUTE_MODULE: Partial<Record<AppRoute, keyof LicenseModules>> = {
  '/billing':    'billing',
  '/lab':        'labDashboard',
  '/statistics': 'statistics',
  '/tokens':     'tokens',
  '/doctors':    'manageDoctors',
  '/schedule':   'manageDoctors',
  '/patients/:id': 'managePatients',
  '/pharmacy':   'pharmacy',
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
  role?: UserRole,
): boolean {
  if (!modules) return true;
  // Pharmacist billing is part of the pharmacy chain (meds + doctor fee invoice).
  if (route === '/billing' && role === 'pharmacist') {
    return isLicensed(modules, 'pharmacy') || isLicensed(modules, 'billing');
  }
  const key = ROUTE_MODULE[route];
  if (!key) return true;
  return isLicensed(modules, key);
}
