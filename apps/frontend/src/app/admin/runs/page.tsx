'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import Pagination from '@/components/common/Pagination';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import ViewRunModal from '@/components/modals/ViewRunModal';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import RunCard from '@/components/runs/RunCard';
import RunsFilter from '@/components/runs/RunsFilter';
import RunsViewToggle from '@/components/runs/RunsViewToggle';
import { STATIC_PROCESSES } from '@/constants/processes';
import { getLocations } from '@/services/location.service';
import { getProcessLifecycleStatuses } from '@/services/process.service';
import { getRuns } from '@/services/run.service';
import debounce from 'lodash/debounce';
import {
    Activity,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Box,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    Clock,
    Filter,
    Loader2,
    MapPin,
    Search,
    User
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

// Enhanced Run interface to support Card View
interface Run {
    id: string;
    orderProcess: {
        name?: string;
        order: {
            id: string;
            code: string;
            quantity: number;
            amount?: number;
            customer: {
                name: string;
            };
        };
    };
    runTemplate: {
        name: string;
    };
    runNumber: number;
    statusCode: string;
    lifeCycleStatusCode: string;
    priority?: string;
    executor?: {
        name: string;
    };
    reviewer?: {
        name: string;
    };
    location?: {
        id: string;
        name: string;
        code: string;
    };
    fields: {
        Quantity?: number;
        "Estimated Amount"?: number;
        images?: string[];
        [key: string]: any;
    };
}

const DIGITAL_PROCESS_NAMES = ['Sublimation', 'Plotter', 'DTF', 'Laser', 'Allover Sublimation'];

function RunsPageContent() {
    const { user, hasPermission } = useAuth();
    const [runsData, setRunsData] = useState<{
        runs: Run[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalEstimatedAmount?: number;
        totalQuantity?: number;
    }>({
        runs: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
        totalEstimatedAmount: 0,
        totalQuantity: 0
    });

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [selectedRunId, setSelectedRunId] = useState<string | null>(searchParams.get('selectedRun'));
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Filter Data State
    const [processes, setProcesses] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [lifecycleStatuses, setLifecycleStatuses] = useState<string[]>([]);

    useEffect(() => {
        const runParam = searchParams.get('selectedRun');
        if (runParam !== selectedRunId) {
            setSelectedRunId(runParam);
        }
    }, [searchParams]);

    const handleRunSelection = (runId: string | null) => {
        setSelectedRunId(runId);
        const params = new URLSearchParams(searchParams.toString());
        if (runId) {
            params.set('selectedRun', runId);
        } else {
            params.delete('selectedRun');
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Filter State
    const [filters, setFilters] = useState({
        status: ['COMPLETE'] as string[], // This maps to top-level run status
        lifeCycleStatus: [] as string[],
        orderStatus: ['CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION'] as string[],
        priority: [] as string[],
        dateRange: 'all',
        customerId: 'all',
        executorId: 'all',
        reviewerId: 'all',
        processId: 'all',
        locationId: 'all',
    });

    // Restrict filters for specific roles
    useEffect(() => {
        if (!user) return;

        if (hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
            setFilters(prev => ({
                ...prev,
                status: ['COMPLETE'],
                orderStatus: ['IN_PRODUCTION'],
                lifeCycleStatus: ['PRODUCTION'],
            }));
        } else if (hasPermission(Permission.RUNS_TRANSITION_FUSING)) {
            setFilters(prev => ({
                ...prev,
                status: ['COMPLETE'],
                lifeCycleStatus: ['FUSING', 'CURING'],
            }));
        }
    }, [user?.roles]);

    // Fetch Filter Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const locs = await getLocations();
                setProcesses(STATIC_PROCESSES);

                // If user has a specific location, filter the locations list and set the filter
                const userLocation = user?.user?.location;
                const hasGlobalView = hasPermission(Permission.LOCATIONS_ALL_VIEW);

                if (userLocation && !hasGlobalView) {
                    const filteredLocs = locs.filter((l: any) => l.id === userLocation.id || l.name === userLocation.name);
                    setLocations(filteredLocs);
                    if (filteredLocs.length > 0) {
                        setFilters(prev => ({ ...prev, locationId: filteredLocs[0].id }));
                    }
                } else {
                    setLocations(locs);
                }

                // Apply Digital/Fusing Role Defaults & Restrictions
                const isDigital = hasPermission(Permission.RUNS_TRANSITION_DIGITAL);
                const isFusing = hasPermission(Permission.RUNS_TRANSITION_FUSING);
                const hasFullUpdate = hasPermission(Permission.RUNS_UPDATE);

                if (!hasFullUpdate) {
                    if (isDigital) {
                        setFilters(prev => ({
                            ...prev,
                            lifeCycleStatus: ['PRODUCTION']
                        }));
                    } else if (isFusing) {
                        setFilters(prev => ({
                            ...prev,
                            lifeCycleStatus: ['FUSING', 'CURING']
                        }));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch filter options", error);
            }
        };
        fetchData();
    }, [user]);

    // Fetch Dynamic Statuses
    useEffect(() => {
        const fetchStatuses = async () => {
            if (!filters.processId || filters.processId === 'all') {
                // If no process is selected, show common statuses that people might want to filter by
                setLifecycleStatuses(['FUSING', 'COMPLETE', 'PENDING']);
                return;
            }
            try {
                const dynamicStatuses = await getProcessLifecycleStatuses(filters.processId);
                const normalized = dynamicStatuses.length > 0 && typeof dynamicStatuses[0] === 'object'
                    ? dynamicStatuses.map((s: any) => s.code || s.name)
                    : dynamicStatuses;
                setLifecycleStatuses(normalized);

                // If FUSING is available in the new process, auto-select it if nothing else is selected or if we want to stick with Fusing
                // Only if not a Digital user who should stay on PRODUCTION
                if (normalized.includes('FUSING') && (filters.lifeCycleStatus.length === 0 || filters.lifeCycleStatus.includes('FUSING')) && !hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
                    setFilters(prev => ({ ...prev, lifeCycleStatus: ['FUSING'] }));
                }
            } catch (error) {
                console.error("Failed to fetch dynamic statuses", error);
            }
        };
        fetchStatuses();
    }, [filters.processId]);

    // Debounce search input
    const debouncedSearchUpdate = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value);
            setRunsData((prev) => ({ ...prev, page: 1 }));
        }, 500),
        [],
    );

    useEffect(() => {
        debouncedSearchUpdate(search);
        return () => debouncedSearchUpdate.cancel();
    }, [search, debouncedSearchUpdate]);

    useEffect(() => {
        let cancelled = false;
        async function fetchRuns() {
            setLoading(true);
            try {
                // Determine date range for filtering
                let createdFrom, createdTo;
                if (filters.dateRange !== 'all') {
                    const fromDate = new Date();
                    switch (filters.dateRange) {
                        case 'today':
                            fromDate.setHours(0, 0, 0, 0);
                            createdFrom = fromDate.toISOString().split('T')[0];
                            break;
                        case 'week':
                            fromDate.setDate(fromDate.getDate() - 7);
                            createdFrom = fromDate.toISOString().split('T')[0];
                            break;
                        case 'month':
                            fromDate.setMonth(fromDate.getMonth() - 1);
                            createdFrom = fromDate.toISOString().split('T')[0];
                            break;
                    }
                }

                // Determine process restricting for Digital role
                let processIdParam = filters.processId;
                const isDigitalUser = hasPermission(Permission.RUNS_TRANSITION_DIGITAL);

                if (isDigitalUser && filters.processId === 'all') {
                    // Include all digital processes + Embellishment (which we'll sub-filter)
                    processIdParam = [...DIGITAL_PROCESS_NAMES, 'Embellishment'] as any;
                }

                const res = await getRuns({
                    page: runsData.page,
                    limit: pageSize,
                    search: debouncedSearch,
                    status: filters.status,
                    lifeCycleStatusCode: filters.lifeCycleStatus,
                    priority: filters.priority,
                    customerId: filters.customerId,
                    executorUserId: filters.executorId,
                    reviewerUserId: filters.reviewerId,
                    processId: processIdParam,
                    locationId: filters.locationId,
                    orderStatus: filters.orderStatus,
                    createdFrom,
                    createdTo
                });

                if (!cancelled) {
                    let finalRuns = res.runs || [];

                    // Sub-filter Embellishment runs for Digital role
                    if (isDigitalUser) {
                        finalRuns = finalRuns.filter(run => {
                            const processName = run.orderProcess?.name || '';
                            const internalProcessName = run.fields?.['Process Name'] || run.fields?.process_name || '';

                            // If it's one of the primary digital processes, show it
                            if (DIGITAL_PROCESS_NAMES.includes(processName)) return true;

                            // If it's Embellishment, only show if the internal process is digital
                            if (processName === 'Embellishment') {
                                return DIGITAL_PROCESS_NAMES.includes(internalProcessName);
                            }

                            return false;
                        });
                    }

                    setRunsData(prev => ({
                        ...prev,
                        runs: finalRuns,
                        total: res.total || 0,
                        totalPages: res.totalPages || 0,
                        totalEstimatedAmount: res.totalEstimatedAmount || 0,
                        totalQuantity: res.totalQuantity || 0
                    }));
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setRunsData(prev => ({ ...prev, runs: [], total: 0 }));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchRuns();
        return () => { cancelled = true; };
    }, [debouncedSearch, runsData.page, pageSize, filters]);

    const handlePageChange = (newPage: number) => {
        setRunsData((prev) => ({ ...prev, page: newPage }));
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setRunsData((prev) => ({ ...prev, page: 1, limit: newSize }));
    };

    const handleClearFilters = () => {
        if (hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
            setFilters({
                status: ['COMPLETE'],
                lifeCycleStatus: ['PRODUCTION'],
                orderStatus: ['IN_PRODUCTION'],
                priority: [],
                dateRange: 'all',
                customerId: 'all',
                executorId: 'all',
                reviewerId: 'all',
                processId: 'all',
                locationId: 'all'
            });
        } else if (hasPermission(Permission.RUNS_TRANSITION_FUSING)) {
            setFilters({
                status: ['COMPLETE'],
                lifeCycleStatus: ['FUSING', 'CURING'],
                orderStatus: ['CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION'],
                priority: [],
                dateRange: 'all',
                customerId: 'all',
                executorId: 'all',
                reviewerId: 'all',
                processId: 'all',
                locationId: 'all'
            });
        } else {
            setFilters({
                status: ['COMPLETE'],
                lifeCycleStatus: [],
                orderStatus: ['CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION'],
                priority: [],
                dateRange: 'all',
                customerId: 'all',
                executorId: 'all',
                reviewerId: 'all',
                processId: 'all',
                locationId: 'all'
            });
        }
        setRunsData((prev) => ({ ...prev, page: 1 }));
    };

    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                if (current.direction === 'asc') return { key, direction: 'desc' };
                return null;
            }
            return { key, direction: 'asc' };
        });
    };

    const sortedRuns = useMemo(() => {
        if (!sortConfig) return runsData.runs;
        return [...runsData.runs].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            const getDisplayName = (run: Run) => {
                const processName = run.orderProcess?.name;
                const rawName = run.runTemplate?.name || 'Process Run';
                if (processName && (processName.toLowerCase().includes('embellishment') || rawName.toLowerCase().includes('embellishment'))) {
                    return processName;
                }
                return rawName.replace(/ Template$/i, '');
            };

            const getEstimatedRate = (run: Run) => {
                if (run.fields?.['Estimated Rate']) return Number(run.fields['Estimated Rate']);
                const amount = Number(run.fields?.['Estimated Amount'] || 0);
                const qty = Number(run.fields?.Quantity || 0);
                if (amount && qty) return amount / qty;
                return 0;
            };

            switch (sortConfig.key) {
                case 'orderCode':
                    aValue = typeof a.orderProcess.order.code === 'object' ? (a.orderProcess.order.code as any).code : a.orderProcess.order.code;
                    bValue = typeof b.orderProcess.order.code === 'object' ? (b.orderProcess.order.code as any).code : b.orderProcess.order.code;
                    break;
                case 'process':
                    aValue = getDisplayName(a);
                    bValue = getDisplayName(b);
                    break;
                case 'runNumber':
                    aValue = a.runNumber;
                    bValue = b.runNumber;
                    break;
                case 'customer':
                    aValue = a.orderProcess.order.customer.name;
                    bValue = b.orderProcess.order.customer.name;
                    break;
                case 'priority': {
                    const priorityMap: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                    aValue = priorityMap[a.priority || ''] || 0;
                    bValue = priorityMap[b.priority || ''] || 0;
                    break;
                }
                case 'quantity':
                    aValue = a.fields?.Quantity || 0;
                    bValue = b.fields?.Quantity || 0;
                    break;
                case 'estRate':
                    aValue = getEstimatedRate(a);
                    bValue = getEstimatedRate(b);
                    break;
                case 'estTotal':
                    aValue = a.fields?.['Estimated Amount'] || 0;
                    bValue = b.fields?.['Estimated Amount'] || 0;
                    break;
                case 'status':
                    aValue = a.statusCode === 'CONFIGURE' ? 'CONFIGURE' : (a.lifeCycleStatusCode || a.statusCode);
                    bValue = b.statusCode === 'CONFIGURE' ? 'CONFIGURE' : (b.lifeCycleStatusCode || b.statusCode);
                    break;
                default:
                    return 0;
            }

            if (aValue === bValue) return 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const cmp = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            }
            const cmp = aValue > bValue ? 1 : -1;
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
    }, [runsData.runs, sortConfig]);

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setRunsData(prev => ({ ...prev, page: 1 }));
    };

    return (
        <div className="flex bg-gray-50/50 min-h-full scrollbar-hide">
            {/* LEFT SIDEBAR FILTERS - STICKY to MAIN SCROLL */}
            <div className={`
                relative h-[calc(100vh-56px)] flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40
                ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'}
            `}>
                <div className="w-72 h-full overflow-y-auto scrollbar-hide p-3">
                    <RunsFilter
                        filters={filters}
                        onChange={(newFilters) => {
                            setFilters(newFilters);
                            setRunsData(prev => ({ ...prev, page: 1 }));
                        }}
                        onClear={handleClearFilters}
                        onClose={() => setIsSidebarOpen(false)}
                    />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col w-full min-w-0">
                {/* Header Section */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`p-2 rounded-lg border transition-all duration-200 ${isSidebarOpen
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                                }`}
                            title={isSidebarOpen ? "Close Filters" : "Show Filters"}
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5 font-bold" />}
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Run Activity</h1>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full border border-green-200 whitespace-nowrap">
                                        Total: ₹{runsData.totalEstimatedAmount?.toLocaleString() || 0}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100 whitespace-nowrap">
                                        <span className="text-[10px] text-blue-400 uppercase tracking-wider">Total pcs</span>
                                        {runsData.totalQuantity?.toLocaleString() || 0}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Monitor active process runs
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search runs, status, customer..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 bg-white shadow-sm transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <RunsViewToggle view={viewMode} onViewChange={setViewMode} />
                    </div>
                </div>

                {/* TOOLBAR FILTERS */}
                <div className="flex-shrink-0 z-20 bg-white border-b border-gray-100 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-8">
                        {/* Status Pills */}
                        {!hasPermission(Permission.RUNS_TRANSITION_DIGITAL) && !hasPermission(Permission.RUNS_TRANSITION_FUSING) && (
                            <div className="flex items-center gap-3 text-gray-400">
                                <span className="text-[10px] font-bold uppercase tracking-widest">Status:</span>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'CONFIGURE', label: 'To Configure' },
                                        { value: 'PRODUCTION_READY', label: 'Ready' },
                                        { value: 'IN_PRODUCTION', label: 'In Production' },
                                        { value: 'COMPLETE', label: 'Complete' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                const current = filters.status;
                                                const next = current.includes(opt.value)
                                                    ? current.filter(s => s !== opt.value)
                                                    : [...current, opt.value];
                                                handleFilterChange('status', next);
                                            }}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${filters.status.includes(opt.value)
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Location Pills - Only show if user has more than 1 location option (e.g. Admin) */}
                        {locations.length > 1 && (
                            <div className="flex items-center gap-2">
                                {locations.map(loc => (
                                    <button
                                        key={loc.id}
                                        onClick={() => handleFilterChange('locationId', filters.locationId === loc.id ? 'all' : loc.id)}
                                        className={`px-5 py-1.5 text-xs font-bold rounded-lg border transition-all ${filters.locationId === loc.id
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                            }`}
                                    >
                                        {loc.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Process Dropdown */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Process:</span>
                            <div className="relative min-w-[180px]">
                                <select
                                    value={filters.processId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFilters(prev => ({ ...prev, processId: val, lifeCycleStatus: [] }));
                                        setRunsData(prev => ({ ...prev, page: 1 }));
                                    }}
                                    className="w-full appearance-none pl-4 pr-10 py-2 text-xs font-bold bg-white border border-blue-200 text-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-400 transition-all shadow-sm"
                                >
                                    <option value="all" className="text-gray-900 bg-white">Select Process</option>
                                    {processes
                                        .filter(p => {
                                            if (hasPermission(Permission.RUNS_UPDATE)) return true;
                                            if (hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
                                                return DIGITAL_PROCESS_NAMES.includes(p.name);
                                            }
                                            return true;
                                        })
                                        .map(p => (
                                            <option key={p.id} value={p.id} className="text-gray-900 bg-white">{p.name}</option>
                                        ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Dynamic Status Dropdown */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lifecycle:</span>
                            <div className="relative min-w-[180px]">
                                <select
                                    value={filters.lifeCycleStatus[0] || 'all'}
                                    disabled={hasPermission(Permission.RUNS_TRANSITION_DIGITAL)}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleFilterChange('lifeCycleStatus', val === 'all' ? [] : [val]);
                                    }}
                                    className="w-full appearance-none pl-4 pr-10 py-2 text-xs font-bold bg-white border border-blue-200 text-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-400 transition-all shadow-sm disabled:opacity-50 disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400"
                                >
                                    <option value="all" className="text-gray-900 bg-white">Select Status</option>
                                    {lifecycleStatuses
                                        .filter(s => {
                                            if (hasPermission(Permission.RUNS_UPDATE)) return true;
                                            if (hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
                                                return s === 'PRODUCTION';
                                            }
                                            if (hasPermission(Permission.RUNS_TRANSITION_FUSING)) {
                                                return s === 'FUSING' || s === 'CURING';
                                            }
                                            return true;
                                        })
                                        .map(s => (
                                            <option key={s} value={s} className="text-gray-900 bg-white">{s}</option>
                                        ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pb-24 md:pb-6">
                    {/* Results Summary */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-sm text-gray-600">
                            Showing <span className="font-semibold text-gray-800">{runsData.runs.length}</span>{' '}
                            of <span className="font-semibold text-gray-800">{runsData.total}</span> runs
                        </p>
                        <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
                    </div>

                    {/* Loading/Error/Empty States */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <span className="ml-3 text-gray-600">Loading runs...</span>
                        </div>
                    ) : runsData.runs.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500 shadow-sm">
                            <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="font-medium text-gray-900">No runs found</p>
                            <p className="text-sm mt-1">Try adjusting your search query or filters</p>
                            <button
                                onClick={handleClearFilters}
                                className="mt-4 text-blue-600 text-sm font-bold hover:underline"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* GRID VIEW */}
                            <div className={viewMode === 'grid' ? 'block' : 'hidden'}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {runsData.runs.map((run) => (
                                        <RunCard
                                            key={run.id}
                                            run={run}
                                            active={viewMode === 'grid'}
                                            onClick={() => handleRunSelection(run.id)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* TABLE VIEW */}
                            <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('orderCode')}>
                                                    <div className="flex items-center gap-1">Order Code {sortConfig?.key === 'orderCode' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4">
                                                    Image
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('process')}>
                                                    <div className="flex items-center gap-1">Process {sortConfig?.key === 'process' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('runNumber')}>
                                                    <div className="flex items-center gap-1">Run # {sortConfig?.key === 'runNumber' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('customer')}>
                                                    <div className="flex items-center gap-1">Customer {sortConfig?.key === 'customer' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('priority')}>
                                                    <div className="flex items-center gap-1">Priority {sortConfig?.key === 'priority' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('quantity')}>
                                                    <div className="flex items-center gap-1">Quantity {sortConfig?.key === 'quantity' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('estRate')}>
                                                    <div className="flex items-center gap-1">Est. Rate {sortConfig?.key === 'estRate' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('estTotal')}>
                                                    <div className="flex items-center gap-1">Est. Total {sortConfig?.key === 'estTotal' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                                    <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {sortedRuns.map((run) => {
                                                const processName = run.orderProcess?.name;
                                                const rawName = run.runTemplate?.name || 'Process Run';
                                                let displayName = rawName.replace(/ Template$/i, '');
                                                if (processName && (processName.toLowerCase().includes('embellishment') || rawName.toLowerCase().includes('embellishment'))) {
                                                    displayName = processName;
                                                }
                                                return (
                                                    <tr
                                                        key={run.id}
                                                        className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                                                        onClick={() => handleRunSelection(run.id)}
                                                    >
                                                        <td className="px-6 py-4 font-medium text-gray-900">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                                                    #{typeof run.orderProcess.order.code === 'object' ? (run.orderProcess.order.code as any).code.split("/")[0].replace("ORD", "") : run.orderProcess.order.code.split("/")[0].replace("ORD", "")}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {run.fields?.images && run.fields.images.length > 0 ? (
                                                                <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 relative group">
                                                                    <img
                                                                        src={run.fields.images[0]}
                                                                        alt={`Run ${run.runNumber}`}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                    <div
                                                                        className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors w-full h-full z-10"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setPreviewImage(run.fields.images?.[0] || null);
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                                                                    <span className="text-gray-300 text-[10px] text-center px-1 font-bold italic">No IMG</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 text-gray-700 font-semibold">
                                                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                                                {displayName}
                                                                {run.location && (
                                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                                        <MapPin className="w-2.5 h-2.5 text-gray-400" />
                                                                        {run.location.code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500 font-medium">
                                                            {run.runNumber}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 text-gray-600 font-medium">
                                                                <User className="w-3.5 h-3.5 text-gray-400" />
                                                                {run.orderProcess.order.customer.name}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {run.priority && (
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${run.priority === 'HIGH' ? 'text-red-600 bg-red-50 border-red-100' :
                                                                    run.priority === 'MEDIUM' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                                                                        'text-blue-600 bg-blue-50 border-blue-100'
                                                                    }`}>
                                                                    {run.priority}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-900 font-bold">
                                                            {run.fields?.Quantity || run.orderProcess.order.quantity || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                                            {(() => {
                                                                const rate = run.fields?.['Estimated Rate'];
                                                                if (rate) return `₹${rate}`;
                                                                const amount = Number(run.fields?.['Estimated Amount'] || 0);
                                                                const qty = Number(run.fields?.Quantity || 0);
                                                                if (amount && qty) return `₹${(amount / qty).toFixed(2).replace(/\.00$/, '')}`;
                                                                return '-';
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-emerald-700">
                                                            {run.fields?.['Estimated Amount'] ? `₹${run.fields['Estimated Amount'].toLocaleString()}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                const status = run.statusCode === 'CONFIGURE' ? 'CONFIGURE' : (run.lifeCycleStatusCode || run.statusCode);
                                                                const s = status?.toUpperCase();
                                                                let config = {
                                                                    label: status || 'Unknown',
                                                                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                                                                    icon: <Clock className="w-3.5 h-3.5" />,
                                                                };
                                                                switch (s) {
                                                                    case 'COMPLETED':
                                                                    case 'COMPLETE':
                                                                        config = {
                                                                            label: 'Completed',
                                                                            color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                                            icon: <CheckCircle className="w-3.5 h-3.5" />,
                                                                        };
                                                                        break;
                                                                    case 'IN_PROGRESS':
                                                                        config = {
                                                                            label: 'In Progress',
                                                                            color: 'bg-blue-50 text-blue-700 border-blue-200',
                                                                            icon: <Activity className="w-3.5 h-3.5" />,
                                                                        };
                                                                        break;
                                                                    case 'PENDING':
                                                                        config = {
                                                                            label: 'Pending',
                                                                            color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                                                                            icon: <Clock className="w-3.5 h-3.5" />,
                                                                        };
                                                                        break;
                                                                    case 'CONFIGURE':
                                                                        config = {
                                                                            label: 'Configure',
                                                                            color: 'bg-orange-50 text-orange-700 border-orange-200',
                                                                            icon: <Activity className="w-3.5 h-3.5" />,
                                                                        };
                                                                        break;
                                                                }
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${config.color} uppercase tracking-tight`}>
                                                                        {config.icon}
                                                                        {config.label}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* PAGINATION */}
                            <div className="mt-8">
                                <Pagination
                                    currentPage={runsData.page}
                                    totalPages={runsData.totalPages}
                                    onPageChange={handlePageChange}
                                    totalItems={runsData.total}
                                    pageSize={pageSize}
                                    itemLabel="runs"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* VIEW RUN MODAL */}
            {selectedRunId && (
                <ViewRunModal
                    runId={selectedRunId}
                    onClose={() => handleRunSelection(null)}
                    onRunUpdate={() => {
                        setRunsData(prev => ({ ...prev }));
                        setFilters(prev => ({ ...prev }));
                    }}
                />
            )}
            <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
    );
}

const ProtectedRunsPageContent = withAuth(RunsPageContent, { permission: Permission.RUNS_VIEW });

export default function RunsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <ProtectedRunsPageContent />
        </Suspense>
    );
}
