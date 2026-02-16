'use client';

import Pagination from '@/components/common/Pagination';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import ViewRunModal from '@/components/modals/ViewRunModal';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import RunCard from '@/components/runs/RunCard';
import RunsFilter from '@/components/runs/RunsFilter';
import RunStatusFilter from '@/components/runs/RunStatusFilter';
import RunsViewToggle from '@/components/runs/RunsViewToggle';
import { getRuns } from '@/services/run.service';
import debounce from 'lodash/debounce';
import {
    Activity,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Box,
    CheckCircle,
    ChevronLeft,
    Clock,
    Filter,
    Loader2,
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
    fields: {
        Quantity?: number;
        "Estimated Amount"?: number;
        images?: string[];
        [key: string]: any;
    };
}

function RunsPageContent() {
    const [runsData, setRunsData] = useState<{
        runs: Run[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalEstimatedAmount?: number;
    }>({
        runs: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
        totalEstimatedAmount: 0
    });

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [selectedRunId, setSelectedRunId] = useState<string | null>(searchParams.get('selectedRun'));
    const [previewImage, setPreviewImage] = useState<string | null>(null);

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
        status: ['COMPLETE'] as string[],
        orderStatus: ['CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION'] as string[],
        priority: [] as string[],
        dateRange: 'all',
        customerId: 'all',
        executorId: 'all',
        reviewerId: 'all',
        processId: 'all',
        locationId: 'all',
    });

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

                // Determine if we should use 'status' (RunStatus) or 'lifeCycleStatusCode'
                const standardRunStatuses = ['CONFIGURE', 'IN_PROGRESS', 'COMPLETE', 'COMPLETED'];
                const hasLifecycleStatus = filters.status.some(s => !standardRunStatuses.includes(s));
                const isProcessSelected = filters.processId && filters.processId !== 'all';

                let statusParam = undefined;
                let lifeCycleStatusParam = undefined;

                if (isProcessSelected || hasLifecycleStatus) {
                    lifeCycleStatusParam = filters.status;
                } else {
                    statusParam = filters.status;
                }

                const res = await getRuns({
                    page: runsData.page,
                    limit: pageSize,
                    search: debouncedSearch,
                    status: statusParam,
                    lifeCycleStatusCode: lifeCycleStatusParam,
                    priority: filters.priority,
                    customerId: filters.customerId,
                    executorUserId: filters.executorId,
                    reviewerUserId: filters.reviewerId,
                    processId: filters.processId,
                    locationId: filters.locationId,
                    orderStatus: filters.orderStatus,
                    createdFrom,
                    createdTo
                });

                if (!cancelled) {
                    setRunsData(prev => ({
                        ...prev,
                        runs: res.runs || [],
                        total: res.total || 0,
                        totalPages: res.totalPages || 0,
                        totalEstimatedAmount: res.totalEstimatedAmount
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
        setFilters({
            status: ['COMPLETE'],
            orderStatus: ['CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION'],
            priority: [],
            dateRange: 'all',
            customerId: 'all',
            executorId: 'all',
            reviewerId: 'all',
            processId: 'all',
            locationId: 'all'
        });
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
                case 'orderQty':
                    aValue = a.orderProcess.order.quantity || 0;
                    bValue = b.orderProcess.order.quantity || 0;
                    break;
                case 'orderAmount':
                    aValue = a.orderProcess.order.amount || 0;
                    bValue = b.orderProcess.order.amount || 0;
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


    return (
        <div className="flex bg-gray-50/50 min-h-full scrollbar-hide">

            {/* LEFT SIDEBAR FILTERS - STICKY */}
            <div className={`
                sticky top-0 h-[calc(100vh-56px)] flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
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
            <div className="flex-1 flex flex-col w-full relative">

                {/* Header Section - STICKY */}
                <div className="sticky top-0 flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`p-2 rounded-lg border transition-colors ${isSidebarOpen
                                ? 'bg-blue-50 border-blue-200 text-blue-600'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            title={isSidebarOpen ? "Collapse Filters" : "Expand Filters"}
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                        </button>

                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                                Run Activity
                                {runsData.totalEstimatedAmount !== undefined && runsData.totalEstimatedAmount > 0 && (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full border border-green-200">
                                        Total: ₹{runsData.totalEstimatedAmount.toLocaleString()}
                                    </span>
                                )}
                            </h1>
                            <p className="text-sm text-gray-500">
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
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-white shadow-sm transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <RunsViewToggle view={viewMode} onViewChange={setViewMode} />
                    </div>
                </div>

                {/* STATUS BARS - STICKY BELOW HEADER */}
                <div className="sticky top-[73px] flex-shrink-0 z-20 bg-white shadow-sm border-b border-gray-100">
                    <RunStatusFilter
                        selectedStatuses={filters.status}
                        onChange={(newStatuses) => {
                            setFilters(prev => ({ ...prev, status: newStatuses }));
                            setRunsData((prev) => ({ ...prev, page: 1 }));
                        }}
                    />
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 p-4">
                    <div className="p-4">
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
                                <p className="font-medium">No runs found</p>
                                <p className="text-sm mt-1">Try adjusting your search query or filters</p>
                                <button
                                    onClick={handleClearFilters}
                                    className="mt-4 text-blue-600 text-sm font-medium hover:underline"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* GRID VIEW */}
                                <div className={viewMode === 'grid' ? 'block' : 'hidden'}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
                                <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
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
                                                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('orderQty')}>
                                                        <div className="flex items-center gap-1">Order Qty {sortConfig?.key === 'orderQty' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('orderAmount')}>
                                                        <div className="flex items-center gap-1">Order Amount {sortConfig?.key === 'orderAmount' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />}</div>
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
                                                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
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
                                                                        <span className="text-gray-300 text-xs text-center px-1">No img</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-gray-700">
                                                                    <Activity className="w-4 h-4 text-gray-400" />
                                                                    {displayName}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-500">
                                                                {run.runNumber}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-gray-600">
                                                                    <User className="w-4 h-4 text-gray-400" />
                                                                    {run.orderProcess.order.customer.name}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {run.priority && (
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${run.priority === 'HIGH' ? 'text-red-600 bg-red-50 border-red-100' :
                                                                        run.priority === 'MEDIUM' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                                                                            'text-blue-600 bg-blue-50 border-blue-100'
                                                                        }`}>
                                                                        {run.priority}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                {run.fields?.Quantity || run.orderProcess.order.quantity || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-600">
                                                                {run.orderProcess.order.quantity || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 font-medium text-blue-700">
                                                                {run.orderProcess.order.amount ? `₹${run.orderProcess.order.amount.toLocaleString()}` : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                {(() => {
                                                                    const rate = run.fields?.['Estimated Rate'];
                                                                    if (rate) return `₹${rate}`;
                                                                    const amount = Number(run.fields?.['Estimated Amount'] || 0);
                                                                    const qty = Number(run.fields?.Quantity || 0);
                                                                    if (amount && qty) return `₹${(amount / qty).toFixed(2).replace(/\.00$/, '')}`;
                                                                    return '-';
                                                                })()}
                                                            </td>
                                                            <td className="px-6 py-4 font-medium text-green-700">
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
                                                                                color: 'bg-green-50 text-green-700 border-green-200',
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
                                                                        case 'DESIGN':
                                                                            config = {
                                                                                label: 'Design',
                                                                                color: 'bg-purple-50 text-purple-700 border-purple-200',
                                                                                icon: <Activity className="w-3.5 h-3.5" />,
                                                                            };
                                                                            break;
                                                                    }

                                                                    return (
                                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
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
                                <Pagination
                                    currentPage={runsData.page}
                                    totalPages={runsData.totalPages}
                                    onPageChange={handlePageChange}
                                    totalItems={runsData.total}
                                    pageSize={pageSize}
                                    itemLabel="runs"
                                />
                            </>
                        )}
                    </div>
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

export default function RunsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <RunsPageContent />
        </Suspense>
    );
}
