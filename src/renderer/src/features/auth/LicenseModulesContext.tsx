/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useMemo, type PropsWithChildren } from 'react';
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
}

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

interface LicenseModulesContextValue {
  modules: LicenseModules;
  loaded: boolean;
}

const LicenseModulesContext = createContext<LicenseModulesContextValue>({
  modules: NO_MODULES_ENABLED,
  loaded: false,
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

export function LicenseModulesProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState<LicenseModules>(NO_MODULES_ENABLED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const refreshModules = () => window.clinic.license.modules()
      .then((data: Record<string, boolean> | null) => {
        const nextModules = { ...NO_MODULES_ENABLED, ...data };
        setModules(nextModules);
        if (isRoleDisabled(user?.role, nextModules)) {
          sessionStorage.setItem('clinic-auth-error', 'This role is not enabled for this clinic.');
          logout();
        }
      })
      .catch(() => {
        if (isRoleDisabled(user?.role, NO_MODULES_ENABLED)) {
          sessionStorage.setItem('clinic-auth-error', 'This role is not enabled for this clinic.');
          logout();
        }
      }) // Without a verified cache, gated modules remain locked.
      .finally(() => setLoaded(true));

    void refreshModules();
    window.addEventListener('online', refreshModules);
    return () => window.removeEventListener('online', refreshModules);
  }, [logout, user?.role]);

  const value = useMemo(() => ({ modules, loaded }), [loaded, modules]);

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
