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
import { CheckCircle, Clock, LogOut, Package, PlayCircle, Pause, Play, ChevronDown, ChevronRight } from 'lucide-react';
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
            className="bg-white rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col shrink-0"
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

function ManagerRunsPage() {
    const { user } = useAuth();
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [active, setActive] = useState<ManagerActiveJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
    const [activeTasksExpanded, setActiveTasksExpanded] = useState(true);
    const [chooseTaskExpanded, setChooseTaskExpanded] = useState(true);
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

                    <div className="space-y-8">
                        {/* ROW 1: ACTIVE TASKS */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setActiveTasksExpanded(!activeTasksExpanded)}
                                className="w-full flex items-center justify-between p-4 bg-emerald-50/40 hover:bg-emerald-50/70 border-b border-gray-100 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    {activeTasksExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-500" />
                                    )}
                                    <h2 className="text-base font-bold text-emerald-800 uppercase tracking-wider">
                                        Active Tasks
                                    </h2>
                                    <span className="bg-emerald-600 text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
                                        {activeItems.length}
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/60 border border-emerald-200/50 rounded-full px-3 py-1">
                                    In Progress
                                </span>
                            </button>
                            
                            {activeTasksExpanded && (
                                <div className="p-6 overflow-x-auto">
                                    <div className="flex flex-col lg:flex-row gap-6 pb-2">
                                        {sortedStages.map((stage) => {
                                            const stageActive = activeItems.filter(item => item.lifeCycleStatusCode === stage);
                                            return (
                                                <div
                                                    key={stage}
                                                    className="w-full lg:w-80 lg:shrink-0 bg-gray-50/50 rounded-xl p-4 border border-gray-200/60 flex flex-col gap-4"
                                                >
                                                    {/* Column Header */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                                        <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                            {stage}
                                                        </span>
                                                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                                                            {stageActive.length}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Column Content */}
                                                    <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
                                                        {stageActive.length > 0 ? (
                                                            stageActive.map((item) => (
                                                                <ActiveCard
                                                                    key={item.id}
                                                                    item={item}
                                                                    onClick={() => setSelectedRunId(item.id)}
                                                                    onChanged={() => fetchAll(false)}
                                                                />
                                                            ))
                                                        ) : (
                                                            <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center bg-white/50 min-h-[100px]">
                                                                No active tasks
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ROW 2: AVAILABLE TASKS */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setChooseTaskExpanded(!chooseTaskExpanded)}
                                className="w-full flex items-center justify-between p-4 bg-blue-50/40 hover:bg-blue-50/70 border-b border-gray-100 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    {chooseTaskExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-500" />
                                    )}
                                    <h2 className="text-base font-bold text-blue-800 uppercase tracking-wider">
                                        Choose Task (Available Queue)
                                    </h2>
                                    <span className="bg-blue-600 text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
                                        {queuedItems.length}
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100/60 border border-blue-200/50 rounded-full px-3 py-1">
                                    Shared Queue
                                </span>
                            </button>

                            {chooseTaskExpanded && (
                                <div className="p-6 overflow-x-auto">
                                    <div className="flex flex-col lg:flex-row gap-6 pb-2">
                                        {sortedStages.map((stage) => {
                                            const stageQueued = queuedItems.filter(item => item.lifeCycleStatusCode === stage);
                                            return (
                                                <div
                                                    key={stage}
                                                    className="w-full lg:w-80 lg:shrink-0 bg-gray-50/50 rounded-xl p-4 border border-gray-200/60 flex flex-col gap-4"
                                                >
                                                    {/* Column Header */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                                        <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                                                            {stage}
                                                        </span>
                                                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
                                                            {stageQueued.length}
                                                        </span>
                                                    </div>

                                                    {/* Column Content */}
                                                    <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
                                                        {stageQueued.length > 0 ? (
                                                            stageQueued.map((item) => (
                                                                <QueueCard
                                                                    key={item.id}
                                                                    item={item}
                                                                    onClick={() => setSelectedRunId(item.id)}
                                                                    onClaimed={() => fetchAll(false)}
                                                                />
                                                            ))
                                                        ) : (
                                                            <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center bg-white/50 min-h-[100px]">
                                                                No tasks available
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
