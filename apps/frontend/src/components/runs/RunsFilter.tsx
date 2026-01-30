'use client';

import { ProcessSummary } from '@/domain/model/process.model';
import { getCustomers } from '@/services/customer.service';
import { getProcesses, getProcessLifecycleStatuses } from '@/services/process.service';
import { getManagers } from '@/services/user.service';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RunsFilterProps {
    filters: {
        status: string[];
        priority: string[];
        dateRange: string;
        customerId: string;
        executorId: string;
        reviewerId: string;
        processId?: string; // Add processId to filters
    };
    onChange: (newFilters: any) => void;
    onClear: () => void;
    onClose?: () => void; // Optional close handler for mobile/sidebar
}

export default function RunsFilter({ filters, onChange, onClear, onClose }: RunsFilterProps) {
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
    const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
    const [processes, setProcesses] = useState<ProcessSummary[]>([]);
    const [statuses, setStatuses] = useState<string[]>(['PENDING', 'CONFIGURE', 'DESIGN', 'IN_PROGRESS', 'PRODUCTION_READY', 'COMPLETE']);
    const [loadingStatuses, setLoadingStatuses] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custs, mgrs, procs] = await Promise.all([
                    getCustomers(),
                    getManagers(),
                    getProcesses()
                ]);
                setCustomers(custs);
                setManagers(mgrs);
                setProcesses(procs);
            } catch (error) {
                console.error("Failed to fetch filter data", error);
            }
        };
        fetchData();
    }, []);

    // Fetch dynamic statuses when process changes
    useEffect(() => {
        const fetchStatuses = async () => {
            if (!filters.processId || filters.processId === 'all') {
                setStatuses(['PENDING', 'CONFIGURE', 'DESIGN', 'IN_PROGRESS', 'PRODUCTION_READY', 'COMPLETE']);
                return;
            }

            setLoadingStatuses(true);
            try {
                const dynamicStatuses = await getProcessLifecycleStatuses(filters.processId);
                // Handle various response types (string[] or objects[])
                if (dynamicStatuses && dynamicStatuses.length > 0) {
                    // Normalize to strings if needed
                    const normalizedStatuses = dynamicStatuses.length > 0 && typeof dynamicStatuses[0] === 'object'
                        ? (dynamicStatuses as any[]).map(s => s.code || s.name || s.id)
                        : dynamicStatuses;

                    setStatuses(normalizedStatuses as string[]);

                    // Clear selected statuses if they don't exist in the new list
                    const validStatuses = filters.status.filter(s => (normalizedStatuses as string[]).includes(s));
                    if (validStatuses.length !== filters.status.length) {
                        onChange({ ...filters, status: validStatuses });
                    }
                } else {
                    setStatuses([]);
                }
            } catch (error) {
                console.error("Failed to fetch process statuses", error);
            } finally {
                setLoadingStatuses(false);
            }
        };

        fetchStatuses();
    }, [filters.processId]);

    const handleProcessChange = (processId: string) => {
        onChange({ ...filters, processId, status: [] }); // Clear status on process change
    };

    const handleStatusChange = (status: string) => {
        const current = filters.status;
        const next = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        onChange({ ...filters, status: next });
    };

    const handlePriorityChange = (priority: string) => {
        const current = filters.priority;
        const next = current.includes(priority)
            ? current.filter(p => p !== priority)
            : [...current, priority];
        onChange({ ...filters, priority: next });
    };

    // Custom clear handler to include processId reset
    const handleClear = () => {
        onClear();
        // The parent onClear should ideally handle resetting context, but if not we might need local handling?
        // Assuming parent resets `filters` prop completely.
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-lg">Filters</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClear}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">

                {/* Process Selection */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Process</label>
                    <select
                        value={filters.processId || 'all'}
                        onChange={(e) => handleProcessChange(e.target.value)}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">All Processes</option>
                        {processes.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* Status - Only show if process is selected */}
                {filters.processId && filters.processId !== 'all' && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            Status
                            {loadingStatuses && <span className="ml-2 text-blue-500 text-[10px] lowercase font-normal">loading...</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {statuses.map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filters.status.includes(status)
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                            {statuses.length === 0 && !loadingStatuses && (
                                <span className="text-xs text-gray-400 italic">No statuses available</span>
                            )}
                            {loadingStatuses && statuses.length === 0 && (
                                <span className="text-xs text-gray-400 italic">Fetching statuses...</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Priority */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Priority</label>
                    <div className="flex flex-wrap gap-2">
                        {['HIGH', 'MEDIUM', 'LOW'].map(priority => (
                            <button
                                key={priority}
                                onClick={() => handlePriorityChange(priority)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filters.priority.includes(priority)
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                            >
                                {priority}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Range */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Created Date</label>
                    <select
                        value={filters.dateRange}
                        onChange={(e) => onChange({ ...filters, dateRange: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>

                {/* Customer */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Customer</label>
                    <select
                        value={filters.customerId}
                        onChange={(e) => onChange({ ...filters, customerId: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">All Customers</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Executor */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Executor</label>
                    <select
                        value={filters.executorId}
                        onChange={(e) => onChange({ ...filters, executorId: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">Any Executor</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                {/* Reviewer */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Reviewer</label>
                    <select
                        value={filters.reviewerId}
                        onChange={(e) => onChange({ ...filters, reviewerId: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">Any Reviewer</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
