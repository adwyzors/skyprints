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
    const [tab, setTab] = useState<'queue' | 'active'>('queue');
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [active, setActive] = useState<ManagerActiveJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
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

    const handleTabChange = (newTab: 'queue' | 'active') => {
        setTab(newTab);
        setSelectedProcess(null);
    };

    const currentItems = tab === 'queue' ? queue : active;

    // Group items by processName
    const groupedItems = currentItems.reduce<Record<string, (ManagerQueueItem | ManagerActiveJob)[]>>((acc, item) => {
        const process = item.processName || 'Unspecified';
        if (!acc[process]) {
            acc[process] = [];
        }
        acc[process].push(item);
        return acc;
    }, {});

    // Sort processes alphabetically
    const sortedProcessNames = Object.keys(groupedItems).sort();

    // Create process list with counts for the sidebar
    const processes = sortedProcessNames.map((name) => ({
        name,
        count: groupedItems[name].length,
    }));

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold">Production</h1>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => handleTabChange('queue')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'queue' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        Production Queue ({queue.length})
                    </button>
                    <button
                        onClick={() => handleTabChange('active')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        My Active Jobs ({active.length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Loading…</div>
            ) : (
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* SIDEBAR / PROCESS FILTER */}
                    {currentItems.length > 0 && (
                        <div className="w-full md:w-64 shrink-0 md:sticky md:top-20 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="mb-3 pb-2 border-b border-gray-100 hidden md:block">
                                <h2 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                                    Processes
                                </h2>
                            </div>
                            
                            {/* Horizontal scroll on mobile, vertical list on desktop */}
                            <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-hide max-w-full">
                                <button
                                    onClick={() => setSelectedProcess(null)}
                                    className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                        selectedProcess === null
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                    }`}
                                >
                                    <span>All Processes</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${
                                        selectedProcess === null
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {currentItems.length}
                                    </span>
                                </button>
                                {processes.map((proc) => (
                                    <button
                                        key={proc.name}
                                        onClick={() => setSelectedProcess(proc.name)}
                                        className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                            selectedProcess === proc.name
                                                ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                        }`}
                                    >
                                        <span className="truncate">{proc.name}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${
                                            selectedProcess === proc.name
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {proc.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MAIN CONTENT AREA */}
                    <div className="flex-1 min-w-0 w-full">
                        {currentItems.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500">
                                    {tab === 'queue'
                                        ? 'No runs waiting in your queue.'
                                        : 'No active jobs right now.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {sortedProcessNames
                                    .filter((name) => selectedProcess === null || selectedProcess === name)
                                    .map((procName) => {
                                        const items = groupedItems[procName];
                                        return (
                                            <div key={procName} className="scroll-mt-20">
                                                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                                    <h2 className="text-base md:text-lg font-bold text-gray-800">
                                                        {procName}
                                                    </h2>
                                                    <span className="bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                                        {items.length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                    {items.map((item) =>
                                                        tab === 'queue' ? (
                                                            <QueueCard
                                                                key={item.id}
                                                                item={item}
                                                                onClick={() => setSelectedRunId(item.id)}
                                                                onClaimed={() => fetchAll(false)}
                                                            />
                                                        ) : (
                                                            <ActiveCard
                                                                key={item.id}
                                                                item={item as ManagerActiveJob}
                                                                onClick={() => setSelectedRunId(item.id)}
                                                                onChanged={() => fetchAll(false)}
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
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
