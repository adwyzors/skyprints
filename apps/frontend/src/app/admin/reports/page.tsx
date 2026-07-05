'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import Link from 'next/link';
import Pagination from '@/components/common/Pagination';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import ReportsFilter from '@/components/reports/ReportsFilter';
import { BilledOrderReportResponse, BilledOrderReportRow, ReportsQuery } from '@/domain/model/reports.model';
import { getBilledOrdersReport, getExportUrl } from '@/services/reports.service';
import FilterDrawer from '@/components/layout/FilterDrawer';
import {
    ChevronRight,
    Download,
    FileText,
    Filter,
    Loader2,
    Search,
    Clock,
    X
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import RunLifecycleHistory from '@/components/billing/RunLifecycleHistory';
import { useDebounce } from '@/hooks/useDebounce';

export default function ReportsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <ProtectedReportsPageContent />
        </Suspense>
    );
}

const ProtectedReportsPageContent = withAuth(ReportsPageContent, { permission: Permission.ANALYTICS_VIEW });

function ReportsPageContent() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        const savedSidebarOpen = localStorage.getItem('reports-sidebar-open');
        if (savedSidebarOpen !== null) setIsSidebarOpen(savedSidebarOpen === 'true');
    }, []);

    useEffect(() => {
        localStorage.setItem('reports-sidebar-open', String(isSidebarOpen));
    }, [isSidebarOpen]);

    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<BilledOrderReportResponse | null>(null);
    const [query, setQuery] = useState<ReportsQuery>({
        customerId: '',
        processId: '',
        startDate: '',
        endDate: '',
        page: 1,
        limit: 20
    });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);

    // Sync debounced search to query; skip the no-op on initial mount when both are empty
    useEffect(() => {
        if (!debouncedSearch && !query.search) return;
        setQuery(prev => ({ ...prev, search: debouncedSearch || undefined, page: 1 }));
    }, [debouncedSearch]);

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeHistoryRunId, setActiveHistoryRunId] = useState<string | null>(null);
    const [activeHistoryRunNumber, setActiveHistoryRunNumber] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getBilledOrdersReport(query);
            setReportData(res);
        } catch (error) {
            console.error('Failed to fetch report:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [query]);

    const handleExport = () => {
        const url = getExportUrl(query);
        window.open(url, '_blank');
    };

    const handlePageChange = (page: number) => {
        setQuery(prev => ({ ...prev, page }));
    };

    const handlePageSizeChange = (limit: number) => {
        setQuery(prev => ({ ...prev, limit, page: 1 }));
    };

    const handleSearch = (val: string) => {
        setSearchTerm(val);
    };

    // Robust data extraction
    const data: BilledOrderReportRow[] = useMemo(() => {
        if (!reportData) return [];
        if (Array.isArray(reportData)) return reportData as BilledOrderReportRow[];
        return (reportData as any)?.data || [];
    }, [reportData]);

    // Robust totals calculation
    const totalAmount = useMemo(() => {
        return reportData?.meta?.totalAmount || 0;
    }, [reportData]);

    const totalQty = useMemo(() => {
        return reportData?.meta?.totalQty || 0;
    }, [reportData]);

    const totalPages = useMemo(() => {
        return reportData?.meta?.totalPages || 1;
    }, [reportData]);

    return (
        <div className="flex h-full bg-gray-50/50 overflow-hidden">
            {/* SIDEBAR FILTERS */}
            <FilterDrawer open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}>
                <ReportsFilter
                    onClose={() => setIsSidebarOpen(false)}
                    query={query}
                    onQueryChange={(newFilters) => {
                        setQuery(prev => ({ ...prev, ...newFilters, page: 1 }));
                    }}
                />
            </FilterDrawer>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col w-full relative overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            {!isSidebarOpen && (
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    <Filter className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reports</h1>
                                <p className="text-sm text-gray-500">Billed orders breakdown by process</p>
                            </div>
                        </div>
                        <div className="flex items-center relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search description, order code..."
                                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 transition-all"
                                defaultValue={query.search}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 mr-4">
                            <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                                <span className="text-[10px] text-blue-500 uppercase font-bold block leading-none mb-0.5">Total Revenue</span>
                                <span className="text-sm font-bold text-blue-700">₹{totalAmount.toLocaleString()}</span>
                            </div>
                            <div className="px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                                <span className="text-[10px] text-green-500 uppercase font-bold block leading-none mb-0.5">Total Quantity</span>
                                <span className="text-sm font-bold text-green-700">{totalQty.toLocaleString()} pcs</span>
                            </div>
                        </div>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                                <p className="text-gray-500 font-medium">Generating report...</p>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed shadow-sm">
                                <FileText className="w-16 h-16 mb-4 text-gray-300" />
                                <p className="text-lg font-medium">No records found for this filter</p>
                                <p className="text-sm mt-1">Try adjusting your filters</p>
                            </div>
                        ) : (
                            <>
                                {/* Results Summary */}
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-600">
                                        Showing <span className="font-semibold text-gray-800">{data.length}</span>{' '}
                                        of <span className="font-semibold text-gray-800">{reportData?.meta?.total || 0}</span> records
                                    </p>
                                    <PageSizeSelector pageSize={query.limit || 20} onPageSizeChange={handlePageSizeChange} />
                                </div>

                                {/* TABLE VIEW */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto scrollbar-hide">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50/80 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Order Code</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Image</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Process</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Run No</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Qty</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Rate</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Bill Number</th>
                                                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {data.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                                        <td className="px-4 py-3">
                                                            <Link href={`/admin/orders/${row.orderId}`} className="hover:opacity-85 transition-opacity inline-block">
                                                                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 cursor-pointer">
                                                                    {row.orderCode}
                                                                </span>
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1 max-w-[100px]">
                                                                {row.images && row.images.length > 0 ? (
                                                                    row.images.slice(0, 1).map((img: string, i: number) => (
                                                                        <div
                                                                            key={i}
                                                                            onClick={() => setPreviewImage(img)}
                                                                            className="w-10 h-10 rounded border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 transition-all bg-gray-50"
                                                                        >
                                                                            <img src={img} className="w-full h-full object-cover" alt="" />
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded border border-gray-100 bg-gray-50 flex items-center justify-center">
                                                                        <span className="text-[10px] text-gray-300">No img</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.customerName}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                {row.processName}
                                                            </span>
                                                        </td>
                                                         <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                                             <div className="flex items-center gap-2">
                                                                 <span>{row.runNumbers || '-'}</span>
                                                                 {row.runId && (
                                                                     <button
                                                                         onClick={() => {
                                                                             setActiveHistoryRunId(row.runId!);
                                                                             setActiveHistoryRunNumber(row.runNumbers || '');
                                                                         }}
                                                                         className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                                                     >
                                                                         <Clock className="w-2.5 h-2.5" />
                                                                         <span>History</span>
                                                                     </button>
                                                                 )}
                                                             </div>
                                                         </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.description}>
                                                            {row.description || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">{row.quantity.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 text-right">₹{row.rate}</td>
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">₹{parseFloat(row.amount).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-xs font-medium text-gray-500">
                                                            {row.billId ? (
                                                                <Link 
                                                                    href={`/admin/bills/${row.billId}`} 
                                                                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-semibold"
                                                                >
                                                                    {row.billNumber}
                                                                </Link>
                                                            ) : (
                                                                row.billNumber
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">{row.date}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* PAGINATION */}
                                <div className="mt-8">
                                    <Pagination
                                        currentPage={reportData?.meta?.page || query.page || 1}
                                        totalPages={totalPages}
                                        onPageChange={handlePageChange}
                                        totalItems={reportData?.meta?.total || data.length}
                                        pageSize={query.limit || 20}
                                        itemLabel="records"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

            {activeHistoryRunId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
                            <div className="flex items-center gap-2.5 text-blue-600">
                                <Clock className="w-5 h-5" />
                                <h3 className="font-bold text-base md:text-lg text-gray-900">
                                    Run #{activeHistoryRunNumber} History
                                </h3>
                            </div>
                            <button
                                onClick={() => {
                                    setActiveHistoryRunId(null);
                                    setActiveHistoryRunNumber(null);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <RunLifecycleHistory runId={activeHistoryRunId} />
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => {
                                    setActiveHistoryRunId(null);
                                    setActiveHistoryRunNumber(null);
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors border border-transparent shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
