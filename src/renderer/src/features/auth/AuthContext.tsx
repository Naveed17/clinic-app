/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'lab_technician';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const STORAGE_KEY = 'clinic-auth-user';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch { return null; }
  });

  const queryClient = useQueryClient();

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (email, password) => {
      const result = await window.clinic?.auth.login(email, password);
      if (!result) return false;
      const authUser: AuthUser = {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role as UserRole,
        avatar: result.avatar,
      };
      setUser(authUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      return true;
    },
    logout: () => {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      queryClient.clear();
    },
  }), [user, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
