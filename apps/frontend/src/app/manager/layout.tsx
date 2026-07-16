'use client';

import RoleGuard from '@/auth/RoleGuard';
import AppHeader from '@/components/layout/AppHeader';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allowedRoles={['MANAGER', 'ADMIN', 'SUPER_ADMIN']}>
            <div className="min-h-screen bg-gray-50">
                <AppHeader />


                {/* MAIN CONTENT */}
                <main className="px-4 sm:px-4 lg:px-6 pb-6">
                    <div className="w-full mx-auto">{children}</div>
                </main>
            </div>
        </RoleGuard>
    );
}
