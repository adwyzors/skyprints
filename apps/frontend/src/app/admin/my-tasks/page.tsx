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
    RefreshCw,
    Plus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useVisibleInterval } from '@/hooks/useVisibleInterval';
import { SideTaskCard } from '@/components/side-tasks/SideTaskCard';
import { SideTaskTableRow } from '@/components/side-tasks/SideTaskTableRow';
import OrdersViewToggle from '@/components/orders/OrdersViewToggle';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import { CreateSideTaskModal } from '@/components/side-tasks/CreateSideTaskModal';
import { PassSideTaskModal } from '@/components/side-tasks/PassSideTaskModal';
import { ReassignSideTaskModal } from '@/components/side-tasks/ReassignSideTaskModal';
import { ReviewSideTaskModal } from '@/components/side-tasks/ReviewSideTaskModal';
import { SideTaskHistoryModal } from '@/components/side-tasks/SideTaskHistoryModal';
import { getAllSideTasks, getMySideTasks } from '@/services/sideTaskService';
import { SideTask } from '@/types/sideTask';

const POLL_INTERVAL_MS = 45000;

type SideTaskSortField =
    | 'code'
    | 'title'
    | 'customer'
    | 'stage'
    | 'assignee'
    | 'priority'
    | 'status'
    | 'timer'
    | 'requiredDate';

type SortDirection = 'asc' | 'desc';

const PRIORITY_WEIGHT: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
};

