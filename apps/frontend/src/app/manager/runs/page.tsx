'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import ManagerRunModal from '@/components/modals/ManagerRunModal';
import {
    ManagerActiveJob,
    ManagerQueueItem,
    claimRun,
    completeRun,
    listActive,
    listQueue,
    releaseRun,
    pauseRun,
    resumeRun,
} from '@/services/managerQueueService';
import { getStagePermissions } from '@/services/usersService';
import {
    CheckCircle,
    Clock,
    LogOut,
    Package,
    PlayCircle,
    Pause,
    Play,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Edit,
    ShieldCheck,
    Truck,
    Layers,
    Printer,
    Scissors,
    Flame,
    Layout,
    HelpCircle,
    Palette,
    Search,
    Filter,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 7000;

function formatElapsed(claimedAt: string): string {
    const ms = Date.now() - new Date(claimedAt).getTime();
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatActiveElapsed(claimedAt: string, pausedAt?: string | null, pausedDurationSeconds = 0): string {
    const startMs = new Date(claimedAt).getTime();
    let currentMs = Date.now();
    if (pausedAt) {
        currentMs = new Date(pausedAt).getTime();
    }
    const ms = currentMs - startMs;
    const totalSeconds = Math.max(0, Math.floor(ms / 1000) - pausedDurationSeconds);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const secs = totalSeconds % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${secs}s`;
}

function QueueCard({ item, onClick, onClaimed }: {
    item: ManagerQueueItem;
    onClick: () => void;
    onClaimed: () => void;
}) {
    const [claiming, setClaiming] = useState(false);

    const handleStartWork = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setClaiming(true);
        try {
            await claimRun(item.id);
            toast.success(`Run #${item.runNumber} claimed`);
            onClaimed();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Already claimed by another manager',
            );
            onClaimed();
        } finally {
            setClaiming(false);
        }
    };

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col shrink-0"
        >
            {item.artworkUrl ? (
                <img src={item.artworkUrl} alt="" className="w-full h-32 object-cover" />
            ) : (
                <div className="w-full h-32 bg-gray-50 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300" />
                </div>
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Run #{item.runNumber}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item.processName}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 gap-2">
                    <span>{item.orderCode}</span>
                    {item.jobCode && (
                        <span className="text-[11px] bg-gray-50 border border-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]" title={item.jobCode}>
                            Job: {item.jobCode}
                        </span>
                    )}
                </div>
                <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>{item.lifeCycleStatusCode}</span>
                    {item.quantity != null && <span>Qty: {item.quantity}</span>}
                </div>
                {item.comments && (
                    <p className="text-xs text-gray-400 italic line-clamp-2">"{item.comments}"</p>
                )}
                <button
                    onClick={handleStartWork}
                    disabled={claiming}
                    className="mt-auto w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold transition-colors"
                >
                    <PlayCircle className="w-4 h-4" />
                    {claiming ? 'Claiming…' : 'Start Work'}
                </button>
            </div>
        </div>
    );
}

