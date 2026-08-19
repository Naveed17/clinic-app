export type SearchRole = 'admin' | 'doctor' | 'receptionist' | 'lab_technician' | 'pharmacist';

export type SearchScope = {
  patients: boolean;
  appointments: boolean;
  invoices: boolean;
  labOrders: boolean;
};

const EMPTY_SCOPE: SearchScope = {
  patients: false,
  appointments: false,
  invoices: false,
  labOrders: false,
};

function licensed(modules: Record<string, boolean> | undefined, key: string): boolean {
  return modules?.[key] === true;
}

export function normalizeSearchRole(role: string | undefined | null): SearchRole | null {
  if (
    role === 'admin' ||
    role === 'doctor' ||
    role === 'receptionist' ||
    role === 'lab_technician' ||
    role === 'pharmacist'
  ) {
    return role;
  }
  return null;
}

/** What global search may return — role access AND purchased license modules. */
export function getSearchScope(
  role: string | undefined | null,
  modules: Record<string, boolean> | undefined,
): SearchScope {
  const r = normalizeSearchRole(role);
  if (!r) return EMPTY_SCOPE;

  const billingOn = licensed(modules, 'billing');
  const labOn = licensed(modules, 'labDashboard');

  return {
    patients: r !== 'pharmacist',
    appointments: r === 'admin' || r === 'doctor' || r === 'receptionist',
    invoices: (r === 'admin' || r === 'receptionist') && billingOn,
    labOrders: (r === 'admin' || r === 'lab_technician') && labOn,
  };
}

export function searchPlaceholder(scope: SearchScope): string {
  const parts = [
    scope.patients ? 'patients' : null,
    scope.appointments ? 'appointments' : null,
    scope.invoices ? 'invoices' : null,
    scope.labOrders ? 'lab orders' : null,
  ].filter(Boolean);
  if (parts.length === 0) return 'Search…';
  return `Search ${parts.join(', ')}…`;
}
