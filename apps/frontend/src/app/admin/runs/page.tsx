'use client';

import PageSizeSelector from '@/components/orders/PageSizeSelector';
import { getRuns } from '@/services/run.service';
import debounce from 'lodash/debounce';
import {
    Activity,
    ArrowRight,
    Box,
    CheckCircle,
    Clock,
    Filter,
    Loader2,
    Search,
    User
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface Run {
    id: string;
    orderProcess: {
        order: {
            id: string;
            code: string;
            customer: {
                name: string;
            };
        };
    };
    runTemplate: {
        name: string;
    };
    statusCode: string;
}

export default function RunsPage() {
    const [runsData, setRunsData] = useState<{
        runs: Run[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>({
        runs: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
    });

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);

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
                const res = await getRuns({
                    page: runsData.page,
                    limit: pageSize,
                    search: debouncedSearch
                });

                if (!cancelled) {
                    setRunsData(prev => ({
                        ...prev,
                        runs: res.runs,
                        total: res.total,
                        totalPages: res.totalPages,
                        // Note: page and limit come from state/props, checking response is good but we drive from state
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
    }, [debouncedSearch, runsData.page, pageSize]);

    const handlePageChange = (newPage: number) => {
        setRunsData((prev) => ({ ...prev, page: newPage }));
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setRunsData((prev) => ({ ...prev, page: 1, limit: newSize }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Run Activity</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Monitor all process runs across orders
                    </p>
                </div>

                <div className="flex items-center gap-2">
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
                    <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                ) : runsData.runs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="font-medium">No runs found</p>
                        <p className="text-sm mt-1">Try adjusting your search query</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        <th className="px-6 py-4">Order</th>
                                        <th className="px-6 py-4">Process</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {runsData.runs.map((run) => (
                                        <tr
                                            key={run.id}
                                            className="group hover:bg-blue-50/30 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                                        #{run.orderProcess.order.code}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-gray-700">
                                                    <Activity className="w-4 h-4 text-gray-400" />
                                                    {run.runTemplate.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    {run.orderProcess.order.customer.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${run.statusCode === 'COMPLETE'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : run.statusCode === 'IN_PROGRESS'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                        : 'bg-gray-50 text-gray-600 border-gray-100'
                                                    }`}>
                                                    {run.statusCode === 'COMPLETE' && <CheckCircle className="w-3 h-3" />}
                                                    {run.statusCode === 'IN_PROGRESS' && <Clock className="w-3 h-3 animate-pulse" />}
                                                    {run.statusCode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/admin/orders/${run.orderProcess.order.id}`}
                                                    className="inline-flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                            <div className="text-sm text-gray-500">
                                Showing <span className="font-medium text-gray-900">{((runsData.page - 1) * pageSize) + 1}</span> to <span className="font-medium text-gray-900">{Math.min(runsData.page * pageSize, runsData.total)}</span> of <span className="font-medium text-gray-900">{runsData.total}</span> runs
                            </div>

                            <div className="flex items-center gap-4">
                                <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(runsData.page - 1)}
                                        disabled={runsData.page === 1}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm font-medium text-gray-700">
                                        Page {runsData.page} of {runsData.totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(runsData.page + 1)}
                                        disabled={runsData.page === runsData.totalPages}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
