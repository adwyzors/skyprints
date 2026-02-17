import { apiRequest } from './api.service';

export interface DailyAnalytics {
    date: string;
    totalRevenue: string;
    totalOrders: number;
    totalUnits: number;
    billedRevenue: string;
    billedOrders: number;
}

export interface ProcessAnalytics {
    processId: string;
    processName: string;
    totalRevenue: string;
    totalRuns: number;
    totalUnits: number;
    avgLeadTime: number;
}

export interface UserPerformance {
    userId: string;
    userName: string;
    role: string;
    runsExecuted: number;
    runsReviewed: number;
    totalBilledVolume: string;
    lastActiveAt: string;
}

export interface LocationAnalytics {
    locationId: string;
    locationName: string;
    totalRevenue: string;
    totalRuns: number;
    totalUnits: number;
}

export interface DashboardStats {
    daily: DailyAnalytics[];
    topProcesses: ProcessAnalytics[];
    topUsers: UserPerformance[];
    topLocations: LocationAnalytics[];
    currentWorkload: {
        byLocation: { id: string, name: string, count: number }[];
        byManager: { id: string, name: string, count: number }[];
    };
    productionState: {
        inConfig: number;
        ready: number;
        active: number;
        toBeBilled: number;
        toBeInvoiced: number;
        pendingRuns: number;
    } | null;
}

export async function getDashboardStats(period: string = '7d'): Promise<DashboardStats> {
    return apiRequest<DashboardStats>(`/analytics/dashboard?period=${period}`);
}

export async function syncAnalytics(): Promise<{ processed: number }> {
    return apiRequest<{ processed: number }>('/analytics/sync', { method: 'POST' });
}

export async function getResourceUtilization(): Promise<DashboardStats> {
    return apiRequest<DashboardStats>('/analytics/resources');
}
