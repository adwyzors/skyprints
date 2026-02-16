'use client';

import RoleGuard from '@/auth/RoleGuard';
import AppHeader from '@/components/layout/AppHeader';
import {
    Activity,
    CheckCircle,
    ChevronLeft,
    ChevronUp,
    CreditCard,
    FileText,
    MapPin,
    Package,
    Users
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const tabs = [
    // {
    //   label: 'Dashboard',
    //   path: '/admin/dashboard',
    //   icon: <Home className="w-4 h-4" />,
    //   badge: null,
    // },
    {
        label: 'Orders',
        path: '/admin/orders',
        icon: <Package className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Rate Confirmation',
        path: '/admin/billing',
        icon: <CreditCard className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Billing Ready',
        path: '/admin/completed',
        icon: <CheckCircle className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Bills',
        path: '/admin/bills',
        icon: <FileText className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Run Activity',
        path: '/admin/runs',
        icon: <Activity className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Customers',
        path: '/admin/customers',
        icon: <Users className="w-4 h-4" />,
        badge: null,
    },
    {
        label: 'Locations',
        path: '/admin/locations',
        icon: <MapPin className="w-4 h-4" />,
        badge: null,
    },

    // {
    //   label: 'Reports',
    //   path: '/admin/reports',
    //   icon: <BarChart3 className="w-4 h-4" />,
    //   badge: null,
    // },
];



export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isHydrated, setIsHydrated] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Wait for hydration to complete
    useEffect(() => {
        setIsHydrated(true);
        // Load preference from localStorage if available
        const saved = localStorage.getItem('admin-sidebar-collapsed');
        if (saved !== null) {
            setIsSidebarCollapsed(saved === 'true');
        }
    }, []);

    const toggleSidebar = () => {
        const newState = !isSidebarCollapsed;
        setIsSidebarCollapsed(newState);
        localStorage.setItem('admin-sidebar-collapsed', String(newState));
    };

    // Scroll listener for header visibility
    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        const el = e.currentTarget;

        const currentScrollY = el.scrollTop;
        const maxScroll = el.scrollHeight - el.clientHeight;
        const scrollDelta = currentScrollY - lastScrollY;

        const isNearTop = currentScrollY <= 20;
        const isNearBottom = currentScrollY >= maxScroll - 20;

        // Do nothing near boundaries (prevents bounce glitch)
        if (isNearTop || isNearBottom) {
            setLastScrollY(currentScrollY);
            return;
        }

        if (scrollDelta > 8 && currentScrollY > 80) {
            setIsHeaderVisible(false);
        } else if (scrollDelta < -8) {
            setIsHeaderVisible(true);
        }

        setLastScrollY(currentScrollY);
    };


    if (!isHydrated) {
        return (
            <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
                <AppHeader />
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-16 bg-white border-r border-gray-200" />
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        );
    }

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="h-screen bg-gray-50 flex flex-col overflow-hidden relative">
                {/* GLOBAL TOP HEADER - SCROLL AWARE */}
                <div
                    className={`
                        transition-all duration-300 ease-in-out z-50 overflow-hidden flex-shrink-0
                        ${isHeaderVisible ? 'h-[56px] opacity-100' : 'h-0 opacity-0 pointer-events-none'}
                    `}
                >
                    <AppHeader />
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* COLLAPSIBLE VERTICAL SIDEBAR (Desktop) */}
                    <aside
                        className={`
                            hidden md:flex bg-white border-r border-gray-200 flex-col transition-all duration-300 ease-in-out z-40
                            ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}
                        `}
                    >
                        {/* NAVIGATION LINKS */}
                        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 scrollbar-hide">
                            {tabs.map((tab) => {
                                const active = pathname.startsWith(tab.path);
                                const hasBadge = tab.badge !== null;

                                return (
                                    <button
                                        key={tab.path}
                                        onClick={() => router.push(tab.path)}
                                        className={`
                                            relative flex items-center h-11 w-full rounded-xl transition-all duration-200 group
                                            ${active
                                                ? 'bg-blue-50 text-blue-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                            }
                                        `}
                                        title={isSidebarCollapsed ? tab.label : ''}
                                    >
                                        <div className={`flex items-center justify-center min-w-[48px] ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                            {tab.icon}
                                        </div>

                                        <span
                                            className={`
                                                font-medium text-sm whitespace-nowrap transition-all duration-300 overflow-hidden
                                                ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}
                                            `}
                                        >
                                            {tab.label}
                                        </span>

                                        {/* ACTIVE INDICATOR (VERTICAL) */}
                                        {active && (
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full" />
                                        )}

                                        {/* BADGE */}
                                        {hasBadge && !isSidebarCollapsed && (
                                            <span className="ml-auto mr-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                                                {tab.badge}
                                            </span>
                                        )}
                                        {hasBadge && isSidebarCollapsed && (
                                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 border border-white" />
                                        )}
                                    </button>
                                );
                            })}
                        </nav>

                        {/* SIDEBAR FOOTER / COLLAPSE TOGGLE */}
                        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={toggleSidebar}
                                className="flex items-center h-10 w-full rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm transition-all group"
                            >
                                <div className="flex items-center justify-center min-w-[48px]">
                                    {isSidebarCollapsed ? <ChevronUp className="w-5 h-5 rotate-90" /> : <ChevronLeft className="w-5 h-5" />}
                                </div>
                                <span
                                    className={`
                                        text-xs font-semibold uppercase tracking-wider transition-all duration-300 overflow-hidden
                                        ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}
                                    `}
                                >
                                    Collapse Menu
                                </span>
                            </button>
                        </div>
                    </aside>

                    {/* MAIN CONTENT AREA */}
                    <main
                        className="flex-1 overflow-y-auto scrollbar-hide bg-gray-50/30 pb-20 md:pb-0"
                        onScroll={handleScroll}
                    >
                        <div className="w-full h-full">
                            {children}
                        </div>
                    </main>

                    {/* BOTTOM NAVIGATION (Mobile) */}
                    <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-x-auto scrollbar-hide">
                        <div className="flex items-center justify-between p-2 min-w-max">
                            {tabs.map((tab) => {
                                const active = pathname.startsWith(tab.path);
                                const hasBadge = tab.badge !== null;

                                return (
                                    <button
                                        key={tab.path}
                                        onClick={() => router.push(tab.path)}
                                        className={`
                                            flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all duration-200
                                            ${active
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                                                : 'text-gray-500 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <div className="relative">
                                            {tab.icon}
                                            {hasBadge && (
                                                <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white ${active ? 'bg-orange-500' : 'bg-blue-600 text-white'}`}>
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">
                                            {tab.label.split(' ')[0]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            </div>
        </RoleGuard>
    );
}
