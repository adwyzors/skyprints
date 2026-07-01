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
                <div className="text-sm text-gray-600">{item.orderCode}</div>
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
            <div className="text-sm text-gray-600">{item.orderCode}</div>
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

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold">Production</h1>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setTab('queue')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'queue' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        Production Queue ({queue.length})
                    </button>
                    <button
                        onClick={() => setTab('active')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        My Active Jobs ({active.length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Loading…</div>
            ) : tab === 'queue' ? (
                queue.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500">No runs waiting in your queue.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {queue.map((item) => (
                            <QueueCard
                                key={item.id}
                                item={item}
                                onClick={() => setSelectedRunId(item.id)}
                                onClaimed={() => fetchAll(false)}
                            />
                        ))}
                    </div>
                )
            ) : active.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No active jobs right now.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {active.map((item) => (
                        <ActiveCard
                            key={item.id}
                            item={item}
                            onClick={() => setSelectedRunId(item.id)}
                            onChanged={() => fetchAll(false)}
                        />
                    ))}
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