function getTaskTimerSeconds(task: SideTask): number {
    const currentHistory = task.stageHistories?.[task.stageHistories.length - 1];
    if (!currentHistory) return 0;
    let total = currentHistory.totalTimeSeconds || 0;
    if (
        currentHistory.lastStartedAt &&
        !currentHistory.pausedAt &&
        (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS')
    ) {
        total += Math.max(
            0,
            Math.floor((Date.now() - new Date(currentHistory.lastStartedAt).getTime()) / 1000)
        );
    }
    return total;
}

function matchesSideTaskSearch(task: SideTask, query: string): boolean {
    if (!query || !query.trim()) return true;
    const q = query.toLowerCase().trim();

    const currentHistory = task.stageHistories?.[task.stageHistories.length - 1];
    const stageName = currentHistory?.stageType?.name?.toLowerCase() || '';
    const assigneeName = task.currentAssignee?.name?.toLowerCase() || '';
    const assigneeEmail = task.currentAssignee?.email?.toLowerCase() || '';
    const customerName = (task.customer?.name || (task.isInternal ? 'internal task' : '')).toLowerCase();
    const customerCode = task.customer?.code?.toLowerCase() || '';
    const code = task.code?.toLowerCase() || '';
    const title = task.title?.toLowerCase() || '';
    const desc = task.description?.toLowerCase() || '';
    const priority = task.priority?.toLowerCase() || '';
    const status = task.status?.toLowerCase() || '';

    const anyHistoryMatch = task.stageHistories?.some(
        (h) =>
            h.assignedUser?.name?.toLowerCase().includes(q) ||
            h.assignedUser?.email?.toLowerCase().includes(q) ||
            h.stageType?.name?.toLowerCase().includes(q)
    );

    return (
        code.includes(q) ||
        title.includes(q) ||
        desc.includes(q) ||
        assigneeName.includes(q) ||
        assigneeEmail.includes(q) ||
        customerName.includes(q) ||
        customerCode.includes(q) ||
        stageName.includes(q) ||
        priority.includes(q) ||
        status.includes(q) ||
        Boolean(anyHistoryMatch)
    );
}

function sortSideTasks(
    tasks: SideTask[],
    field: SideTaskSortField | null,
    direction: SortDirection
): SideTask[] {
    if (!field) return tasks;

    return [...tasks].sort((a, b) => {
        let aVal: any = null;
        let bVal: any = null;

        switch (field) {
            case 'code':
                aVal = a.code?.toLowerCase() || '';
                bVal = b.code?.toLowerCase() || '';
                break;
            case 'title':
                aVal = a.title?.toLowerCase() || '';
                bVal = b.title?.toLowerCase() || '';
                break;
            case 'customer':
                aVal = (a.customer?.name || (a.isInternal ? 'Internal Task' : '')).toLowerCase();
                bVal = (b.customer?.name || (b.isInternal ? 'Internal Task' : '')).toLowerCase();
                break;
            case 'stage': {
                const aStage = a.stageHistories?.[a.stageHistories.length - 1]?.stageType?.name || '';
                const bStage = b.stageHistories?.[b.stageHistories.length - 1]?.stageType?.name || '';
                aVal = aStage.toLowerCase();
                bVal = bStage.toLowerCase();
                break;
            }
            case 'assignee':
                aVal = (a.currentAssignee?.name || '').toLowerCase();
                bVal = (b.currentAssignee?.name || '').toLowerCase();
                break;
            case 'priority':
                aVal = PRIORITY_WEIGHT[a.priority] || 0;
                bVal = PRIORITY_WEIGHT[b.priority] || 0;
                break;
            case 'status':
                aVal = (a.status || '').toLowerCase();
                bVal = (b.status || '').toLowerCase();
                break;
            case 'timer':
                aVal = getTaskTimerSeconds(a);
                bVal = getTaskTimerSeconds(b);
                break;
            case 'requiredDate':
                aVal = a.requiredDate ? new Date(a.requiredDate).getTime() : 0;
                bVal = b.requiredDate ? new Date(b.requiredDate).getTime() : 0;
                break;
            default:
                return 0;
        }

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined || aVal === 0 || aVal === '') return 1;
        if (bVal === null || bVal === undefined || bVal === 0 || bVal === '') return -1;

        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
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
                    <span className="font-bold text-gray-800">Run #${item.runNumber}</span>
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
                    <span className="font-bold text-gray-800">Run #${item.runNumber}</span>
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

function AdminMyTasksPage() {
    const { user } = useAuth();
    const currentUserId = user?.user?.id || user?.id;
    const role = user?.user?.role || (user as any)?.role;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    const [mainTab, setMainTab] = useState<'PROCESS_RUNS' | 'SIDE_TASKS'>('PROCESS_RUNS');
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [active, setActive] = useState<ManagerActiveJob[]>([]);
    const [stagePermissions, setStagePermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [selectedStage, setSelectedStage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Side Tasks state
    const [sideTasks, setSideTasks] = useState<SideTask[]>([]);
    const [sideTaskFilter, setSideTaskFilter] = useState<'MY' | 'ALL'>('MY');
    const [sideTaskViewMode, setSideTaskViewMode] = useState<'grid' | 'table'>('grid');
    const [sideTaskSearch, setSideTaskSearch] = useState('');
    const [sortField, setSortField] = useState<SideTaskSortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const [isCreateSideTaskOpen, setIsCreateSideTaskOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    const [passTaskTarget, setPassTaskTarget] = useState<SideTask | null>(null);
    const [reassignTaskTarget, setReassignTaskTarget] = useState<SideTask | null>(null);
    const [reviewTaskTarget, setReviewTaskTarget] = useState<SideTask | null>(null);
    const [reviewMode, setReviewMode] = useState<'submit' | 'review'>('submit');
    const [historyTaskTarget, setHistoryTaskTarget] = useState<SideTask | null>(null);

    const handleSideTaskFilterChange = (filter: 'MY' | 'ALL') => {
        setSideTaskFilter(filter);
        if (filter === 'ALL') {
            setSideTaskViewMode('table');
        } else {
            setSideTaskViewMode('grid');
        }
    };

    const handleSort = (field: SideTaskSortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortField(null);
                setSortDirection('asc');
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

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

    const fetchSideTasks = async () => {
        try {
            const data = sideTaskFilter === 'ALL'
                ? await getAllSideTasks({ search: sideTaskSearch })
                : await getMySideTasks({ search: sideTaskSearch });
            setSideTasks(data);
        } catch (err) {
            console.error('Failed to fetch side tasks', err);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            if (mainTab === 'PROCESS_RUNS') {
                await fetchAll(true);
            } else {
                await fetchSideTasks();
            }
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        const handleCreated = () => {
            fetchSideTasks();
        };
        window.addEventListener('side-task-created', handleCreated);
        return () => window.removeEventListener('side-task-created', handleCreated);
    }, [sideTaskFilter, sideTaskSearch]);

    useEffect(() => {
        if (!currentUserId) return;
        fetchAll(true);
        fetchSideTasks();

        getStagePermissions(currentUserId)
            .then(setStagePermissions)
            .catch(err => console.error('Failed to fetch stage permissions', err));
    }, [currentUserId]);

    useEffect(() => {
        if (mainTab === 'SIDE_TASKS') {
            fetchSideTasks();
        }
    }, [mainTab, sideTaskFilter, sideTaskSearch]);

    const intervalMs = isAdmin ? 15 * 60 * 1000 : 20000;

    useVisibleInterval(() => {
        if (mainTab === 'PROCESS_RUNS') fetchAll(false);
        else fetchSideTasks();
    }, intervalMs, { enabled: Boolean(currentUserId) });

    const allItems = [...active, ...queue];

    const allStagesSet = new Set<string>();
    stagePermissions.forEach(p => {
        if (p.stageCode) allStagesSet.add(p.stageCode);
    });
    allItems.forEach(item => {
        if (item.lifeCycleStatusCode) allStagesSet.add(item.lifeCycleStatusCode);
    });

    const sortedStages = Array.from(allStagesSet).sort((a, b) => {
        const orderA = STAGE_ORDER[a.toUpperCase()] || 100;
        const orderB = STAGE_ORDER[b.toUpperCase()] || 100;
        return orderA - orderB;
    });

    const activeStage = selectedStage && sortedStages.includes(selectedStage)
        ? selectedStage
        : (sortedStages.includes('PRODUCTION') ? 'PRODUCTION' : (sortedStages[0] || null));

    const stageItems = allItems.filter(item => item.lifeCycleStatusCode === activeStage);

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

    const processesSet = new Set<string>();
    stagePermissions.filter(p => p.stageCode === activeStage).forEach(p => {
        if (p.processName) processesSet.add(p.processName);
    });
    stageItems.forEach(item => {
        if (item.processName) processesSet.add(item.processName);
    });
    const stageProcesses = Array.from(processesSet).sort();

    const stageActiveItems = active.filter(item => item.lifeCycleStatusCode === activeStage && matchesSearch(item));
    const stageQueuedItems = queue.filter(item => item.lifeCycleStatusCode === activeStage && matchesSearch(item));

    // Filter and Sort Side Tasks
    const displayedSideTasks = useMemo(() => {
        const filtered = sideTasks.filter((task) => matchesSideTaskSearch(task, sideTaskSearch));
        return sortSideTasks(filtered, sortField, sortDirection);
    }, [sideTasks, sideTaskSearch, sortField, sortDirection]);

    const renderSortHeader = (label: string, field: SideTaskSortField, align: 'left' | 'center' | 'right' = 'left') => {
        const isSorted = sortField === field;
        return (
            <th
                onClick={() => handleSort(field)}
                className={`px-4 py-3 cursor-pointer select-none transition-colors hover:bg-gray-100/90 group ${
                    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                } ${isSorted ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-500'}`}
                title={`Sort by ${label}`}
            >
                <div className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <span>{label}</span>
                    {isSorted ? (
                        sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                    ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </th>
        );
    };

    return (
        <div className="py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Tasks</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage production runs and dynamic side tasks assigned to you.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {mainTab === 'SIDE_TASKS' && (
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-create-side-task'))}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm h-10 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Side Task</span>
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-indigo-700/80 rounded text-indigo-100 border border-indigo-500/50">Ctrl+/</span>
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-xs h-10 shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* TOP LEVEL TAB SWITCHER: PROCESS RUNS VS SIDE TASKS */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setMainTab('PROCESS_RUNS')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        mainTab === 'PROCESS_RUNS'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Package className="w-4 h-4" />
                    <span>Order Production Runs</span>
                    {allItems.length > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                            {allItems.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setMainTab('SIDE_TASKS')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        mainTab === 'SIDE_TASKS'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Side Tasks</span>
                    {sideTasks.length > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">
                            {sideTasks.length}
                        </span>
                    )}
                </button>
            </div>

            {/* MAIN TAB CONTENT: SIDE TASKS */}
            {mainTab === 'SIDE_TASKS' ? (
                <div className="space-y-6">
                    {/* Filters & Search & View Mode Switcher */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSideTaskFilterChange('MY')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                                    sideTaskFilter === 'MY'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                Assigned to Me ({sideTasks.filter((t) => t.currentAssigneeId === currentUserId).length})
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => handleSideTaskFilterChange('ALL')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                                        sideTaskFilter === 'ALL'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    All Active Side Tasks
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by assignee, code, title, customer..."
                                    value={sideTaskSearch}
                                    onChange={(e) => setSideTaskSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full bg-white shadow-xs"
                                />
                            </div>
                            <OrdersViewToggle view={sideTaskViewMode} onViewChange={setSideTaskViewMode} />
                        </div>
                    </div>

                    {/* Side Tasks Cards Grid or Table View */}
                    {displayedSideTasks.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                            <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 font-medium text-sm">
                                {sideTaskSearch ? `No side tasks matching "${sideTaskSearch}"` : 'No active side tasks found.'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Click "Create Side Task" (Ctrl+/) to create a new task.
                            </p>
                        </div>
                    ) : sideTaskViewMode === 'table' ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                            <th className="px-4 py-3 text-center">#</th>
                                            {renderSortHeader('Code', 'code')}
                                            <th className="px-4 py-3">Image</th>
                                            {renderSortHeader('Task Details', 'title')}
                                            {renderSortHeader('Customer', 'customer')}
                                            {renderSortHeader('Current Stage', 'stage')}
                                            {renderSortHeader('Assignee', 'assignee')}
                                            {renderSortHeader('Priority', 'priority')}
                                            {renderSortHeader('Status', 'status')}
                                            {renderSortHeader('Timer', 'timer')}
                                            {renderSortHeader('Required By', 'requiredDate')}
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {displayedSideTasks.map((t, idx) => (
                                            <SideTaskTableRow
                                                key={t.id}
                                                task={t}
                                                index={idx}
                                                onRefresh={fetchSideTasks}
                                                onPass={(task) => setPassTaskTarget(task)}
                                                onReassign={(task) => setReassignTaskTarget(task)}
                                                onSubmitReview={(task) => {
                                                    setReviewTaskTarget(task);
                                                    setReviewMode('submit');
                                                }}
                                                onReview={(task) => {
                                                    setReviewTaskTarget(task);
                                                    setReviewMode('review');
                                                }}
                                                onOpenHistory={(task) => setHistoryTaskTarget(task)}
                                                onPreviewImage={(url) => setPreviewImageUrl(url)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayedSideTasks.map((t) => (
                                <SideTaskCard
                                    key={t.id}
                                    task={t}
                                    onRefresh={fetchSideTasks}
                                    onPass={(task) => setPassTaskTarget(task)}
                                    onReassign={(task) => setReassignTaskTarget(task)}
                                    onSubmitReview={(task) => {
                                        setReviewTaskTarget(task);
                                        setReviewMode('submit');
                                    }}
                                    onReview={(task) => {
                                        setReviewTaskTarget(task);
                                        setReviewMode('review');
                                    }}
                                    onOpenHistory={(task) => setHistoryTaskTarget(task)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* MAIN TAB CONTENT: PROCESS RUNS */
                loading && allItems.length === 0 ? (
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
                                <h1 className="text-xl font-bold uppercase tracking-tight text-gray-800">
                                    {activeStage ? (STAGE_DISPLAY_NAMES[activeStage.toUpperCase()] || activeStage) : 'Production'}
                                </h1>
                                <p className="text-xs text-gray-500 mt-1">
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
                                            <div className="flex flex-col gap-4 pr-1 min-h-[150px]">
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
                )
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

            {/* SIDE TASKS MODALS */}
            <CreateSideTaskModal
                isOpen={isCreateSideTaskOpen}
                onClose={() => setIsCreateSideTaskOpen(false)}
                onSuccess={fetchSideTasks}
            />

            <PassSideTaskModal
                task={passTaskTarget}
                isOpen={Boolean(passTaskTarget)}
                onClose={() => setPassTaskTarget(null)}
                onSuccess={fetchSideTasks}
            />

            <ReassignSideTaskModal
                task={reassignTaskTarget}
                isOpen={Boolean(reassignTaskTarget)}
                onClose={() => setReassignTaskTarget(null)}
                onSuccess={fetchSideTasks}
            />

            <ReviewSideTaskModal
                task={reviewTaskTarget}
                mode={reviewMode}
                isOpen={Boolean(reviewTaskTarget)}
                onClose={() => setReviewTaskTarget(null)}
                onSuccess={fetchSideTasks}
            />

            <SideTaskHistoryModal
                task={historyTaskTarget}
                isOpen={Boolean(historyTaskTarget)}
                onClose={() => setHistoryTaskTarget(null)}
            />

            <ImagePreviewModal
                imageUrl={previewImageUrl}
                onClose={() => setPreviewImageUrl(null)}
            />
        </div>
    );
}

export default withAuth(AdminMyTasksPage, { permission: Permission.RUNS_VIEW });
