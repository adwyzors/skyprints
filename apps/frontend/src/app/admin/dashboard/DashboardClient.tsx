'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { Location } from '@/domain/model/location.model';
import { DashboardStats, getDashboardStats, syncAnalytics } from '@/services/analytics.service';
import { getLocations } from '@/services/location.service';
import {
    Activity,
    CheckCircle2,
    Database,
    DollarSign,
    FileText,
    Layers,
    Loader2,
    MapPin,
    Package,
    RefreshCw,
    TrendingUp,
    Users,
    Zap
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

const PERIODS = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '6 Months', value: '6m' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' },
    { label: 'Custom', value: 'custom' },
];

function DashboardClientContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, hasPermission: hasAuthPermission } = useAuth();

    // Derive state from URL
    const period = searchParams.get('period') || '7d';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const locationId = searchParams.get('locationId') || '';

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);

    const preferences = (user as any)?.user?.preferences || {};
    const visibility = {
        revenue: preferences.showRevenue !== false,
        orders: preferences.showOrders !== false,
        units: preferences.showUnits !== false,
        hubs: preferences.showHubs !== false,
        pulse: preferences.showPulse !== false,
        chart: preferences.showChart !== false,
        performance: preferences.showPerformance !== false,
        processes: preferences.showProcesses !== false,
        customers: preferences.showCustomers !== false,
        workload: preferences.showWorkload !== false,
        matrix: preferences.showMatrix !== false,
    };

    const fetchStats = async (p: string, from?: string, to?: string, locId?: string) => {
        try {
            setLoading(true);
            const data = await getDashboardStats(p, from, to, locId);
            setStats(data);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const updateFilters = (params: Record<string, string>) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        Object.entries(params).forEach(([key, val]) => {
            if (val) nextParams.set(key, val);
            else nextParams.delete(key);
        });
        router.push(`/admin/dashboard?${nextParams.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const loadLocations = async () => {
            try {
                const locs = await getLocations();
                setLocations(locs);
            } catch (error) {
                console.error('Failed to load locations:', error);
            }
        };
        loadLocations();
    }, []);

    useEffect(() => {
        if (period === 'custom') {
            if (startDate && endDate) {
                fetchStats(period, startDate, endDate, locationId);
            }
        } else {
            fetchStats(period, undefined, undefined, locationId);
        }
    }, [period, startDate, endDate, locationId]);

    useEffect(() => {
        if (!searchParams.get('period')) {
            updateFilters({ period: '7d' });
        }
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchStats(period, startDate, endDate, locationId);
    };

    const handleSync = async () => {
        if (!confirm('This will re-calculate all analytics from historical data using actual order completion dates. Continue?')) return;
        try {
            setIsSyncing(true);
            const result = await syncAnalytics();
            alert(`Sync completed! Processed ${result.processed} snapshots.`);
            fetchStats(period);
        } catch (error) {
            alert('Sync failed. Check console for details.');
        } finally {
            setIsSyncing(false);
        }
    };

    const chartData = useMemo(() => {
        if (!stats?.daily || stats.daily.length === 0) return [];
        return stats.daily.map(d => ({
            date: new Date(d.date),
            revenue: parseFloat(d.billedRevenue),
            orders: d.billedOrders,
            units: d.totalUnits
        }));
    }, [stats]);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!stats) return <div className="p-8 text-center text-red-500 bg-white rounded-xl border border-red-100">Failed to load analytics data.</div>;

    const totalRevenue = stats.daily.reduce((sum, d) => sum + (parseFloat(d.billedRevenue) || 0), 0);
    const totalOrders = stats.daily.reduce((sum, d) => sum + (d.billedOrders || 0), 0);
    const totalUnits = stats.daily.reduce((sum, d) => sum + (Number(d.totalUnits) || 0), 0);

    const chartHeight = 240;
    const chartWidth = 1000;
    const actualMax = Math.max(...chartData.map(d => d.revenue), 0);
    const maxVal = actualMax > 0 ? actualMax * 1.2 : 100;

    const points = chartData.map((d, i) => {
        const x = chartData.length > 1 ? (i / (chartData.length - 1)) * chartWidth : chartWidth / 2;
        const y = chartHeight - (d.revenue / maxVal) * chartHeight;
        return { x, y, ...d };
    });

    const chartD = points.length > 1
        ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
        : points.length === 1
            ? `M ${points[0].x - 10},${points[0].y} L ${points[0].x + 10},${points[0].y}`
            : '';

    const areaD = points.length > 1
        ? `${chartD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`
        : '';

    return (
        <div className="p-6 pb-24 md:pb-6 space-y-6 bg-gray-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Reports</h1>
                    <p className="text-sm text-gray-500">Analyze performance and resource utilization</p>
                </div>

                <div className="flex items-center gap-2">
                    {hasAuthPermission(Permission.ANALYTICS_SYNC) && (
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 shadow-sm disabled:opacity-50 transition-colors"
                        >
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-gray-400" />}
                            Sync
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        className={`p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
                        title="Refresh Data"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {visibility.workload && (
                <div className="pb-8 mb-6 border-b border-gray-200">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Live System State</h2>
                        <p className="text-sm text-gray-500">Unbilled workload currently being processed in the system</p>
                    </div>

                    {stats.productionState && visibility.pulse && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <PulseCard
                                label="Configuring"
                                value={stats.productionState.inConfig}
                                icon={<Layers className="w-4 h-4 text-orange-500" />}
                                color="border-orange-200 bg-orange-50/30"
                            />
                            <PulseCard
                                label="Ready"
                                value={stats.productionState.ready}
                                icon={<CheckCircle2 className="w-4 h-4 text-blue-500" />}
                                color="border-blue-200 bg-blue-50/30"
                            />
                            <PulseCard
                                label="In Production"
                                value={stats.productionState.active}
                                icon={<Activity className="w-4 h-4 text-amber-500" />}
                                color="border-amber-200 bg-amber-50/30"
                            />
                            <PulseCard
                                label="To Be Billed"
                                value={stats.productionState.toBeBilled}
                                icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                                color="border-emerald-200 bg-emerald-50/30"
                            />
                            <PulseCard
                                label="To Be Invoice"
                                value={stats.productionState.toBeInvoiced}
                                icon={<FileText className="w-4 h-4 text-blue-600" />}
                                color="border-blue-200 bg-blue-50/30"
                            />
                            <PulseCard
                                label="Live Workload"
                                value={stats.productionState.pendingRuns}
                                icon={<Zap className="w-4 h-4 text-gray-700" />}
                                color="border-gray-200 bg-gray-100 shadow-sm"
                                dark
                            />
                        </div>
                    )}

                    {visibility.matrix && stats.lifecycleMatrix && (
                        <div className="mt-10 mb-8">
                            <WorkflowLifecycleMatrix
                                matrix={stats.lifecycleMatrix}
                                locationId={locationId}
                                locations={locations}
                                onLocationChange={(locId) => updateFilters({ locationId: locId })}
                                visibility={visibility}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-amber-600" />
                                <h3 className="font-bold text-gray-900">Active Workload by Hub</h3>
                            </div>
                            <div className="p-4">
                                {stats.currentWorkload?.byLocation.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                        {stats.currentWorkload.byLocation.map((loc) => (
                                            <div key={loc.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-10 bg-amber-400 rounded-full" />
                                                    <span className="font-bold text-gray-700">{loc.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xl font-black text-gray-900">{loc.count}</span>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Active Runs</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-gray-400 text-sm italic">All hubs are currently idle.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                                <Users className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-bold text-gray-900">Active Workload by Manager</h3>
                            </div>
                            <div className="p-4">
                                {stats.currentWorkload?.byManager.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                        {stats.currentWorkload.byManager.map((mgr) => (
                                            <div key={mgr.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-10 bg-indigo-500 rounded-full" />
                                                    <span className="font-bold text-gray-700">{mgr.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xl font-black text-gray-900">{mgr.count}</span>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Assigned Runs</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-gray-400 text-sm italic">No managers have active assignments.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibility.revenue && (
                    <StatCard
                        title="Revenue"
                        value={`₹${totalRevenue.toLocaleString()}`}
                        subtitle="Billed in period"
                        icon={<DollarSign className="w-5 h-5" />}
                        color="text-emerald-600 bg-emerald-50"
                    />
                )}
                {visibility.orders && (
                    <StatCard
                        title="Orders"
                        value={totalOrders.toString()}
                        subtitle="Finalized & Billed"
                        icon={<Package className="w-5 h-5" />}
                        color="text-blue-600 bg-blue-50"
                    />
                )}
                {visibility.units && (
                    <StatCard
                        title="Units"
                        value={totalUnits.toLocaleString()}
                        subtitle="Production output"
                        icon={<Layers className="w-5 h-5" />}
                        color="text-indigo-600 bg-indigo-50"
                    />
                )}
                {visibility.hubs && (
                    <StatCard
                        title="Active Hubs"
                        value={stats.topLocations.length.toString()}
                        subtitle="Operating centers"
                        icon={<MapPin className="w-5 h-5" />}
                        color="text-amber-600 bg-amber-50"
                    />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {visibility.chart && visibility.revenue && (
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-none">Revenue Dynamics</h3>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">₹ {totalRevenue.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {period === 'custom' && (
                                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border border-gray-200 animate-in fade-in slide-in-from-right-2 duration-300">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => updateFilters({ startDate: e.target.value })}
                                            className="text-[10px] bg-transparent border-none focus:ring-0 p-0 w-24 text-gray-600 font-bold uppercase"
                                        />
                                        <span className="text-gray-300 text-[10px]">→</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => updateFilters({ endDate: e.target.value })}
                                            className="text-[10px] bg-transparent border-none focus:ring-0 p-0 w-24 text-gray-600 font-bold uppercase"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                    {PERIODS.map((p) => (
                                        <button
                                            key={p.value}
                                            onClick={() => updateFilters({ period: p.value })}
                                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all ${period === p.value
                                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                                : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>


                            </div>
                        </div>

                        <div className="p-6 pb-12 flex-1 flex flex-col min-h-[300px] relative">
                            {points.length > 0 ? (
                                <div className="flex-1 w-full relative">
                                    <svg className="w-full h-full overflow-visible" viewBox={`-60 0 ${chartWidth + 60} ${chartHeight}`} preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.1" />
                                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>

                                        {[0, 0.25, 0.5, 0.75, 1].map(v => (
                                            <g key={v}>
                                                <line x1="0" y1={v * chartHeight} x2={chartWidth} y2={v * chartHeight} stroke="#f1f5f9" strokeWidth="1" />
                                                {visibility.revenue && (
                                                    <text x="-10" y={v * chartHeight} dy="4" textAnchor="end" className="text-[9px] font-bold fill-gray-400">
                                                        ₹{((1 - v) * maxVal > 999 ? ((1 - v) * maxVal / 1000).toFixed(0) + 'k' : ((1 - v) * maxVal).toFixed(0))}
                                                    </text>
                                                )}
                                            </g>
                                        ))}

                                        {areaD && <path d={areaD} fill="url(#chartFill)" />}
                                        {chartD && <path d={chartD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

                                        {points.map((p, i) => (
                                            <g key={i}
                                                onMouseEnter={() => setHoveredPoint(i)}
                                                onMouseLeave={() => setHoveredPoint(null)}
                                                className="cursor-pointer"
                                            >
                                                <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 6 : 4} fill={hoveredPoint === i ? '#2563eb' : 'white'} stroke="#2563eb" strokeWidth="2" />
                                                <rect x={p.x - 20} y="0" width="40" height={chartHeight} fill="transparent" />
                                            </g>
                                        ))}

                                        {hoveredPoint !== null && visibility.revenue && (
                                            <g className="pointer-events-none">
                                                <rect
                                                    x={points[hoveredPoint].x - 45}
                                                    y={points[hoveredPoint].y - 52}
                                                    width="90"
                                                    height="38"
                                                    rx="8"
                                                    fill="white"
                                                    stroke="#2563eb"
                                                    strokeWidth="1.5"
                                                    style={{ filter: 'drop-shadow(0 10px 15px -3px rgb(0 0 0 / 0.1))' }}
                                                />
                                                <text
                                                    x={points[hoveredPoint].x}
                                                    y={points[hoveredPoint].y - 38}
                                                    textAnchor="middle"
                                                    className="text-[8px] font-black fill-gray-400 uppercase tracking-tighter"
                                                >
                                                    {points[hoveredPoint].date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()}
                                                </text>
                                                <text
                                                    x={points[hoveredPoint].x}
                                                    y={points[hoveredPoint].y - 22}
                                                    textAnchor="middle"
                                                    className="text-[12px] font-black fill-blue-600"
                                                >
                                                    ₹{points[hoveredPoint].revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                </text>
                                            </g>
                                        )}
                                    </svg>

                                    <div className="mt-4 flex justify-between pl-[60px]">
                                        {points.filter((_, i) => points.length < 8 || i % Math.ceil(points.length / 6) === 0).map((p, i) => (
                                            <span key={i} className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">
                                                {p.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-100 rounded-lg">
                                    <TrendingUp className="w-8 h-8 opacity-20" />
                                    <p className="text-sm italic">Synchronize history to populate chart</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {visibility.hubs && (
                    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col ${(visibility.chart && visibility.revenue) ? '' : 'lg:col-span-3'}`}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-amber-600" />
                            <h3 className="font-bold text-gray-900">Hub Ranking</h3>
                        </div>
                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[380px] scrollbar-hide">
                            {stats.topLocations.length > 0 ? (
                                stats.topLocations.map((loc) => {
                                    const share = (parseFloat(loc.totalRevenue) / (totalRevenue || 1)) * 100;
                                    return (
                                        <div key={loc.locationId} className="p-4 bg-gray-50/50 rounded-lg border border-gray-100 group hover:bg-white transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-sm text-gray-700 truncate mr-2">{loc.locationName}</span>
                                                {visibility.revenue && (
                                                    <span className="text-xs font-bold text-gray-900">₹{parseFloat(loc.totalRevenue).toLocaleString()}</span>
                                                )}
                                            </div>
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(4, share)}%` }}></div>
                                            </div>
                                            <div className="mt-2 flex justify-between text-[10px] font-medium text-gray-500 uppercase">
                                                <span>{loc.totalRuns} Production Runs</span>
                                                <span className="text-amber-600">{share.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-20 text-center text-gray-400 text-sm italic">No branch data.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {visibility.performance && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-gray-900">Staff Utilization</h3>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">Ranked by Volume Managed</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-left">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-gray-600">Manager</th>
                                    <th className="px-6 py-3 font-bold text-gray-600">Role</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 text-center">Executed</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 text-center">Reviewed</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 text-right">Volume Handled</th>
                                    <th className="px-6 py-3 font-bold text-gray-600">Productivity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.topUsers.length > 0 ? (
                                    stats.topUsers.map((user) => (
                                        <tr key={user.userId} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                                                        {user.userName.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-gray-900">{user.userName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-gray-100 text-gray-500 rounded border border-gray-200">{user.role}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-700">{user.runsExecuted}</td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-700">{user.runsReviewed}</td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">{visibility.revenue ? `₹${parseFloat(user.totalBilledVolume).toLocaleString()}` : '—'}</td>
                                            <td className="px-6 py-4">
                                                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((user.runsReviewed + user.runsExecuted) / ((stats.topUsers[0]?.runsReviewed || 1) + (stats.topUsers[0]?.runsExecuted || 0))) * 100)}%` }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No activity logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visibility.processes && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <Zap className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900">Process Share</h3>
                        </div>
                        <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[400px] scrollbar-hide">
                            {stats.topProcesses.map((proc) => {
                                const share = (parseFloat(proc.totalRevenue) / (totalRevenue || 1)) * 100;
                                return (
                                    <div key={proc.processId} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="font-bold text-xs text-gray-700 uppercase tracking-tight">{proc.processName}</span>
                                            {visibility.revenue && (
                                                <span className="text-xs font-bold text-gray-900">₹{parseFloat(proc.totalRevenue).toLocaleString()}</span>
                                            )}
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(5, share)}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                            <span>{proc.totalRuns} Runs</span>
                                            <span className="text-blue-600">{share.toFixed(1)}% Revenue</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {visibility.customers && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <Users className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-bold text-gray-900">Customer Insights</h3>
                        </div>
                        <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[400px] scrollbar-hide">
                            {stats.topCustomers?.length > 0 ? (
                                stats.topCustomers.map((cust) => {
                                    const share = (parseFloat(cust.totalRevenue) / (totalRevenue || 1)) * 100;
                                    return (
                                        <div key={cust.customerId} className="space-y-2 group">
                                            <div className="flex justify-between items-end">
                                                <span className="font-bold text-xs text-gray-700 uppercase tracking-tight truncate max-w-[180px] group-hover:text-blue-600 transition-colors">
                                                    {cust.customerName}
                                                </span>
                                                {visibility.revenue && (
                                                    <span className="text-xs font-bold text-gray-900">₹{parseFloat(cust.totalRevenue).toLocaleString()}</span>
                                                )}
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(5, share)}%` }}></div>
                                            </div>
                                            <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                                <div className="flex gap-3">
                                                    <span>{cust.totalOrders} Orders</span>
                                                    <span>{cust.totalUnits.toLocaleString()} Pcs</span>
                                                </div>
                                                <span className="text-emerald-600">Contribution: {share.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-20 text-center text-gray-400 text-sm italic border border-dashed border-gray-100 rounded-xl">
                                    No customer transaction data found.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${color} transition-transform group-hover:scale-110`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
                </div>
            </div>
            <div className="flex flex-col items-start">
                <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
                <p className="text-xs font-medium text-gray-500 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

interface PulseCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    dark?: boolean;
}

function PulseCard({ label, value, icon, color, dark = false }: PulseCardProps) {
    return (
        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02] ${color} ${dark ? 'bg-gray-900 text-white border-gray-800' : 'bg-white shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{label}</span>
        </div>
    );
}

function WorkflowLifecycleMatrix({ matrix, locationId, locations, onLocationChange, visibility }: {
    matrix: Record<string, Record<string, { count: number, value: number }>>,
    locationId?: string,
    locations: Location[],
    onLocationChange: (id: string) => void,
    visibility: any
}) {
    const router = useRouter();
    const statuses = [
        'DESIGN',
        'SIZE/COLOR',
        'TRACING',
        'EXPOSING',
        'SAMPLE',
        'RANGE',
        'PRODUCTION',
        'WAITING',
        'CUTTING/WEEDING',
        'CURING',
        'FUSING',
        'QC & COUNTING',
        'Var Kata and Kg',
        'COMPLETE'
    ];
    const processes = Object.keys(matrix);

    const handleCellClick = (process: string, status: string) => {
        const params = new URLSearchParams();
        params.set('processId', process);
        params.set('lifeCycleStatus', status);
        if (locationId) params.set('locationId', locationId);
        // Explicitly set page/limit for clarity if needed, or leave clean
        params.set('limit', '20');
        router.push(`/admin/runs?${params.toString()}`);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900">
                        Workflow Lifecycle Matrix
                    </h3>
                </div>

                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <select
                        value={locationId}
                        onChange={(e) => onLocationChange(e.target.value)}
                        className="text-xs font-bold text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer min-w-[140px]"
                    >
                        <option value="">All Studios</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 font-bold text-gray-600 border-r border-gray-100">Process / Stage</th>
                            {statuses.map(status => (
                                <th key={status} className="px-4 py-3 font-bold text-gray-600 text-center border-r border-gray-100 last:border-r-0">
                                    {status}
                                </th>
                            ))}
                            <th className="px-4 py-3 font-bold text-white text-center bg-gray-900 sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {processes.map(process => (
                            <tr key={process} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-gray-900 border-r border-gray-100 bg-gray-50/20">{process}</td>
                                {statuses.map(status => {
                                    const data = matrix[process]?.[status];
                                    const hasData = data && data.count > 0;
                                    return (
                                        <td
                                            key={status}
                                            onClick={() => hasData && handleCellClick(process, status)}
                                            className={`px-4 py-3 border-r border-gray-100 last:border-r-0 text-center transition-all ${hasData ? 'cursor-pointer hover:bg-blue-50/50 group' : 'bg-gray-50/10'}`}
                                        >
                                            {hasData ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-black text-gray-900 group-hover:text-blue-600">{data.count}</span>
                                                    {visibility.revenue && (
                                                        <span className="text-[9px] font-bold text-blue-600 opacity-60 group-hover:opacity-100">₹{data.value.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-200 text-lg">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                                {/* Row Totals */}
                                <td className="px-4 py-3 text-center bg-gray-900 text-white font-bold sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                                    {(() => {
                                        const totalCount = Object.values(matrix[process] || {}).reduce((sum, d) => sum + d.count, 0);
                                        const totalValue = Object.values(matrix[process] || {}).reduce((sum, d) => sum + d.value, 0);
                                        return (
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm">{totalCount}</span>
                                                {visibility.revenue && (
                                                    <span className="text-[9px] text-gray-400">₹{Math.round(totalValue).toLocaleString()}</span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const ProtectedDashboardContent = withAuth(DashboardClientContent, { permission: Permission.ANALYTICS_VIEW });

export default function DashboardClient() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <ProtectedDashboardContent />
        </Suspense>
    );
}
