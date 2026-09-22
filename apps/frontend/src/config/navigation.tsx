import { Permission } from "@/auth/permissions";
import {
    Activity,
    BarChart3,
    Bell,
    CheckCircle,
    ClipboardList,
    CreditCard,
    FileText,
    MapPin,
    Package,
    UserCog,
    Users
} from 'lucide-react';
import React from "react";

export interface NavTab {
    label: string;
    path: string;
    icon: React.ReactNode;
    permission?: string;
    badge?: number | null;
    shortcut?: string;
}

export const ADMIN_TABS: NavTab[] = [
    {
        label: 'My Tasks',
        path: '/admin/my-tasks',
        icon: <ClipboardList className="w-4 h-4" />,
        badge: null,
        permission: Permission.RUNS_VIEW,
        shortcut: 'F2',
    },
    {
        label: 'Dashboard',
        path: '/admin/dashboard',
        icon: <BarChart3 className="w-4 h-4" />,
        badge: null,
        permission: Permission.ANALYTICS_VIEW,
    },
    {
        label: 'Orders',
        path: '/admin/orders',
        icon: <Package className="w-4 h-4" />,
        badge: null,
        permission: Permission.ORDERS_VIEW,
        shortcut: 'Ctrl+O',
    },
    {
        label: 'Run Activity',
        path: '/admin/runs',
        icon: <Activity className="w-4 h-4" />,
        badge: null,
        permission: Permission.RUNS_VIEW,
        shortcut: 'F3',
    },
    {
        label: 'Rate Confirmation',
        path: '/admin/billing',
        icon: <CreditCard className="w-4 h-4" />,
        badge: null,
        permission: Permission.RATES_VIEW,
        shortcut: 'F4',
    },
    {
        label: 'Billing Ready',
        path: '/admin/completed',
        icon: <CheckCircle className="w-4 h-4" />,
        badge: null,
        permission: Permission.BILLINGS_VIEW,
        shortcut: 'F6',
    },
    {
        label: 'Bills',
        path: '/admin/bills',
        icon: <FileText className="w-4 h-4" />,
        badge: null,
        permission: Permission.BILLINGS_VIEW,
        shortcut: 'F8',
    },
    {
        label: 'Reports',
        path: '/admin/reports',
        icon: <BarChart3 className="w-4 h-4" />,
        badge: null,
        permission: Permission.ANALYTICS_VIEW,
        shortcut: 'F9',
    },
    {
        label: 'Customers',
        path: '/admin/customers',
        icon: <Users className="w-4 h-4" />,
        badge: null,
        permission: Permission.CUSTOMERS_VIEW,
    },
    {
        label: 'Locations',
        path: '/admin/locations',
        icon: <MapPin className="w-4 h-4" />,
        badge: null,
        permission: Permission.LOCATIONS_VIEW,
    },
    {
        label: 'Users',
        path: '/admin/users',
        icon: <UserCog className="w-4 h-4" />,
        badge: null,
        permission: Permission.USERS_VIEW,
    },
    {
        label: 'Notifications',
        path: '/admin/notifications',
        icon: <Bell className="w-4 h-4" />,
        badge: null,
    },
];
