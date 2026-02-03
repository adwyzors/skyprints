'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthUser } from './auth.types';
import { fetchMe, redirectToLogin } from './authClient';
import { PUBLIC_ROUTES } from './publicRoutes';

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const redirectedRef = useRef(false);
  const requiresAuth = !isPublicRoute(pathname);

  useEffect(() => {
    if (!requiresAuth) {
      setLoading(false);
      return;
    }

    async function loadUser() {
      setLoading(true);

      const result = await fetchMe();

      switch (result.status) {
        case 'ok':
          setUser(result.user);
          setLoading(false);
          return;

        case 'unauthenticated':
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            redirectToLogin(pathname);
          }
          return;

        case 'forbidden':
          router.replace('/403'); // 👈 forbidden page
          return;

        default:
          router.replace('/error');
          return;
      }
    }

    loadUser();
  }, [pathname, requiresAuth, router]);

  const hasPermission = (permission: string) => !!user?.roles?.includes(permission);

  const hasAnyPermission = (permissions: string[]) =>
    permissions.some((p) => user?.roles?.includes(p));

  const hasAllPermissions = (permissions: string[]) =>
    permissions.every((p) => user?.roles?.includes(p));

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
        refresh: async () => {
          if (!requiresAuth) return;

          const result = await fetchMe();
          if (result.status === 'ok') {
            setUser(result.user);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
