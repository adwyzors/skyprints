'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import Pagination from '@/components/common/Pagination';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import ReportsFilter from '@/components/reports/ReportsFilter';
import { BilledOrderReportResponse, BilledOrderReportRow, ReportsQuery } from '@/domain/model/reports.model';
import { getBilledOrdersReport, getExportUrl } from '@/services/reports.service';
import {
    ChevronRight,
    Download,
    FileText,
    Filter,
    Loader2,
    Search
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
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

    // Sync debounced search to query
    useEffect(() => {
        setQuery(prev => ({ ...prev, search: debouncedSearch, page: 1 }));
    }, [debouncedSearch]);

    const [previewImage, setPreviewImage] = useState<string | null>(null);

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

    const paginatedData = useMemo(() => {
        return data; // Server-side already paginated
    }, [data]);

    return (
        <div className="flex h-full bg-gray-50/50 overflow-hidden">
            {/* SIDEBAR FILTERS */}
            <div
                className={`
                flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full'}
            `}
            >
                <div className="w-72 h-full">
                    <ReportsFilter
                        onClose={() => setIsSidebarOpen(false)}
                        query={query}
                        onQueryChange={(newFilters) => setQuery(prev => ({ ...prev, ...newFilters, page: 1 }))}
                    />
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col w-full relative overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-20 flex items-center justify-between">
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
                        <div className="hidden lg:flex items-center relative ml-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search description, order code..."
                                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
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

                {/* Table Content */}
                <div className="flex-1 overflow-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                            <p className="text-gray-500 font-medium">Generating report data...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed shadow-sm">
                            <FileText className="w-16 h-16 mb-4 text-gray-200" />
                            <p className="text-lg font-medium">No records found</p>
                            <p className="text-sm">Try adjusting your filters to find billed orders</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500 font-medium">
                                    Showing <span className="text-gray-900">{paginatedData.length}</span> of <span className="text-gray-900">{reportData?.meta?.total || data.length}</span> records
                                </p>
                                <div className="flex items-center gap-4">
                                    <PageSizeSelector pageSize={query.limit || 20} onPageSizeChange={handlePageSizeChange} />
                                    <button
                                        onClick={() => handlePageChange((reportData?.meta?.page || query.page || 1) + 1)}
                                        disabled={(reportData?.meta?.page || query.page || 1) >= totalPages}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        Next Page
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
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
                                                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Prod</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Post-Prod</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Bill Number</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {paginatedData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                            {row.orderCode}
                                                        </span>
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
                                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.runNumbers || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs text-gray-500 line-clamp-2 max-w-[200px]" title={row.description}>
                                                            {row.description || '-'}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">{row.quantity.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 text-right">₹{row.rate}</td>
                                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">₹{parseFloat(row.amount).toLocaleString()}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 block truncate max-w-[120px]" title={row.preProductionLocation}>
                                                            {row.preProductionLocation || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 block truncate max-w-[120px]" title={row.postProductionLocation}>
                                                            {row.postProductionLocation || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-medium text-gray-500">{row.billNumber}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{row.date}</td>
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
                        </div>
                    )}
                </div>
            </div>
            <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
    );
}
