'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

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
                router.replace('/auth/login');
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
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Double check render condition to prevent flash of content
    if (!user || !allowedRoles.includes(user.user.role)) {
        return null;
    }

    return <>{children}</>;
}
