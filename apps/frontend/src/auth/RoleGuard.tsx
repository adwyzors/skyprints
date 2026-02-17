'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { redirectToLogin } from './authClient';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: string[]; // e.g. ['ADMIN', 'MANAGER']
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                redirectToLogin(window.location.pathname + window.location.search);
                return;
            }

            const userRole = user?.user?.role || '';

            // If user has no role or role is not allowed
            if (!allowedRoles.includes(userRole)) {
                // Redirect logic based on role
                if (userRole === 'MANAGER') {
                    router.replace('/manager/runs');
                } else if (userRole === 'ADMIN') {
                    router.replace('/admin/orders'); // Default admin landing
                } else {
                    router.replace('/403');
                }
            }
        }
    }, [loading, isAuthenticated, user, allowedRoles, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    // Double check render condition to prevent flash of content
    if (!user || !allowedRoles.includes(user.user.role)) {
        return null;
    }

    return <>{children}</>;
}
