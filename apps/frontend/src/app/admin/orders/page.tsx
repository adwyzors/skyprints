'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import Pagination from '@/components/common/Pagination';
import CreateOrderModal from '@/components/modals/CreateOrderModal';
import ImagePreviewModal from '@/components/modals/ImagePreviewModal';
import ViewOrderModal from '@/components/modals/ViewOrderModal';
import OrderCard from '@/components/orders/OrderCard';
import OrdersFilter from '@/components/orders/OrdersFilter';
import OrderStatusFilter from '@/components/orders/OrderStatusFilter';
import OrdersViewToggle from '@/components/orders/OrdersViewToggle';
import OrderTableRow from '@/components/orders/OrderTableRow';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import { OrderCardData } from '@/domain/model/order.model';
import { GetOrdersParams, getOrderCards } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import { Box, ChevronLeft, Filter, Loader2, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

/* =================================================
   COMPONENT
   ================================================= */

function AdminOrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedOrderId = searchParams.get('selectedOrder');
    const { user, hasPermission } = useAuth();

    /* ================= STATE ================= */

    const [ordersData, setOrdersData] = useState<{
        orders: OrderCardData[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalQuantity?: number;
        totalEstimatedAmount?: number;
    }>({
        orders: [],
        total: 0,
        page: 1,
        limit: 12, // Default limit
        totalPages: 0,
        totalQuantity: 0,
        totalEstimatedAmount: 0,
    });
    const [loading, setLoading] = useState(true);
    const [openCreate, setOpenCreate] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [pageSize, setPageSize] = useState(12);

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({
        status: ['CONFIGURE', 'IN_PRODUCTION', 'PRODUCTION_READY'],
        dateRange: 'all',
        customerId: 'all',
        locationId: 'all',
    });

    const [previewImage, setPreviewImage] = useState<string | null>(null);

    /* ================= EFFECTS ================= */

    useEffect(() => {
        setIsMounted(true);

        // Apply location restriction if applicable
        const userLocation = user?.user?.location;
        const hasGlobalView = hasPermission(Permission.LOCATIONS_ALL_VIEW);

        if (userLocation && !hasGlobalView) {
            setFilters(prev => ({
                ...prev,
                locationId: userLocation.id || userLocation.name
            }));
        }
    }, [user, hasPermission]);

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

    // API Cache with 2-second TTL
    const cacheRef = useState<{ [key: string]: { data: any; timestamp: number } }>({});
    const CACHE_TTL = 2000; // 2 seconds

    const getCacheKey = (params: GetOrdersParams) => {
        return JSON.stringify(params);
    };

    const getCachedData = (key: string) => {
        const cached = cacheRef[0][key];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        return null;
    };

    const setCachedData = (key: string, data: any) => {
        cacheRef[0][key] = { data, timestamp: Date.now() };
    };

    const clearCache = () => {
        cacheRef[0] = {};
    };

    // Main data fetching effect
    useEffect(() => {
        let cancelled = false;

        const fetchOrders = async () => {
            setLoading(true);
            try {
                // Build query params
                const params: GetOrdersParams = {
                    page: ordersData.page,
                    limit: pageSize,
                };

                if (filters.status.length > 0) {
                    params.status = filters.status.join(',');
                }

                if (debouncedSearch) {
                    params.search = debouncedSearch;
                }

                if (filters.customerId !== 'all') {
                    params.customerId = filters.customerId;
                }

                if (filters.locationId && filters.locationId !== 'all') {
                    params.locationId = filters.locationId;
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

                // Update cache key with full params
                const fullCacheKey = getCacheKey(params);
                const fullCachedResult = getCachedData(fullCacheKey);

                if (fullCachedResult && !cancelled) {
                    setOrdersData(fullCachedResult);
                    setLoading(false);
                    return;
                }

                const fetchedData = await getOrderCards(params);
                if (!cancelled) {
                    setOrdersData(fetchedData);
                    setCachedData(fullCacheKey, fetchedData);
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
    }, [debouncedSearch, filters, ordersData.page, pageSize, refreshTrigger]);

    /* ================= HANDLERS ================= */

    const handleOrderCreated = () => {
        clearCache();
        setRefreshTrigger((prev) => prev + 1);
        setOpenCreate(false);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setOrdersData((prev) => ({ ...prev, page: 1, limit: newSize }));
    };

    const handlePageChange = (newPage: number) => {
        setOrdersData((prev) => ({ ...prev, page: newPage }));
    };

    const handleClearFilters = () => {
        const userLocation = user?.user?.location;
        const hasGlobalView = hasPermission(Permission.LOCATIONS_ALL_VIEW);

        setFilters({
            status: ['CONFIGURE', 'IN_PRODUCTION', 'PRODUCTION_READY'], // Reset to default interesting statuses
            dateRange: 'all',
            customerId: 'all',
            locationId: (userLocation && !hasGlobalView) ? (userLocation.id || userLocation.name) : 'all',
        });
        setOrdersData((prev) => ({ ...prev, page: 1 }));
    };

    const filteredOrders = ordersData.orders;

    /* ================= SSR GUARD ================= */

    if (!isMounted) {
        return null;
    }

    /* ================= UI ================= */

    return (
        <div className="flex bg-gray-50/50 min-h-full scrollbar-hide">
            {/* LEFT SIDEBAR FILTERS - STICKY to MAIN SCROLL */}
            <div
                className={`
                relative h-[calc(100vh-56px)] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out z-40
                ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'}
            `}
            >
                <div className="w-72 p-3">
                    <OrdersFilter
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
            <div className="flex-1 flex flex-col w-full relative min-w-0">
                {/* HEAD & TOOLBAR */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Production Orders</h1>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full border border-green-200 whitespace-nowrap">
                                        Total: ₹{ordersData.totalEstimatedAmount?.toLocaleString() || 0}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100 whitespace-nowrap">
                                        <span className="text-[10px] text-blue-400 uppercase tracking-wider">Total pcs</span>
                                        {ordersData.totalQuantity?.toLocaleString() || 0}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">Manage and track orders</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* SEARCH */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search orders, status, customers..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 bg-white shadow-sm transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {hasPermission(Permission.ORDERS_CREATE) && (
                            <button
                                onClick={() => setOpenCreate(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">New Order</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* STATUS BAR & BULK ACTIONS */}
                <div className="z-10 flex flex-col bg-white border-b border-gray-100">
                    <OrderStatusFilter
                        selectedStatuses={filters.status}
                        onChange={(newStatuses) => {
                            setFilters(prev => ({ ...prev, status: newStatuses }));
                            setOrdersData((prev) => ({ ...prev, page: 1 }));
                        }}
                    />
                </div>

                {/* CONTENT */}
                <div className="flex-1 p-6 pb-24 md:pb-6">
                    {/* Results Summary */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-sm text-gray-600">
                            Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span>{' '}
                            of <span className="font-semibold text-gray-800">{ordersData.total}</span> orders
                        </p>
                        <div className="flex items-center gap-3">
                            <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
                            <OrdersViewToggle view={viewMode} onViewChange={setViewMode} />
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
                            <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="font-medium text-gray-900">No orders found</p>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredOrders.map((order) => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            active={viewMode === 'grid'}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* TABLE VIEW */}
                            <div
                                className={`bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm ${viewMode === 'table' ? 'block' : 'hidden'}`}
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    #
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Order Code
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Image
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Job Code
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Date
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Quantity
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Customer
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {filteredOrders.map((order, index) => (
                                                <OrderTableRow
                                                    key={order.id}
                                                    order={order}
                                                    index={(ordersData.page - 1) * pageSize + index + 1}
                                                    onClick={(type, value) => {
                                                        if (type === 'image' && value) {
                                                            setPreviewImage(value);
                                                        } else {
                                                            router.push(`/admin/orders?selectedOrder=${order.id}`);
                                                        }
                                                    }}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* PAGINATION */}
                            <div className="mt-8">
                                <Pagination
                                    currentPage={ordersData.page}
                                    totalPages={ordersData.totalPages}
                                    onPageChange={handlePageChange}
                                    totalItems={ordersData.total}
                                    pageSize={pageSize}
                                    itemLabel="orders"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <CreateOrderModal
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                onCreate={handleOrderCreated}
            />

            {
                selectedOrderId && (
                    <ViewOrderModal
                        orderId={selectedOrderId}
                        onClose={() => router.push('/admin/orders')}
                        onOrderUpdate={() => {
                            clearCache();
                            setRefreshTrigger((prev) => prev + 1);
                        }}
                    />
                )
            }

            <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        </div >
    );
}

const ProtectedOrdersContent = withAuth(AdminOrdersContent, { permission: Permission.ORDERS_VIEW });

export default function AdminOrdersPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            }
        >
            <ProtectedOrdersContent />
        </Suspense>
    );
}
