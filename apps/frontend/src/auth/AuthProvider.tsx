'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
    const isFetchingMe = useRef(false);
    const requiresAuth = !isPublicRoute(pathname);

    useEffect(() => {
        if (!requiresAuth || isFetchingMe.current) {
            if (!requiresAuth) setLoading(false);
            return;
        }

        async function loadUser() {
            isFetchingMe.current = true;
            setLoading(true);

            try {
                const result = await fetchMe();

                switch (result.status) {
                    case 'ok':
                        setUser(result.user);
                        break;
                    case 'unauthenticated':
                        if (!redirectedRef.current) {
                            redirectedRef.current = true;
                            redirectToLogin(pathname);
                        }
                        break;
                    case 'forbidden':
                        router.replace('/403');
                        break;
                    default:
                        router.replace('/error');
                        break;
                }
            } catch (err) {
                console.error('Failed to fetch user', err);
            } finally {
                setLoading(false);
                isFetchingMe.current = false;
            }
        }

        loadUser();
    }, [pathname, requiresAuth, router]);

    const hasPermission = useMemo(() => (permission: string) => !!user?.roles?.includes(permission), [user]);

    const hasAnyPermission = useMemo(() => (permissions: string[]) =>
        permissions.some((p) => user?.roles?.includes(p)), [user]);

    const hasAllPermissions = useMemo(() => (permissions: string[]) =>
        permissions.every((p) => user?.roles?.includes(p)), [user]);

    const refresh = useMemo(() => async () => {
        if (!requiresAuth) return;

        const result = await fetchMe();
        if (result.status === 'ok') {
            setUser(result.user);
        }
    }, [requiresAuth]);

    const isAuthenticated = !!user;

    const isAuthorized = useMemo(() => {
        if (isPublicRoute(pathname)) return true;
        if (!isAuthenticated || !user) return false;

        const userRole = user.user?.role || '';

        // Strict prefix-based protection
        if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
            return false;
        }

        if (pathname.startsWith('/manager') && !['ADMIN', 'MANAGER'].includes(userRole)) {
            return false;
        }

        return true;
    }, [pathname, user, isAuthenticated]);

    // Redirect to 403 if not authorized but authenticated
    useEffect(() => {
        if (!loading && isAuthenticated && !isAuthorized && pathname !== '/403') {
            router.replace('/403');
        }
    }, [loading, isAuthenticated, isAuthorized, pathname, router]);

    const value = useMemo(() => ({
        user,
        isAuthenticated,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
        refresh,
    }), [user, loading, hasPermission, hasAnyPermission, hasAllPermissions, refresh, isAuthenticated]);

    return (
        <AuthContext.Provider value={value}>
            {(isPublicRoute(pathname) || (isAuthenticated && isAuthorized)) ? (
                children
            ) : (
                loading ? (
                    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                            </div>
                        </div>
                        <p className="mt-4 text-sm font-bold text-gray-400 uppercase tracking-[0.2em] animate-pulse">Initializing Terminal</p>
                    </div>
                ) : null
            )}
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
