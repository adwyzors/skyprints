'use client';

import ViewRunModal from '@/components/modals/ViewRunModal';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import RunCard from '@/components/runs/RunCard';
import RunsFilter from '@/components/runs/RunsFilter';
import RunsViewToggle from '@/components/runs/RunsViewToggle';
import { getRuns } from '@/services/run.service';
import debounce from 'lodash/debounce';
import {
    Activity,
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
import { Suspense, useCallback, useEffect, useState } from 'react';

// Enhanced Run interface to support Card View
interface Run {
    id: string;
    orderProcess: {
        name?: string;
        order: {
            id: string;
            code: string;
            quantity: number;
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

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Filter State
    const [filters, setFilters] = useState({
        status: [] as string[],
        priority: [] as string[],
        dateRange: 'all',
        customerId: 'all',
        executorId: 'all',
        reviewerId: 'all',
        processId: 'all'
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
                // If a process is selected, or if the selected status is NOT one of the standard RunStatuses, assume it's a lifecycle status.
                // Standard RunStatuses: CONFIGURE, IN_PROGRESS, COMPLETE, COMPLETED (handling variations)

                const standardRunStatuses = ['CONFIGURE', 'IN_PROGRESS', 'COMPLETE', 'COMPLETED'];

                // Check if any selected status is NOT a standard run status
                const hasLifecycleStatus = filters.status.some(s => !standardRunStatuses.includes(s));
                const isProcessSelected = filters.processId && filters.processId !== 'all';

                // If process is selected OR we have non-standard statuses, use lifeCycleStatusCode
                // Otherwise, use status
                // We might need to split them if mixed, but for now assuming one mode

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
                    status: statusParam, // Use mapped param
                    lifeCycleStatusCode: lifeCycleStatusParam, // Use mapped param
                    priority: filters.priority,
                    customerId: filters.customerId,
                    executorUserId: filters.executorId,
                    reviewerUserId: filters.reviewerId,
                    processId: filters.processId,
                    createdFrom,
                    createdTo
                });

                if (!cancelled) {
                    console.log('DEBUG RUNS RESP:', res);
                    setRunsData(prev => ({
                        ...prev,
                        runs: res.runs || [],
                        total: res.total || 0,
                        totalPages: res.totalPages || 0,
                        totalEstimatedAmount: res.totalEstimatedAmount // Update total amount
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
            status: [],
            priority: [],
            dateRange: 'all',
            customerId: 'all',
            executorId: 'all',
            reviewerId: 'all',
            processId: 'all'
        });
        setRunsData((prev) => ({ ...prev, page: 1 }));
    };

    return (
        <div className="flex bg-gray-50/50">

            {/* LEFT SIDEBAR FILTERS */}
            <div className={`
                flex-shrink-0 bg-white border-r border-gray-200 min-h-screen overflow-hidden transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
            `}>
                <div className="w-72 h-full p-3 sticky top-32">
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

                {/* Header Section */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0">
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
                                placeholder="Search runs..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-white shadow-sm transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <RunsViewToggle view={viewMode} onViewChange={setViewMode} />
                    </div>
                </div>

                {/* Content */}
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
                                                <th className="px-6 py-4">Order Code</th>
                                                <th className="px-6 py-4">Process</th>
                                                <th className="px-6 py-4">Run #</th>
                                                <th className="px-6 py-4">Customer</th>
                                                <th className="px-6 py-4">Priority</th>
                                                <th className="px-6 py-4">Quantity</th>
                                                <th className="px-6 py-4">Est. Rate</th>
                                                <th className="px-6 py-4">Est. Total</th>
                                                <th className="px-6 py-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {runsData.runs.map((run) => {
                                                // Process Name Logic
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
                                                            {run.fields?.Quantity || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-700">
                                                            {run.fields?.['Estimated Rate'] ? `₹${run.fields['Estimated Rate']}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-green-700">
                                                            {run.fields?.['Estimated Amount'] ? `₹${run.fields['Estimated Amount'].toLocaleString()}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                // Logic from RunCard.tsx
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

                            {/* Pagination Footer */}
                            <div className="flex items-center justify-between pt-6 pb-6">
                                <div className="flex items-center gap-2 mx-auto">
                                    <button
                                        onClick={() => handlePageChange(runsData.page - 1)}
                                        disabled={runsData.page === 1}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>

                                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
                                        {runsData.page} / {runsData.totalPages}
                                    </span>

                                    <button
                                        onClick={() => handlePageChange(runsData.page + 1)}
                                        disabled={runsData.page === runsData.totalPages}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* VIEW RUN MODAL */}
                {selectedRunId && (
                    <ViewRunModal
                        runId={selectedRunId}
                        onClose={() => handleRunSelection(null)}
                        onRunUpdate={() => {
                            // Refresh list to reflect any status changes
                            setRunsData(prev => ({ ...prev }));
                            setFilters(prev => ({ ...prev }));
                        }}
                    />
                )}
            </div>
        </div >
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
