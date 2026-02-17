'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { DashboardStats, getDashboardStats, syncAnalytics } from '@/services/analytics.service';
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
import { useEffect, useMemo, useState } from 'react';

const PERIODS = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '6 Months', value: '6m' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' },
];

function DashboardClient() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('7d');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    const fetchStats = async (p: string) => {
        try {
            setLoading(true);
            const data = await getDashboardStats(p);
            setStats(data);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats(period);
    }, [period]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchStats(period);
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-gray-500 font-medium">Loading analytics intelligence...</p>
                </div>
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
    const { hasPermission } = useAuth();


    const chartD = points.length > 1
        ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
        : points.length === 1
            ? `M ${points[0].x - 10},${points[0].y} L ${points[0].x + 10},${points[0].y}`
            : '';

    const areaD = points.length > 1
        ? `${chartD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`
        : '';

    return (
        <div className="p-6 space-y-6 bg-gray-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Reports</h1>
                    <p className="text-sm text-gray-500">Analyze performance and resource utilization</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        {PERIODS.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === p.value
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {hasPermission(Permission.ANALYTICS_SYNC) &&
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 shadow-sm disabled:opacity-50 transition-colors"
                        >
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-gray-400" />}
                            Sync
                        </button>
                    }
                    <button
                        onClick={handleRefresh}
                        className={`p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Revenue"
                    value={`₹${totalRevenue.toLocaleString()}`}
                    subtitle="Billed in period"
                    icon={<DollarSign className="w-5 h-5" />}
                    color="text-emerald-600 bg-emerald-50"
                />
                <StatCard
                    title="Orders"
                    value={totalOrders.toString()}
                    subtitle="Finalized & Billed"
                    icon={<Package className="w-5 h-5" />}
                    color="text-blue-600 bg-blue-50"
                />
                <StatCard
                    title="Units"
                    value={totalUnits.toLocaleString()}
                    subtitle="Production output"
                    icon={<Layers className="w-5 h-5" />}
                    color="text-indigo-600 bg-indigo-50"
                />
                <StatCard
                    title="Active Hubs"
                    value={stats.topLocations.length.toString()}
                    subtitle="Operating centers"
                    icon={<MapPin className="w-5 h-5" />}
                    color="text-amber-600 bg-amber-50"
                />
            </div>

            {stats.productionState && (
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900">Revenue Dynamics</h3>
                        </div>
                        {hoveredPoint !== null && (
                            <div className="flex items-center gap-4 animate-in fade-in duration-300">
                                <span className="text-xs font-medium text-gray-500">
                                    {points[hoveredPoint].date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-sm font-bold text-blue-600">
                                    ₹{points[hoveredPoint].revenue.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 pb-12 flex-1 flex flex-col min-h-[300px] relative">
                        {points.length > 0 ? (
                            <div className="flex-1 w-full relative">
                                <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.1" />
                                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>

                                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                                        <line key={v} x1="0" y1={v * chartHeight} x2={chartWidth} y2={v * chartHeight} stroke="#f1f5f9" strokeWidth="1" />
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
                                </svg>

                                <div className="mt-4 flex justify-between px-2">
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

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
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
                                            <span className="text-xs font-bold text-gray-900">₹{parseFloat(loc.totalRevenue).toLocaleString()}</span>
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
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
                                    stats.topUsers.map((user, idx) => (
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
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">₹{parseFloat(user.totalBilledVolume).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((user.runsReviewed + user.runsExecuted) / ((stats.topUsers[0]?.runsReviewed || 1) + (stats.topUsers[0]?.runsExecuted || 0))) * 100)}%` }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No activity logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

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
                                        <span className="text-xs font-bold text-gray-900">₹{parseFloat(proc.totalRevenue).toLocaleString()}</span>
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
            </div>

            <div className="pt-6 border-t border-gray-200">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Live System State</h2>
                    <p className="text-sm text-gray-500">Unbilled workload currently being processed in the system</p>
                </div>

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

export default withAuth(DashboardClient, { permission: Permission.ANALYTICS_VIEW });
