"use client";

import BillingContextCard from "@/components/billing/BillingContextCard";
import BillingContextTable from "@/components/billing/BillingContextTable";
import BillsFilter from "@/components/billing/BillsFilter";
import Pagination from '@/components/common/Pagination';
import BillingGroupModal from "@/components/modals/BillingGroupModal";
import OrdersViewToggle from "@/components/orders/OrdersViewToggle";
import PageSizeSelector from "@/components/orders/PageSizeSelector";
import { GetBillingContextsResponse } from '@/domain/model/billing.model';
import { getBillingContexts } from '@/services/billing.service';
import debounce from 'lodash/debounce';
import { ChevronLeft, FileText, Filter, Loader2, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from 'react';

export default function BillsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <BillsPageContent />
        </Suspense>
    );
}

function BillsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedGroupId = searchParams.get('SelectedGroup');

    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [pageSize, setPageSize] = useState(12);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [data, setData] = useState<GetBillingContextsResponse>({
        data: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0
    });

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input
    const debouncedSearchUpdate = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value);
            // Reset to page 1 when search changes
            setData((prev) => ({ ...prev, page: 1 }));
        }, 500),
        []
    );

    useEffect(() => {
        debouncedSearchUpdate(searchQuery);
        return () => debouncedSearchUpdate.cancel();
    }, [searchQuery, debouncedSearchUpdate]);

    useEffect(() => {
        const fetchContexts = async () => {
            setLoading(true);
            try {
                const response = await getBillingContexts({
                    page: data.page,
                    limit: pageSize,
                    search: debouncedSearch
                });
                setData(response);
            } catch (error) {
                console.error('Failed to fetch billing contexts:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchContexts();
    }, [data.page, debouncedSearch, pageSize]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= data.totalPages) {
            setData((prev) => ({ ...prev, page: newPage }));
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setData((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on size change
    };

    const handleContextClick = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('SelectedGroup', id);
        router.push(`/admin/bills?${params.toString()}`);
    };

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('SelectedGroup');
        router.push(`/admin/bills?${params.toString()}`);
    };

    return (
        <div className="flex h-full bg-gray-50/50 overflow-hidden scrollbar-hide">
            {/* LEFT SIDEBAR FILTERS */}
            <div
                className={`
                flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
            `}
            >
                <div className="w-72 h-full">
                    <BillsFilter onClose={() => setIsSidebarOpen(false)} />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col w-full relative overflow-hidden">
                {/* Header Section */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Billing Groups</h1>
                            <p className="text-sm text-gray-500">Manage and view all billing groups</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search billing groups..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-white shadow-sm transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <OrdersViewToggle view={viewMode} onViewChange={setViewMode} />
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-4 md:p-6 space-y-6">
                        {/* Results Summary */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-semibold text-gray-800">{data.data.length}</span>{' '}
                                of <span className="font-semibold text-gray-800">{data.total}</span> groups
                            </p>
                            <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                                <p className="text-gray-500 font-medium">Loading billing groups...</p>
                            </div>
                        ) : data.data.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed shadow-sm">
                                <FileText className="w-16 h-16 mb-4 text-gray-300" />
                                <p className="text-lg font-medium">No billing groups found</p>
                                {debouncedSearch ? (
                                    <p className="text-sm mt-1">Try adjusting your search query</p>
                                ) : (
                                    <p className="text-sm mt-1">Create a group from the Completed Orders page</p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* GRID VIEW */}
                                {viewMode === 'grid' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {data.data.map((context) => (
                                            <BillingContextCard
                                                key={context.id}
                                                context={context}
                                                onClick={() => handleContextClick(context.id)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* TABLE VIEW */}
                                {viewMode === 'table' && (
                                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                        <BillingContextTable
                                            data={data.data}
                                            startIndex={(data.page - 1) * pageSize}
                                            onRowClick={handleContextClick}
                                        />
                                    </div>
                                )}

                                {/* PAGINATION */}
                                <Pagination
                                    currentPage={data.page}
                                    totalPages={data.totalPages}
                                    onPageChange={handlePageChange}
                                    totalItems={data.total}
                                    pageSize={pageSize}
                                    itemLabel="groups"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            <BillingGroupModal
                isOpen={!!selectedGroupId}
                onClose={handleCloseModal}
                groupId={selectedGroupId || ''}
            />
        </div>
    );
}
