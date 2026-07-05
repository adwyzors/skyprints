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
} from '@/services/managerQueueService';
import { CheckCircle, Clock, LogOut, Package, PlayCircle } from 'lucide-react';
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
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col"
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
        const interval = setInterval(() => forceTick((t) => t + 1), 30000);
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

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 flex flex-col gap-2"
        >
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
            <div className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Elapsed: {formatElapsed(item.claimedAt)}
            </div>
            <div className="text-xs text-gray-500">{item.lifeCycleStatusCode}</div>
            <div className="mt-1 flex flex-col gap-1.5">
                <button
                    onClick={handleComplete}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold transition-colors"
                >
                    <CheckCircle className="w-4 h-4" />
                    Complete Stage
                </button>
                <button
                    onClick={handleRelease}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600 text-sm font-medium transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Release Job
                </button>
            </div>
        </div>
    );
}

function ManagerRunsPage() {
    const { user } = useAuth();
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [active, setActive] = useState<ManagerActiveJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
    const [selectedStage, setSelectedStage] = useState<string | null>(null);
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

        intervalRef.current = setInterval(() => fetchAll(false), POLL_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user?.id]);

    const allItems = [...active, ...queue];

    // Get unique processes from allItems
    const uniqueProcesses = Array.from(
        new Set(allItems.map((item) => item.processName))
    ).sort();

    // If no process is selected yet, default to "all" (displaying all processes)
    const activeProcess = selectedProcess && (selectedProcess === 'all' || uniqueProcesses.includes(selectedProcess))
        ? selectedProcess
        : 'all';

    // Filter items to the active process
    const processItems = activeProcess === 'all'
        ? allItems
        : allItems.filter((item) => item.processName === activeProcess);

    // Separate active (claimed) items and queued items for this process
    const activeItems = processItems.filter((item) => 'claimedAt' in item) as ManagerActiveJob[];
    const queuedItems = processItems.filter((item) => !('claimedAt' in item)) as ManagerQueueItem[];

    // Gather all stages
    const allStagesSet = new Set<string>();
    activeItems.forEach(item => {
        if (item.lifeCycleStatusCode) allStagesSet.add(item.lifeCycleStatusCode);
    });
    queuedItems.forEach(item => {
        if (item.lifeCycleStatusCode) allStagesSet.add(item.lifeCycleStatusCode);
    });
    const sortedStages = Array.from(allStagesSet).sort();

    // Combine into structured lifecycle categories
    const categories: {
        key: string;
        name: string;
        count: number;
        activeItems: ManagerActiveJob[];
        queuedItems: ManagerQueueItem[];
    }[] = [];

    if (activeItems.length > 0) {
        categories.push({
            key: 'active-jobs',
            name: 'My Active Jobs',
            count: activeItems.length,
            activeItems: activeItems,
            queuedItems: [],
        });
    }

    sortedStages.forEach((stage) => {
        const stageActive = activeItems.filter(item => item.lifeCycleStatusCode === stage);
        const stageQueued = queuedItems.filter(item => item.lifeCycleStatusCode === stage);
        categories.push({
            key: stage,
            name: stage,
            count: stageActive.length + stageQueued.length,
            activeItems: stageActive,
            queuedItems: stageQueued,
        });
    });

    const activeStage = selectedStage && (selectedStage === 'all' || categories.some((c) => c.key === selectedStage))
        ? selectedStage
        : 'all';

    const displayedCategories = activeStage === 'all'
        ? categories
        : categories.filter((c) => c.key === activeStage);

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold">Production</h1>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Loading…</div>
            ) : allItems.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No runs waiting in your queue.</p>
                </div>
            ) : (
                <>
                    {/* PROCESS TABS */}
                    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide gap-2">
                        {/* All Processes Tab */}
                        <button
                            onClick={() => {
                                setSelectedProcess('all');
                                setSelectedStage('all');
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                                activeProcess === 'all'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span>All</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                activeProcess === 'all'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                                {allItems.length}
                            </span>
                        </button>

                        {/* Individual Process Tabs */}
                        {uniqueProcesses.map((procName) => {
                            const count = allItems.filter((item) => item.processName === procName).length;
                            const isTabActive = procName === activeProcess;
                            return (
                                <button
                                    key={procName}
                                    onClick={() => {
                                        setSelectedProcess(procName);
                                        setSelectedStage('all');
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                                        isTabActive
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <span>{procName}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        isTabActive
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* LIFECYCLE SIDEBAR */}
                        <div className="w-full md:w-64 shrink-0 md:sticky md:top-20 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="mb-3 pb-2 border-b border-gray-100 hidden md:block">
                                <h2 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                                    Stages
                                </h2>
                            </div>
                            
                            {/* Horizontal scroll on mobile, vertical list on desktop */}
                            <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-hide max-w-full">
                                <button
                                    onClick={() => setSelectedStage('all')}
                                    className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                        activeStage === 'all'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                    }`}
                                >
                                    <span>All Stages</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${
                                        activeStage === 'all'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {processItems.length}
                                    </span>
                                </button>
                                {categories.map((cat) => {
                                    const isActiveJobsCat = cat.key === 'active-jobs';
                                    const isSidebarSelected = activeStage === cat.key;
                                    return (
                                        <button
                                            key={cat.key}
                                            onClick={() => setSelectedStage(cat.key)}
                                            className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                            style={isActiveJobsCat ? {
                                                background: isSidebarSelected ? '#16a34a' : '#f0fdf4',
                                                color: isSidebarSelected ? '#fff' : '#15803d',
                                                border: '1.5px solid #86efac',
                                                boxShadow: '0 1px 4px rgba(22,163,74,0.15)',
                                                fontWeight: 700,
                                            } : isSidebarSelected ? {
                                                background: '#eff6ff',
                                                color: '#1d4ed8',
                                                border: '1px solid #bfdbfe',
                                            } : {
                                                color: '#4b5563',
                                                border: '1px solid transparent',
                                            }}
                                        >
                                            <span className="truncate">{cat.name}</span>
                                            <span
                                                className="rounded-full text-xs font-bold"
                                                style={isActiveJobsCat ? {
                                                    background: isSidebarSelected ? '#fff' : '#bbf7d0',
                                                    color: isSidebarSelected ? '#15803d' : '#166534',
                                                    padding: '1px 8px',
                                                } : isSidebarSelected ? {
                                                    background: '#dbeafe',
                                                    color: '#1e40af',
                                                    padding: '1px 8px',
                                                } : {
                                                    background: '#f3f4f6',
                                                    color: '#4b5563',
                                                    padding: '1px 8px',
                                                }}
                                            >
                                                {cat.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* MAIN CONTENT AREA */}
                        <div className="flex-1 min-w-0 w-full">
                            <div className="space-y-10">
                                {displayedCategories.map((category) => {
                                    const isActiveJobsSection = category.key === 'active-jobs';
                                    return (
                                    <div key={category.key} className="scroll-mt-20">
                                        {isActiveJobsSection ? (
                                            <>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        marginBottom: '16px',
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        background: 'linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)',
                                                        border: '1.5px solid #86efac',
                                                        boxShadow: '0 1px 6px rgba(22,163,74,0.12)',
                                                    }}
                                                >
                                                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                                        {category.name}
                                                    </h2>
                                                    <span style={{ background: '#16a34a', color: '#fff', borderRadius: '999px', padding: '1px 10px', fontSize: '12px', fontWeight: 700 }}>
                                                        {category.count}
                                                    </span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '999px', padding: '2px 10px' }}>
                                                        In Progress
                                                    </span>
                                                </div>
                                                <div className="space-y-6">
                                                    {Object.entries(
                                                        category.activeItems.reduce<Record<string, ManagerActiveJob[]>>((acc, item) => {
                                                            const stage = item.lifeCycleStatusCode || 'Unspecified';
                                                            if (!acc[stage]) {
                                                                acc[stage] = [];
                                                            }
                                                            acc[stage].push(item);
                                                            return acc;
                                                        }, {})
                                                    ).map(([stageName, stageItems]) => (
                                                        <div key={stageName} className="space-y-3">
                                                            <div className="flex items-center gap-2 border-b border-gray-100 pb-1.5">
                                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                                                    {stageName}
                                                                </h3>
                                                                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    {stageItems.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {stageItems.map((item) => (
                                                                    <ActiveCard
                                                                        key={item.id}
                                                                        item={item}
                                                                        onClick={() => setSelectedRunId(item.id)}
                                                                        onChanged={() => fetchAll(false)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                                    <h2 className="text-base md:text-lg font-bold text-gray-800">
                                                        {category.name}
                                                    </h2>
                                                    <span className="bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                                        {category.count}
                                                    </span>
                                                </div>
                                                <div className="space-y-6">
                                                    {/* Active Jobs in this Stage */}
                                                    {category.activeItems.length > 0 && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 pb-1">
                                                                <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider">
                                                                    Active Jobs
                                                                </h3>
                                                                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    {category.activeItems.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {category.activeItems.map((item) => (
                                                                    <ActiveCard
                                                                        key={item.id}
                                                                        item={item}
                                                                        onClick={() => setSelectedRunId(item.id)}
                                                                        onChanged={() => fetchAll(false)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Available Jobs in this Stage */}
                                                    {category.queuedItems.length > 0 && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 pb-1">
                                                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                                    Available Jobs
                                                                </h3>
                                                                <span className="bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    {category.queuedItems.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {category.queuedItems.map((item) => (
                                                                    <QueueCard
                                                                        key={item.id}
                                                                        item={item}
                                                                        onClick={() => setSelectedRunId(item.id)}
                                                                        onClaimed={() => fetchAll(false)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
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
