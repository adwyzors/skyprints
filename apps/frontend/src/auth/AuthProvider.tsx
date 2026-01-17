"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthUser } from "./auth.types";
import { fetchMe, redirectToLogin } from "./authClient";
import { PUBLIC_ROUTES } from "./publicRoutes";

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const redirectedRef = useRef(false);

  const requiresAuth = !isPublicRoute(pathname);

  useEffect(() => {
    // 🟢 Public route → no auth check
    if (!requiresAuth) {
      setLoading(false);
      return;
    }

    async function loadUser() {
      setLoading(true);

      const me = await fetchMe();

      if (!me && !redirectedRef.current) {
        redirectedRef.current = true;
        redirectToLogin(pathname);
        return;
      }

      setUser(me);
      setLoading(false);
    }

    loadUser();
  }, [pathname, requiresAuth]);

  const hasPermission = (permission: string) =>
    !!user?.permissions.includes(permission);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        hasPermission,
        loading,
        refresh: async () => {
          if (requiresAuth) {
            const me = await fetchMe();
            setUser(me);
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
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
