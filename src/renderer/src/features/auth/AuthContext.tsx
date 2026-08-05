/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo, useEffect, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'lab_technician' | 'pharmacist';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean | string>;
  logout: () => void;
}

const STORAGE_KEY = 'clinic-auth-user';
const TOKEN_KEY = 'clinic-auth-token';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

let globalLogout: (() => void) | null = null;
export function triggerSessionExpiry(): void {
  globalLogout?.();
}

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && isTokenExpired(token)) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch { return null; }
  });

  const queryClient = useQueryClient();

  const logout = useMemo(() => () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    globalLogout = logout;
    const handler = () => logout();
    const permissionRevokedHandler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail || 'This role is not enabled for this clinic.';
      sessionStorage.setItem('clinic-auth-error', message);
      logout();
    };
    window.addEventListener('clinic:session-expired', handler);
    window.addEventListener('clinic:permission-revoked', permissionRevokedHandler);
    return () => {
      globalLogout = null;
      window.removeEventListener('clinic:session-expired', handler);
      window.removeEventListener('clinic:permission-revoked', permissionRevokedHandler);
    };
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !user) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) { logout(); return; }
    const timer = setTimeout(logout, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (email, password) => {
      const result = await window.clinic?.auth.login(email, password);
      if (!result) return false;
      // Blocked role (module disabled)
      if ('blocked' in result) return (result as { blocked: true; error?: string }).error || 'Access denied.';
      const authUser: AuthUser = {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role as UserRole,
        avatar: result.avatar,
      };
      setUser(authUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      if ('token' in result && result.token) localStorage.setItem(TOKEN_KEY, result.token as string);
      return true;
    },
    logout,
  }), [user, logout, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
