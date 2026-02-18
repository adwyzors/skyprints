'use client';

import RoleGuard from '@/auth/RoleGuard';
import AppHeader from '@/components/layout/AppHeader';
import { Activity } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const tabs = [
    {
        label: 'My Runs',
        path: '/manager/runs',
        icon: <Activity className="w-4 h-4" />,
        badge: null,
    },
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
            <div className="min-h-screen bg-gray-50">
                <AppHeader />

                {/* MAIN NAVIGATION BAR */}
                <div className="top-14 z-40 bg-white border-b border-gray-200 shadow-sm">
                    <div className="px-4 sm:px-4 lg:px-6">
                        <div className="flex items-center justify-between h-14">
                            {/* LEFT - MAIN TABS */}
                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                                {tabs.map((tab) => {
                                    const active = pathname.startsWith(tab.path);

                                    return (
                                        <button
                                            key={tab.path}
                                            onClick={() => router.push(tab.path)}
                                            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-all duration-200 ${active
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className={`${active ? 'text-blue-600' : 'text-gray-500'}`}>
                                                {tab.icon}
                                            </span>
                                            <span>{tab.label}</span>

                                            {/* ACTIVE INDICATOR */}
                                            {active && (
                                                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-t-full" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <main className="px-4 sm:px-4 lg:px-6 pb-6">
                    <div className="w-full mx-auto">{children}</div>
                </main>
            </div>
        </RoleGuard>
    );
}
