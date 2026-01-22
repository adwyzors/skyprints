"use client";

import BillingGroupModal from "@/components/modals/BillingGroupModal";
import { BillingContext, GetBillingContextsResponse } from '@/domain/model/billing.model';
import { getBillingContexts } from '@/services/billing.service';
import debounce from 'lodash/debounce';
import { Calendar, ChevronLeft, ChevronRight, CreditCard, FileText, Loader2, Package, Search, X } from 'lucide-react';
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
                    limit: 12,
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
    }, [data.page, debouncedSearch]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= data.totalPages) {
            setData((prev) => ({ ...prev, page: newPage }));
        }
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
        <div className="min-h-screen bg-gray-50">
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Billing Groups</h1>
                    <p className="text-gray-600 mt-1">Manage and view all billing groups</p>
                </div>

                {/* SEARCH BAR */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search billing groups by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <p className="text-gray-500 font-medium">Loading billing groups...</p>
                    </div>
                ) : data.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-200 border-dashed">
                        <FileText className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No billing groups found</p>
                        {debouncedSearch ? (
                            <p className="text-sm">Try adjusting your search query</p>
                        ) : (
                            <p className="text-sm">Create a group from the Completed Orders page</p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {data.data.map((context) => (
                            <div key={context.id} onClick={() => handleContextClick(context.id)} className="cursor-pointer">
                                <BillingContextCard context={context} />
                            </div>
                        ))}
                    </div>
                )}

                {/* PAGINATION */}
                {!loading && data.totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <button
                                onClick={() => handlePageChange(data.page - 1)}
                                disabled={data.page === 1}
                                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => handlePageChange(data.page + 1)}
                                disabled={data.page === data.totalPages}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{(data.page - 1) * 12 + 1}</span> to{' '}
                                    <span className="font-medium">
                                        {Math.min(data.page * 12, data.total)}
                                    </span>{' '}
                                    of <span className="font-medium">{data.total}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => handlePageChange(data.page - 1)}
                                        disabled={data.page === 1}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    {[...Array(data.totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => handlePageChange(i + 1)}
                                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${data.page === i + 1
                                                ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handlePageChange(data.page + 1)}
                                        disabled={data.page === data.totalPages}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <BillingGroupModal
                isOpen={!!selectedGroupId}
                onClose={handleCloseModal}
                groupId={selectedGroupId || ''}
            />
        </div>
    );
}

function BillingContextCard({ context }: { context: BillingContext }) {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(Number(amount));
    };

    const isDraft = context.latestSnapshot?.isDraft ?? true;

    return (
        <div className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all duration-300 hover:-translate-y-1">
            <div className="p-5 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {context.name}
                        </h3>
                        {context.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{context.description}</p>
                        )}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${isDraft
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        : 'bg-green-50 text-green-700 border-green-100'
                        }`}>
                        {isDraft ? 'DRAFT' : 'FINAL'}
                    </span>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Orders</span>
                        </div>
                        <p className="text-lg font-bold text-gray-800">{context.ordersCount}</p>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Total</span>
                        </div>
                        <p className="text-lg font-bold text-indigo-600">
                            {context.latestSnapshot ? formatCurrency(context.latestSnapshot.result) : '-'}
                        </p>
                    </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Created {formatDate(context.latestSnapshot?.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
