import { Permission } from "@/auth/permissions";
import {
    Activity,
    BarChart3,
    CheckCircle,
    CreditCard,
    FileText,
    MapPin,
    Package,
    Users
} from 'lucide-react';
import React from "react";

export interface NavTab {
    label: string;
    path: string;
    icon: React.ReactNode;
    permission?: string;
    badge?: number | null;
}

export const ADMIN_TABS: NavTab[] = [
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
    },
    {
        label: 'Rate Confirmation',
        path: '/admin/billing',
        icon: <CreditCard className="w-4 h-4" />,
        badge: null,
        permission: Permission.RATES_VIEW,
    },
    {
        label: 'Billing Ready',
        path: '/admin/completed',
        icon: <CheckCircle className="w-4 h-4" />,
        badge: null,
        permission: Permission.BILLINGS_VIEW,
    },
    {
        label: 'Bills',
        path: '/admin/bills',
        icon: <FileText className="w-4 h-4" />,
        badge: null,
        permission: Permission.BILLINGS_VIEW,
    },
    {
        label: 'Run Activity',
        path: '/admin/runs',
        icon: <Activity className="w-4 h-4" />,
        badge: null,
        permission: Permission.RUNS_VIEW,
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
];
