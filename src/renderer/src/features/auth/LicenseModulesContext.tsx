/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useMemo, type PropsWithChildren } from 'react';

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
}

const ALL_ENABLED: LicenseModules = {
  doctorDashboard: true,
  labDashboard: true,
  billing: true,
  reports: true,
  statistics: true,
  tokens: true,
  manageDoctors: true,
  managePatients: true,
  manageMedicines: true,
  manageUsers: true,
};

const LicenseModulesContext = createContext<LicenseModules>(ALL_ENABLED);

export function LicenseModulesProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [modules, setModules] = useState<LicenseModules>(ALL_ENABLED);

  useEffect(() => {
    window.clinic.license.modules()
      .then((data: Record<string, boolean> | null) => {
        if (data) setModules({ ...ALL_ENABLED, ...data });
      })
      .catch(() => {}); // offline fallback: all enabled
  }, []);

  const value = useMemo(() => modules, [modules]);

  return (
    <LicenseModulesContext.Provider value={value}>
      {children}
    </LicenseModulesContext.Provider>
  );
}

export function useLicenseModules(): LicenseModules {
  return useContext(LicenseModulesContext);
}
