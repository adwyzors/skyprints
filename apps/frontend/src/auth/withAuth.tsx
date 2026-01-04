// src/auth/withAuth.tsx
"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { redirectToLogin } from "./authClient";

type WithAuthOptions = {
  permission?: string;
};

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: WithAuthOptions
) {
  const ProtectedComponent: React.FC<P> = (props) => {
    const { isAuthenticated, hasPermission, loading } = useAuth();
    const pathname = usePathname();

    useEffect(() => {
      if (loading) return;

      if (!isAuthenticated) {
        redirectToLogin(pathname);
        return;
      }

      if (options?.permission && !hasPermission(options.permission)) {
        window.location.href = "/403"; //TODO: return null// if page /403 , if componenet null
      }
    }, [loading, isAuthenticated, pathname]);

    if (loading) return null;

    return <Component {...props} />;
  };

  ProtectedComponent.displayName = `withAuth(${Component.displayName || Component.name || "Component"})`;

  return ProtectedComponent;
}
