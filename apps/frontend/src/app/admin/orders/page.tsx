'use client';

import CreateOrderModal from '@/components/modals/CreateOrderModal';
import ViewOrderModal from '@/components/modals/ViewOrderModal';
import OrderCard from '@/components/orders/OrderCard';
import OrdersFilter from '@/components/orders/OrdersFilter';
import OrdersViewToggle from '@/components/orders/OrdersViewToggle';
import OrderTableRow from '@/components/orders/OrderTableRow';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import { OrderCardData } from '@/domain/model/order.model';
import { GetOrdersParams, getOrderCards } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import {
  Box,
  ChevronLeft,
  Download,
  Filter,
  Loader2,
  Plus,
  Search
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

/* =================================================
   COMPONENT
   ================================================= */

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get('selectedOrder');

  /* ================= STATE ================= */

  const [ordersData, setOrdersData] = useState<{
    orders: OrderCardData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    orders: [],
    total: 0,
    page: 1,
    limit: 12, // Default limit
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [pageSize, setPageSize] = useState(12);

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({
    status: ['CONFIGURE', 'IN_PRODUCTION', 'PRODUCTION_READY'],
    dateRange: 'all',
    customerId: 'all'
  });

  /* ================= EFFECTS ================= */

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

  // API Cache with 2-second TTL
  const cacheRef = useState<{ [key: string]: { data: any; timestamp: number } }>({});
  const CACHE_TTL = 2000; // 2 seconds

  const getCacheKey = (params: GetOrdersParams) => {
    return JSON.stringify(params);
  };

  const getCachedData = (key: string) => {
    const cached = cacheRef[0][key];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
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

        // Check cache first
        const cacheKey = getCacheKey(params);
        const cachedResult = getCachedData(cacheKey);
        // Only use cache if filters match the cached params (simplified check for now, can improve)
        // For now, let's skip cache if filters are active to avoid stale data issues during active filtering
        // or just rely on the existing caching mechanism which uses params as key.
        // Actually, we must include filters in params for cache key to work.

        // Add status filters - send comma-separated statuses
        if (filters.status.length > 0) {
          params.status = filters.status.join(',');
        } else {
          // If explicit empty status filter, user wants to see nothing or everything?
          // Usually if nothing selected, we might default or show all.
          // Let's assume if empty, we send empty string or default.
          // Previous logic defaulted to active statuses if none selected.
          // But with sidebar, user might deselect all. Let's respect user choice if empty -> fetch nothing or all?
          // Let's stick to default active if undefined, but if user explicitly cleared, maybe show all?
          // For now, if empty, we'll send empty string which might return all or none depending on backend.
          // Reverting to previous default behavior if truly empty might differ from user intent.
          // Let's send what is in filters.status.
          // If the user clears all statuses, they probably want to see *something* or *nothing*.
          // Let's assume if it is empty, we don't filter by status (show all).
        }

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        if (filters.customerId !== 'all') {
          params.customerId = filters.customerId;
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
    setFilters({
      status: ['CONFIGURE', 'IN_PRODUCTION', 'PRODUCTION_READY'], // Reset to default interesting statuses
      dateRange: 'all',
      customerId: 'all'
    });
    setOrdersData((prev) => ({ ...prev, page: 1 }));
  };


  /* ================= FILTERED ORDERS ================= */

  const filteredOrders = ordersData.orders;

  /* ================= SSR GUARD ================= */

  if (!isMounted) {
    return null;
  }

  /* ================= UI ================= */

  return (
    <div className="flex bg-gray-50/50">

      {/* LEFT SIDEBAR FILTERS */}
      <div className={`
                flex-shrink-0 bg-white border-r border-gray-200 min-h-screen overflow-hidden transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
            `}>
        <div className="w-72 h-full p-3 sticky top-32">
          <OrdersFilter
            filters={filters}
            onChange={(newFilters) => {
              setFilters(newFilters);
              setOrdersData(prev => ({ ...prev, page: 1 }));
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
              title={isSidebarOpen ? "Collapse Filters" : "Expand Filters"}
            >
              {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
            </button>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Production Orders</h1>
              <p className="text-sm text-gray-500">
                Manage and track orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* SEARCH */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 bg-white shadow-sm transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              onClick={() => setOpenCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Order</span>
            </button>
            <button className="p-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm" title="Export">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-4">
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
              <p className="font-medium">No orders found</p>
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
              <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Sr. No.
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Order Code
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Job Code
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map((order, index) => (
                        <OrderTableRow
                          key={order.id}
                          order={order}
                          index={(ordersData.page - 1) * pageSize + index + 1}
                          onClick={() => router.push(`/admin/orders?selectedOrder=${order.id}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAGINATION */}
              {ordersData.totalPages >= 1 && (
                <div className="flex items-center justify-center pt-6 pb-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(ordersData.page - 1)}
                      disabled={ordersData.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPages = ordersData.totalPages;
                        const currentPage = ordersData.page;
                        const pages: (number | string)[] = [];

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push('...');
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let i = start; i <= end; i++) {
                            if (!pages.includes(i)) pages.push(i);
                          }
                          if (currentPage < totalPages - 2) pages.push('...');
                          if (!pages.includes(totalPages)) pages.push(totalPages);
                        }

                        return pages.map((page, index) => {
                          if (page === '...') {
                            return <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">...</span>;
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page as number)}
                              className={`px-3 py-1 rounded-lg ${ordersData.page === page
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 hover:bg-gray-50'
                                } transition-colors`}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    <button
                      onClick={() => handlePageChange(ordersData.page + 1)}
                      disabled={ordersData.page === ordersData.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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

      {selectedOrderId && (
        <ViewOrderModal
          orderId={selectedOrderId}
          onClose={() => router.push('/admin/orders')}
          onOrderUpdate={() => {
            clearCache();
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
