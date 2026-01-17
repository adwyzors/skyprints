"use client";

import { usePathname } from "next/navigation";
import React, { useEffect } from "react";
import { redirectToLogin } from "./authClient";
import { useAuth } from "./useAuth";

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
        console.warn("[AUTH] Not authenticated → redirect");
        redirectToLogin(pathname);
        return;
      }

      if (
        options?.permission &&
        !hasPermission(options.permission)
      ) {
        console.warn("[AUTH] Permission denied", options.permission);
        window.location.href = "/403";
      }
    }, [loading, isAuthenticated, pathname]);

    if (loading) return null;
    if (!isAuthenticated) return null;

    return <Component {...props} />;
  };

  ProtectedComponent.displayName =
    `withAuth(${Component.displayName || Component.name || "Component"})`;

  return ProtectedComponent;
}
