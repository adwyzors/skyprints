'use client';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import BillingFilter from '@/components/billing/BillingFilter';
import Pagination from '@/components/common/Pagination';
import BillingModal from '@/components/modals/BillingModal';
import OrderCard from '@/components/orders/OrderCard';
//apps\frontend\src\app\admin\billing\page.tsx
import { Order } from '@/domain/model/order.model';
import { GetOrdersParams, getOrders } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import { Calendar, CheckCircle, ChevronLeft, Filter, Loader2, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function BillingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedOrderId = searchParams.get('selectedOrder');

    const [ordersData, setOrdersData] = useState<{
        orders: Order[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>({
        orders: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [filters, setFilters] = useState({
        dateRange: 'all',
        customerId: 'all',
    });

    const [isMounted, setIsMounted] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Debounce search input
    const debouncedSearchUpdate = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value);
            // Reset to page 1 when search changes
            setOrdersData((prev) => ({ ...prev, page: 1 }));
        }, 500),
        [],
    );

    useEffect(() => {
        debouncedSearchUpdate(searchQuery);
        return () => debouncedSearchUpdate.cancel();
    }, [searchQuery, debouncedSearchUpdate]);

    // Main data fetching effect
    useEffect(() => {
        let cancelled = false;

        const fetchOrders = async () => {
            setLoading(true);
            try {
                const params: GetOrdersParams = {
                    page: ordersData.page,
                    limit: ordersData.limit,
                    status: 'COMPLETE', // Try COMPLETE instead of COMPLETED
                };

                if (debouncedSearch) {
                    params.search = debouncedSearch;
                }

                // Handle date filters
                if (filters.dateRange !== 'all') {
                    const fromDate = new Date();
                    switch (filters.dateRange) {
                        case 'today':
                            fromDate.setHours(0, 0, 0, 0);
                            params.fromDate = fromDate.toISOString().split('T')[0];
                            break;
                        case 'week':
                            fromDate.setDate(fromDate.getDate() - 7);
                            params.fromDate = fromDate.toISOString().split('T')[0];
                            break;
                        case 'month':
                            fromDate.setMonth(fromDate.getMonth() - 1);
                            params.fromDate = fromDate.toISOString().split('T')[0];
                            break;
                        case 'quarter':
                            fromDate.setMonth(fromDate.getMonth() - 3);
                            params.fromDate = fromDate.toISOString().split('T')[0];
                            break;
                    }
                }

                // Handle customer filter
                if (filters.customerId !== 'all') {
                    params.customerId = filters.customerId;
                }

                const fetchedData = await getOrders(params);
                if (!cancelled) {
                    setOrdersData(fetchedData);
                }
            } catch (error) {
                console.error('Error fetching orders:', error);
                if (!cancelled) {
                    setOrdersData((prev) => ({ ...prev, orders: [], total: 0, totalPages: 0 }));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchOrders, 300);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [debouncedSearch, filters, ordersData.page, refreshTrigger]);

    // Refresh orders function for after billing success
    const refreshOrders = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    const handlePageChange = (newPage: number) => {
        setOrdersData((prev) => ({ ...prev, page: newPage }));
    };

    // Server already filters by status, so we just use the orders directly
    const filteredOrders = ordersData.orders;

    const handleClearFilters = () => {
        setSearchQuery('');
        setDebouncedSearch('');
        setFilters({
            dateRange: 'all',
            customerId: 'all',
        });
        setOrdersData((prev) => ({ ...prev, page: 1 }));
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div className="flex bg-gray-50/50">
            {/* LEFT SIDEBAR FILTERS */}
            <div
                className={`
                flex-shrink-0 bg-white border-r border-gray-200 min-h-screen overflow-hidden transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
            `}
            >
                <div className="w-72 h-full p-3 sticky top-32">
                    <BillingFilter
                        filters={filters}
                        onChange={(newFilters) => {
                            setFilters(newFilters);
                            setOrdersData((prev) => ({ ...prev, page: 1 }));
                        }}
                        onClear={handleClearFilters}
                        onClose={() => setIsSidebarOpen(false)}
                    />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col w-full relative">
                {/* HEAD & TOOLBAR */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`p-2 rounded-lg border transition-colors ${isSidebarOpen
                                ? 'bg-blue-50 border-blue-200 text-blue-600'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            title={isSidebarOpen ? 'Collapse Filters' : 'Expand Filters'}
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                        </button>

                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                                Rate Configuration
                            </h1>
                            <p className="text-sm text-gray-500">Configure rates for completed orders</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* SEARCH */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search completed orders..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 bg-white shadow-sm transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-semibold">
                            {ordersData.total} Ready
                        </div>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="p-4">
                    {/* Results Summary */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-sm text-gray-600">
                            Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span>{' '}
                            of <span className="font-semibold text-gray-800">{ordersData.total}</span> orders
                            {ordersData.totalPages > 1 && (
                                <span>
                                    {' '}
                                    (Page {ordersData.page} of {ordersData.totalPages})
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Calendar className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    {/* Loading/Error/Empty States */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <span className="ml-3 text-gray-600">Loading orders...</span>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500 shadow-sm">
                            <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                No orders ready for billing
                            </h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                {searchQuery || filters.dateRange !== 'all'
                                    ? 'No completed orders match your current filters.'
                                    : 'All orders have been billed.'}
                            </p>
                            <button
                                onClick={handleClearFilters}
                                className="mt-4 text-blue-600 text-sm font-medium hover:underline"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Orders Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {filteredOrders.map((order) => (
                                    <div key={order.id}>
                                        <OrderCard
                                            order={{
                                                ...order,
                                                totalRuns:
                                                    order.processes?.reduce((sum, p) => sum + (p.runs?.length || 0), 0) || 0,
                                            }}
                                            showConfigure={false}
                                            onClick={() => router.push(`/admin/billing?selectedOrder=${order.id}`)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <Pagination
                                currentPage={ordersData.page}
                                totalPages={ordersData.totalPages}
                                onPageChange={handlePageChange}
                                totalItems={ordersData.total}
                                pageSize={ordersData.limit}
                                itemLabel="ready for billing"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Billing Modal */}
            {selectedOrderId && (
                <BillingModal
                    orderId={selectedOrderId}
                    onClose={() => router.push('/admin/billing')}
                    onSuccess={refreshOrders}
                />
            )}
        </div>
    );
}

const ProtectedBillingContent = withAuth(BillingContent, { permission: Permission.BILLINGS_VIEW });

export default function BillingPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            }
        >
            <ProtectedBillingContent />
        </Suspense>
    );
}
