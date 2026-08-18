/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useAuth, type UserRole } from './AuthContext';

export interface LicenseModules {
  doctorDashboard: boolean;
  labDashboard: boolean;
  billing: boolean;
  reports: boolean;
  statistics: boolean;
  tokens: boolean;
  manageDoctors: boolean;
  managePatients: boolean;
  manageMedicines: boolean;
  manageUsers: boolean;
  pharmacy: boolean;
  whatsapp: boolean;
  ai: boolean;
  [key: string]: boolean;
}

const MODULE_KEYS = [
  'doctorDashboard',
  'labDashboard',
  'billing',
  'reports',
  'statistics',
  'tokens',
  'manageDoctors',
  'managePatients',
  'manageMedicines',
  'manageUsers',
  'pharmacy',
  'whatsapp',
  'ai',
] as const satisfies ReadonlyArray<keyof LicenseModules>;

const NO_MODULES_ENABLED: LicenseModules = {
  doctorDashboard: false,
  labDashboard: false,
  billing: false,
  reports: false,
  statistics: false,
  tokens: false,
  manageDoctors: false,
  managePatients: false,
  manageMedicines: false,
  manageUsers: false,
  pharmacy: false,
  whatsapp: false,
  ai: false,
};

/** Only known keys; missing/invalid → false (opt-in). */
export function normalizeLicenseModules(
  data?: Record<string, boolean> | null,
): LicenseModules {
  const next = { ...NO_MODULES_ENABLED };
  if (!data || typeof data !== 'object') return next;
  for (const key of MODULE_KEYS) {
    next[key] = data[key] === true;
  }
  return next;
}

interface LicenseModulesContextValue {
  modules: LicenseModules;
  loaded: boolean;
  refreshModules: () => Promise<void>;
}

const LicenseModulesContext = createContext<LicenseModulesContextValue>({
  modules: NO_MODULES_ENABLED,
  loaded: false,
  refreshModules: async () => undefined,
});

function isRoleDisabled(role: UserRole | undefined, modules: LicenseModules): boolean {
  const roleModule: Partial<Record<UserRole, keyof LicenseModules>> = {
    doctor: 'doctorDashboard',
    lab_technician: 'labDashboard',
    pharmacist: 'pharmacy',
  };
  const moduleKey = role ? roleModule[role] : undefined;
  return Boolean(moduleKey && !modules[moduleKey]);
}

function modulesEqual(a: LicenseModules, b: LicenseModules): boolean {
  return MODULE_KEYS.every((key) => a[key] === b[key]);
}

export function LicenseModulesProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState<LicenseModules>(NO_MODULES_ENABLED);
  const [loaded, setLoaded] = useState(false);

  const refreshModules = useCallback(async () => {
    try {
      const data = await window.clinic.license.modules();
      const nextModules = normalizeLicenseModules(data);
      setModules((prev) => (modulesEqual(prev, nextModules) ? prev : nextModules));
      if (isRoleDisabled(user?.role, nextModules)) {
        sessionStorage.setItem('clinic-auth-error', 'This role is not enabled for this clinic.');
        logout();
      }
    } catch {
      if (isRoleDisabled(user?.role, NO_MODULES_ENABLED)) {
        sessionStorage.setItem('clinic-auth-error', 'This role is not enabled for this clinic.');
        logout();
      }
    } finally {
      setLoaded(true);
    }
  }, [logout, user?.role]);

  useEffect(() => {
    void refreshModules();

    const onOnline = () => {
      void refreshModules();
    };
    const onFocus = () => {
      void refreshModules();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      void refreshModules();
    }, 30_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [refreshModules]);

  const value = useMemo(
    () => ({ modules, loaded, refreshModules }),
    [loaded, modules, refreshModules],
  );

  return (
    <LicenseModulesContext.Provider value={value}>
      {children}
    </LicenseModulesContext.Provider>
  );
}

export function useLicenseModules(): LicenseModules {
  return useContext(LicenseModulesContext).modules;
}

export function useLicenseModulesLoaded(): boolean {
  return useContext(LicenseModulesContext).loaded;
}

export function useRefreshLicenseModules(): () => Promise<void> {
  return useContext(LicenseModulesContext).refreshModules;
}

/** Feature gate: `can('managePatients')` — explicit true only. */
export function useLicense(): LicenseModulesContextValue & {
  can: (key: keyof LicenseModules) => boolean;
} {
  const ctx = useContext(LicenseModulesContext);
  const can = useCallback(
    (key: keyof LicenseModules) => ctx.modules[key] === true,
    [ctx.modules],
  );
  return useMemo(() => ({ ...ctx, can }), [ctx, can]);
}
