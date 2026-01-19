'use client';

import AppHeader from '@/components/layout/AppHeader';
import {
  Calendar,
  CheckCircle,
  CreditCard,
  FileText,
  Package,
  Plus,
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
    label: 'Rate Config',
    path: '/admin/billing',
    icon: <CreditCard className="w-4 h-4" />,
    badge: null,
  },
  {
    label: 'Completed',
    path: '/admin/completed',
    icon: <CheckCircle className="w-4 h-4" />,
    badge: null,
  },
  {
    label: 'Customers',
    path: '/admin/customers',
    icon: <Users className="w-4 h-4" />,
    badge: null,
  },
  {
    label: 'Bills',
    path: '/admin/bills',
    icon: <FileText className="w-4 h-4" />,
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
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for hydration to complete
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isOrdersSection = pathname.startsWith('/admin/orders');
  const activeTab = tabs.find((tab) => pathname.startsWith(tab.path)) || tabs[0];

  const quickActions = [
    {
      label: 'Create Order',
      icon: <Plus className="w-4 h-4" />,
      onClick: () => router.push('/admin/orders/new'),
    },
    {
      label: 'Generate Report',
      icon: <FileText className="w-4 h-4" />,
      onClick: () => console.log('Generate Report'),
    },
    {
      label: 'Schedule Production',
      icon: <Calendar className="w-4 h-4" />,
      onClick: () => console.log('Schedule Production'),
    },
    {
      label: 'Customer Onboarding',
      icon: <Users className="w-4 h-4" />,
      onClick: () => router.push('/admin/customers/new'),
    },
  ];

  // Don't render interactive elements during SSR or before hydration
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const active = pathname.startsWith(tab.path);
                  return (
                    <div
                      key={tab.path}
                      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg mx-1 ${active ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600'
                        }`}
                    >
                      <span className={`${active ? 'text-blue-600' : 'text-gray-500'}`}>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <main className="px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* MAIN NAVIGATION BAR */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* LEFT - MAIN TABS */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const active = pathname.startsWith(tab.path);
                const hasBadge = tab.badge !== null;

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

                    {/* BADGE */}
                    {hasBadge && (
                      <span
                        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                      >
                        {tab.badge}
                      </span>
                    )}

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
      <main className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
