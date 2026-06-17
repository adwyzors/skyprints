"use client";

import { ADMIN_TABS } from "@/config/navigation";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { redirectToLogin } from "./authClient";
import { useAuth } from "./AuthProvider";
import { AuthUser } from "./auth.types";

type WithAuthOptions = {
    permission?: string;
};

export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    options?: WithAuthOptions
) {
    const ProtectedComponent: React.FC<P> = (props) => {
        const { isAuthenticated, hasPermission, loading, user } = useAuth();
        const pathname = usePathname();
        const router = useRouter();

        useEffect(() => {
            if (loading) return;

            if (!isAuthenticated) {
                console.warn("[AUTH] Not authenticated → redirect");
                redirectToLogin(pathname);
                return;
            }

            if (
                options?.permission &&
                !hasPermission(options.permission as any)
            ) {
                console.warn("[AUTH] Permission denied", options.permission);

                const userRole = (user as AuthUser | null)?.user?.role;

                if (userRole === 'MANAGER') {
                    router.replace('/manager/runs');
                    return;
                }

                // Admin: find the first authorized tab as a fallback
                const firstAllowedTab = ADMIN_TABS.find(tab =>
                    !tab.permission || hasPermission(tab.permission as any)
                );

                if (firstAllowedTab && firstAllowedTab.path !== pathname) {
                    router.replace(firstAllowedTab.path);
                } else {
                    router.replace("/403");
                }
            }
        }, [loading, isAuthenticated, pathname, router, hasPermission, user]);

        if (loading) return null;
        if (!isAuthenticated) return null;

        return <Component {...props} />;
    };

    ProtectedComponent.displayName =
        `withAuth(${Component.displayName || Component.name || "Component"})`;

    return ProtectedComponent;
}
