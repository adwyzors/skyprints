'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthUser } from './auth.types';
import { clearSession, fetchMe, redirectToLogin } from './authClient';
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
    profiles: { index: number; user: { id: string; name: string; email: string; role: string } }[];
    activeIndex: number;
    switchAccount: (index: number) => void;
    addAccount: () => void;
    logoutAll: () => Promise<void>;
}

function getActiveIndexFromCookie(): number {
    if (typeof window === 'undefined') return 0;
    const match = document.cookie.match(/(^|;)\s*active_account_index\s*=\s*([^;]+)/);
    return match ? Number(match[2]) : 0;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<{ index: number; user: { id: string; name: string; email: string; role: string } }[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);

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

            const activeIdx = getActiveIndexFromCookie();
            setActiveIndex(activeIdx);

            try {
                const result = await fetchMe();

                switch (result.status) {
                    case 'ok':
                        setUser(result.user);
                        try {
                            const API = process.env.NEXT_PUBLIC_API_URL;
                            const profilesRes = await fetch(`${API}/auth/profiles`, { credentials: 'include' });
                            if (profilesRes.ok) {
                                const profilesData = await profilesRes.json();
                                setProfiles(profilesData);
                            }
                        } catch (err) {
                            console.error('Failed to fetch active profiles', err);
                        }
                        break;
                    case 'unauthenticated':
                        if (!redirectedRef.current) {
                            redirectedRef.current = true;
                            redirectToLogin(pathname, activeIdx);
                        }
                        break;
                    case 'forbidden':
                        // Account disabled or deleted — clear cookies and go to login
                        if (!redirectedRef.current) {
                            redirectedRef.current = true;
                            await clearSession();
                            redirectToLogin(pathname, activeIdx);
                        }
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

    const hasPermission = useMemo(() => (permission: string) => !!user?.permissions?.includes(permission), [user]);

    const hasAnyPermission = useMemo(() => (permissions: string[]) =>
        permissions.some((p) => user?.permissions?.includes(p)), [user]);

    const hasAllPermissions = useMemo(() => (permissions: string[]) =>
        permissions.every((p) => user?.permissions?.includes(p)), [user]);

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
        if (pathname.startsWith('/admin') && !['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
            return false;
        }

        if (pathname.startsWith('/manager') && !['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)) {
            return false;
        }

        return true;
    }, [pathname, user, isAuthenticated]);

    // Redirect to role home if not authorized for the current path
    useEffect(() => {
        if (!loading && isAuthenticated && !isAuthorized && pathname !== '/403') {
            const userRole = user?.user?.role;
            if (userRole === 'MANAGER') {
                router.replace('/manager/runs');
            } else {
                router.replace('/403');
            }
        }
    }, [loading, isAuthenticated, isAuthorized, pathname, router, user]);

    // Apply user preferences (e.g., font size)
    useEffect(() => {
        const prefs = (user?.user as any)?.preferences;
        if (typeof window !== 'undefined' && prefs?.fontSize) {
            document.documentElement.className = `font-${prefs.fontSize}`;
        }
    }, [user]);

    const switchAccount = (index: number) => {
        if (typeof window !== 'undefined') {
            document.cookie = `active_account_index=${index}; path=/; max-age=${7 * 24 * 60 * 60}`;
            setActiveIndex(index);
            window.location.reload();
        }
    };

    const addAccount = () => {
        const loggedInIndices = profiles.map((p) => p.index);
        let nextIndex = 0;
        for (let i = 0; i < 5; i++) {
            if (!loggedInIndices.includes(i)) {
                nextIndex = i;
                break;
            }
        }
        redirectToLogin(pathname, nextIndex);
    };

    const handleLogoutAll = async () => {
        const { logoutAll } = await import('./authClient');
        await logoutAll();
    };

    const value = useMemo(() => ({
        user,
        isAuthenticated,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
        refresh,
        profiles,
        activeIndex,
        switchAccount,
        addAccount,
        logoutAll: handleLogoutAll,
    }), [user, loading, hasPermission, hasAnyPermission, hasAllPermissions, refresh, isAuthenticated, profiles, activeIndex]);

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