function ActiveCard({ item, onClick, onChanged }: {
    item: ManagerActiveJob;
    onClick: () => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [, forceTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => forceTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleComplete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setBusy(true);
        try {
            await completeRun(item.id);
            toast.success(`Run #${item.runNumber} stage completed`);
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to complete stage');
        } finally {
            setBusy(false);
        }
    };

    const handleRelease = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Release Run #${item.runNumber} back to the shared queue?`)) return;
        setBusy(true);
        try {
            await releaseRun(item.id);
            toast.success(`Run #${item.runNumber} released`);
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to release job');
        } finally {
            setBusy(false);
        }
    };

    const handlePauseToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setBusy(true);
        try {
            if (item.pausedAt) {
                await resumeRun(item.id);
                toast.success(`Run #${item.runNumber} timer resumed`);
            } else {
                await pauseRun(item.id);
                toast.success(`Run #${item.runNumber} timer paused`);
            }
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to toggle pause');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-2 ring-emerald-500/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer overflow-hidden flex flex-col shrink-0"
        >
            {item.artworkUrl ? (
                <img src={item.artworkUrl} alt="" className="w-full h-32 object-cover" />
            ) : (
                <div className="w-full h-32 bg-gray-50 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300" />
                </div>
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Run #{item.runNumber}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item.processName}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 gap-2">
                    <span>{item.orderCode}</span>
                    {item.jobCode && (
                        <span className="text-[11px] bg-gray-50 border border-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]" title={item.jobCode}>
                            Job: {item.jobCode}
                        </span>
                    )}
                </div>
                <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span className={item.pausedAt ? 'text-amber-500 font-semibold' : 'text-gray-500'}>
                            {formatActiveElapsed(item.claimedAt, item.pausedAt, item.pausedDurationSeconds)}
                        </span>
                        {item.pausedAt && <span className="bg-amber-100 text-amber-800 px-1 rounded text-[9px] font-bold uppercase">Paused</span>}
                    </div>
                    {item.quantity != null && <span>Qty: {item.quantity}</span>}
                </div>
                <div className="text-xs text-gray-500">{item.lifeCycleStatusCode}</div>
                <div className="mt-2 flex items-center justify-between gap-2.5">
                    {/* Release Job (Blue Square) */}
                    <button
                        onClick={handleRelease}
                        disabled={busy}
                        title="Release Job back to Queue"
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>

                    {/* Pause/Play Timer (Red/Amber Square) */}
                    <button
                        onClick={handlePauseToggle}
                        disabled={busy}
                        title={item.pausedAt ? "Resume Timer" : "Pause Timer"}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg text-white transition-colors cursor-pointer shrink-0 shadow-sm ${
                            item.pausedAt
                                ? 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400'
                                : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-400'
                        }`}
                    >
                        {item.pausedAt ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>

                    {/* Complete Stage (Green Rectangle) */}
                    <button
                        onClick={handleComplete}
                        disabled={busy}
                        title="Complete current stage"
                        className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span>Complete</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

const STAGE_ORDER: Record<string, number> = {
    'ORDERS': 10,
    'PENDING': 10,
    'CONFIGURE': 15,
    'DESIGN': 20,
    'APPROVAL': 30,
    'PRODUCTION': 40,
    'FUSING': 42,
    'CURING': 44,
    'QC': 50,
    'QC & COUNTING': 51,
    'QC & PACKING': 52,
    'DISPATCH': 60,
    'COMPLETE': 70,
    'COMPLETED': 70,
};

const STAGE_DISPLAY_NAMES: Record<string, string> = {
    'ORDERS': 'Orders',
    'PENDING': 'Orders',
    'CONFIGURE': 'Configure',
    'DESIGN': 'Design',
    'APPROVAL': 'Approval',
    'PRODUCTION': 'Production',
    'FUSING': 'Fusing',
    'CURING': 'Curing',
    'QC': 'QC',
    'QC & COUNTING': 'QC & Counting',
    'QC & PACKING': 'QC',
    'DISPATCH': 'Dispatch',
    'COMPLETE': 'Completed',
    'COMPLETED': 'Completed',
};

const STAGE_ICONS: Record<string, React.ComponentType<any>> = {
    'ORDERS': ClipboardList,
    'PENDING': ClipboardList,
    'CONFIGURE': ClipboardList,
    'DESIGN': Edit,
    'APPROVAL': CheckCircle,
    'PRODUCTION': Package,
    'FUSING': Package,
    'CURING': Package,
    'QC': ShieldCheck,
    'QC & COUNTING': ShieldCheck,
    'QC & PACKING': ShieldCheck,
    'DISPATCH': Truck,
    'COMPLETE': CheckCircle,
    'COMPLETED': CheckCircle,
};

const PROCESS_COLORS: Record<string, { text: string; border: string; bg: string; badge: string; indicator: string }> = {
    'SCREEN PRINTING': {
        text: 'text-emerald-600',
        border: 'border-emerald-500',
        bg: 'bg-emerald-50/50',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        indicator: 'bg-emerald-500',
    },
    'SUBLIMATION': {
        text: 'text-purple-600',
        border: 'border-purple-500',
        bg: 'bg-purple-50/50',
        badge: 'bg-purple-50 text-purple-700 border-purple-100',
        indicator: 'bg-purple-500',
    },
    'PLOTTER': {
        text: 'text-amber-600',
        border: 'border-amber-500',
        bg: 'bg-amber-50/50',
        badge: 'bg-amber-50 text-amber-700 border-amber-100',
        indicator: 'bg-amber-500',
    },
    'DTF': {
        text: 'text-blue-600',
        border: 'border-blue-500',
        bg: 'bg-blue-50/50',
        badge: 'bg-blue-50 text-blue-700 border-blue-100',
        indicator: 'bg-blue-500',
    },
    'ALLOVER SUBLIMATION': {
        text: 'text-cyan-600',
        border: 'border-cyan-500',
        bg: 'bg-cyan-50/50',
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',
        indicator: 'bg-cyan-500',
    },
    'EMBELLISHMENT': {
        text: 'text-rose-600',
        border: 'border-rose-500',
        bg: 'bg-rose-50/50',
        badge: 'bg-rose-50 text-rose-700 border-rose-100',
        indicator: 'bg-rose-500',
    },
    'EMBROIDERY': {
        text: 'text-rose-600',
        border: 'border-rose-500',
        bg: 'bg-rose-50/50',
        badge: 'bg-rose-50 text-rose-700 border-rose-100',
        indicator: 'bg-rose-500',
    },
    'QC & PACKING': {
        text: 'text-indigo-600',
        border: 'border-indigo-500',
        bg: 'bg-indigo-50/50',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        indicator: 'bg-indigo-500',
    },
};

function getStageConfig(stageCode: string) {
    const code = stageCode.toUpperCase();
    return {
        label: STAGE_DISPLAY_NAMES[code] || stageCode,
        icon: STAGE_ICONS[code] || ClipboardList
    };
}

function getProcessColorScheme(processName: string) {
    const key = processName.toUpperCase();
    for (const k of Object.keys(PROCESS_COLORS)) {
        if (key.includes(k)) {
            return PROCESS_COLORS[k];
        }
    }
    return {
        text: 'text-blue-600',
        border: 'border-blue-500',
        bg: 'bg-blue-50/50',
        badge: 'bg-blue-50 text-blue-700 border-blue-100',
        indicator: 'bg-blue-500',
    };
}

const PROCESS_ICONS: Record<string, React.ComponentType<any>> = {
    'SCREEN PRINTING': Printer,
    'SUBLIMATION': Palette,
    'PLOTTER': Scissors,
    'DTF': Layers,
    'ALLOVER SUBLIMATION': Flame,
    'EMBELLISHMENT': Layout,
    'EMBROIDERY': Palette,
    'QC & PACKING': ShieldCheck,
};

function getProcessIcon(processName: string) {
    const key = processName.toUpperCase();
    for (const k of Object.keys(PROCESS_ICONS)) {
        if (key.includes(k)) {
            return PROCESS_ICONS[k];
        }
    }
    return HelpCircle;
}

function ManagerRunsPage() {
    const { user } = useAuth();
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [active, setActive] = useState<ManagerActiveJob[]>([]);
    const [stagePermissions, setStagePermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [selectedStage, setSelectedStage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchAll = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const [q, a] = await Promise.all([listQueue(), listActive()]);
            setQueue(q);
            setActive(a);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.id) return;
        fetchAll(true);

        // Fetch stage permissions to know all assigned lifecycle stages
        getStagePermissions(user.id)
            .then(setStagePermissions)
            .catch(err => console.error('Failed to fetch stage permissions', err));

        intervalRef.current = setInterval(() => fetchAll(false), POLL_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user?.id]);

    const allItems = [...active, ...queue];

    // Gather all stages: from permissions and from items
    const allStagesSet = new Set<string>();
    stagePermissions.forEach(p => {
        if (p.stageCode) allStagesSet.add(p.stageCode);
    });
    allItems.forEach(item => {
        if (item.lifeCycleStatusCode) allStagesSet.add(item.lifeCycleStatusCode);
    });

    // Sort stages based on the custom flow sequence
    const sortedStages = Array.from(allStagesSet).sort((a, b) => {
        const orderA = STAGE_ORDER[a.toUpperCase()] || 100;
        const orderB = STAGE_ORDER[b.toUpperCase()] || 100;
        return orderA - orderB;
    });

    // Determine the active lifecycle stage
    const activeStage = selectedStage && sortedStages.includes(selectedStage)
        ? selectedStage
        : (sortedStages.includes('PRODUCTION') ? 'PRODUCTION' : (sortedStages[0] || null));

    // Filter items to the active lifecycle stage
    const stageItems = allItems.filter(item => item.lifeCycleStatusCode === activeStage);

    // Search filter candidate check
    const matchesSearch = (item: any) => {
        if (!searchQuery) return true;
        const s = searchQuery.toLowerCase();
        return (
            item.orderCode.toLowerCase().includes(s) ||
            (item.jobCode && item.jobCode.toLowerCase().includes(s)) ||
            item.customerName.toLowerCase().includes(s) ||
            item.processName.toLowerCase().includes(s) ||
            item.runNumber.toString().includes(s)
        );
    };

    // Gather unique processes for the active stage
    const processesSet = new Set<string>();
    stagePermissions.filter(p => p.stageCode === activeStage).forEach(p => {
        if (p.processName) processesSet.add(p.processName);
    });
    stageItems.forEach(item => {
        if (item.processName) processesSet.add(item.processName);
    });
    const stageProcesses = Array.from(processesSet).sort();

    // Filter active items and queued items for display
    const stageActiveItems = active.filter(item => item.lifeCycleStatusCode === activeStage && matchesSearch(item));
    const stageQueuedItems = queue.filter(item => item.lifeCycleStatusCode === activeStage && matchesSearch(item));

    return (
        <div className="py-6">
            {loading && allItems.length === 0 ? (
                <div className="text-center py-20 text-gray-400">Loading…</div>
            ) : allStagesSet.size === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No runs waiting in your queue.</p>
                </div>
            ) : (
                <>
                    {/* LIFECYCLE STAGE TABS */}
                    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide gap-2 bg-white px-4 py-1.5 rounded-xl border border-gray-100">
                        {sortedStages.map((stage) => {
                            const config = getStageConfig(stage);
                            const Icon = config.icon;
                            const isActive = stage === activeStage;
                            const count = allItems.filter(item => item.lifeCycleStatusCode === stage).length;

                            return (
                                <button
                                    key={stage}
                                    onClick={() => setSelectedStage(stage)}
                                    className={`flex items-center gap-2.5 px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span>{config.label}</span>
                                    {count > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* STAGE HEADER & SEARCH BAR */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-tight text-gray-900">
                                {activeStage ? (STAGE_DISPLAY_NAMES[activeStage.toUpperCase()] || activeStage) : 'Production'}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Track all jobs across {activeStage ? (STAGE_DISPLAY_NAMES[activeStage.toUpperCase()] || activeStage).toLowerCase() : 'production'} processes
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search job, order or customer..."
                                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full md:w-64 bg-white shadow-xs transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 bg-white shadow-xs" title="Filter list">
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* KANBAN BOARD */}
                    <div className="overflow-x-auto pb-6 scrollbar-hide">
                        <div className="flex gap-6 pb-2 min-w-max">
                            {stageProcesses.map((processName) => {
                                const activeForProcess = stageActiveItems.filter(item => item.processName === processName);
                                const queuedForProcess = stageQueuedItems.filter(item => item.processName === processName);

                                const totalPendingJobs = activeForProcess.length + queuedForProcess.length;
                                const totalQty = [...activeForProcess, ...queuedForProcess].reduce((sum, item) => sum + (item.quantity || 0), 0);

                                const colorScheme = getProcessColorScheme(processName);
                                const Icon = getProcessIcon(processName);

                                return (
                                    <div
                                        key={processName}
                                        className="w-80 shrink-0 bg-gray-50/50 rounded-2xl border border-gray-200/60 flex flex-col gap-4 p-4"
                                    >
                                        {/* Column Header */}
                                        <div className="flex flex-col gap-2 pb-3 border-b border-gray-200/80">
                                            <div className={`h-1 w-full rounded-full ${colorScheme.indicator}`} />
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg border ${colorScheme.badge}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-extrabold text-xs tracking-wider text-gray-800 uppercase">
                                                        {processName}
                                                    </span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorScheme.badge}`}>
                                                    {totalPendingJobs}
                                                </span>
                                            </div>

                                            <div className="flex flex-col mt-1">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Pending</span>
                                                <span className={`text-xl font-black mt-0.5 ${colorScheme.text}`}>
                                                    {totalQty.toLocaleString()} <span className="text-xs font-bold text-gray-500">pcs</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Column Content */}
                                        <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-1 min-h-[150px] scrollbar-thin">
                                            {totalPendingJobs > 0 ? (
                                                <>
                                                    {/* Active items first */}
                                                    {activeForProcess.map((item) => (
                                                        <ActiveCard
                                                            key={item.id}
                                                            item={item}
                                                            onClick={() => setSelectedRunId(item.id)}
                                                            onChanged={() => fetchAll(false)}
                                                        />
                                                    ))}

                                                    {/* Queued items with 70% opacity, placed below active items */}
                                                    {queuedForProcess.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="opacity-70 hover:opacity-100 transition-opacity"
                                                        >
                                                            <QueueCard
                                                                item={item}
                                                                onClick={() => setSelectedRunId(item.id)}
                                                                onClaimed={() => fetchAll(false)}
                                                            />
                                                        </div>
                                                    ))}
                                                </>
                                            ) : (
                                                /* Empty state matching the reference UI */
                                                <div className="border border-dashed border-gray-200/80 rounded-2xl p-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center bg-white/40 min-h-[220px] gap-3">
                                                    <div className="w-12 h-12 rounded-full border border-dashed border-gray-200 flex items-center justify-center text-blue-500 bg-white shadow-xs">
                                                        <Package className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-gray-700">No jobs yet</span>
                                                        <span className="text-[10px] text-gray-400 max-w-[150px] mx-auto">Jobs will appear here once started</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {selectedRunId && (
                <ManagerRunModal
                    runId={selectedRunId}
                    onClose={() => {
                        setSelectedRunId(null);
                        fetchAll(false);
                    }}
                    onTransitionComplete={() => {
                        setSelectedRunId(null);
                        fetchAll(false);
                    }}
                />
            )}
        </div>
    );
}

export default withAuth(ManagerRunsPage, { permission: Permission.RUNS_VIEW });
