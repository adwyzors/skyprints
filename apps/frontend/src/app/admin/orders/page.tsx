'use client';

import CreateOrderModal from '@/components/modals/CreateOrderModal';
import ViewOrderModal from '@/components/modals/ViewOrderModal';
import OrderCard from '@/components/orders/OrderCard';
import OrdersViewToggle from '@/components/orders/OrdersViewToggle';
import OrderTableRow from '@/components/orders/OrderTableRow';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import { OrderCardData } from '@/domain/model/order.model';
import { GetOrdersParams, getOrderCards } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import {
  Download,
  Filter,
  Loader2,
  Package,
  Plus,
  Search,
  X
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

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([
    'CONFIGURE',
    'IN_PRODUCTION',
    'PRODUCTION_READY',
  ]);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Customer data from API
  const [customers, setCustomers] = useState<{ id: string; name: string; code?: string }[]>([
    { id: 'all', name: 'All Customers' },
  ]);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { getCustomers } = await import('@/services/customer.service');
        const fetchedCustomers = await getCustomers();
        setCustomers([
          { id: 'all', name: 'All Customers' },
          ...fetchedCustomers.map((c) => ({ id: c.id, name: c.name, code: c.code })),
        ]);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      }
    };
    fetchCustomers();
  }, []);

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
      if (isSearching) {
        setIsSearching(false);
      }

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
        if (cachedResult && !cancelled) {
          setOrdersData(cachedResult);
          setLoading(false);
          return;
        }

        // Add status filters - send comma-separated statuses
        if (statusFilter.length > 0) {
          params.status = statusFilter.join(',');
        } else {
          // If no status selected, default to all active statuses
          params.status = 'CONFIGURE,IN_PRODUCTION,PRODUCTION_READY';
        }

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        if (customerFilter !== 'all') {
          params.customerId = customerFilter;
        }

        // Handle date filters
        const now = new Date();
        if (dateFilter !== 'all') {
          const fromDate = new Date();

          switch (dateFilter) {
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

        const fetchedData = await getOrderCards(params);
        if (!cancelled) {
          setOrdersData(fetchedData);
          setCachedData(cacheKey, fetchedData);
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
  }, [debouncedSearch, statusFilter, dateFilter, customerFilter, ordersData.page, pageSize, refreshTrigger]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handlePageChange = (newPage: number) => {
    setOrdersData((prev) => ({ ...prev, page: newPage }));
  };

  /* ================= HELPERS ================= */

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(['CONFIGURE', 'IN_PRODUCTION', 'PRODUCTION_READY']);
    setDateFilter('all');
    setCustomerFilter('all');
    setDebouncedSearch('');
    setOrdersData((prev) => ({ ...prev, page: 1 }));
  };

  /* ================= FILTERED ORDERS ================= */

  // Server already filters by status, so we just use the orders directly
  // Additional client-side filtering can be added here if needed
  const filteredOrders = ordersData.orders;

  /* ================= SSR GUARD ================= */

  if (!isMounted) {
    return null;
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Production Orders</h1>
            <p className="text-gray-600 mt-1">Manage and track all manufacturing orders</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setOpenCreate(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Create Order</span>
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTERS BAR */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            {/* SEARCH INPUT WITH BUTTON */}
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders, customers, or codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>

              {(searchQuery ||
                statusFilter.length < 3 ||
                dateFilter !== 'all' ||
                customerFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span>Clear All</span>
                  </button>
                )}
            </div>
          </form>

          {/* STATUS TOGGLE BUTTONS */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { value: 'CONFIGURE', label: 'To Configure', color: 'purple' },
              { value: 'PRODUCTION_READY', label: 'Ready', color: 'yellow' },
              { value: 'IN_PRODUCTION', label: 'In Production', color: 'blue' },
            ].map((status) => {
              const isSelected = statusFilter.includes(status.value);
              const colorClasses = {
                purple: isSelected
                  ? 'bg-purple-100 border-purple-400 text-purple-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50',
                yellow: isSelected
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50',
                blue: isSelected
                  ? 'bg-blue-100 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50',
              };
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setStatusFilter((prev) => prev.filter((s) => s !== status.value));
                    } else {
                      setStatusFilter((prev) => [...prev, status.value]);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${colorClasses[status.color as keyof typeof colorClasses]}`}
                >
                  {isSelected && <span className="mr-1">✓</span>}
                  {status.label}
                </button>
              );
            })}
          </div>

          {/* EXPANDED FILTERS */}
          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RESULTS SUMMARY */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span>{' '}
                of <span className="font-semibold text-gray-800">{ordersData.total}</span> orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
              <OrdersViewToggle view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-600">Loading orders...</span>
          </div>
        )}

        {/* ORDERS GRID/TABLE VIEW */}
        {!loading && (
          <>
            {/* GRID VIEW */}
            <div className={viewMode === 'grid' ? 'block' : 'hidden'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
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
              <div className="flex items-center justify-center pt-6">

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
                        // Show all pages if 7 or less
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Always show first page
                        pages.push(1);

                        if (currentPage > 3) {
                          pages.push('...');
                        }

                        // Show pages around current page
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);

                        for (let i = start; i <= end; i++) {
                          if (!pages.includes(i)) {
                            pages.push(i);
                          }
                        }

                        if (currentPage < totalPages - 2) {
                          pages.push('...');
                        }

                        // Always show last page
                        if (!pages.includes(totalPages)) {
                          pages.push(totalPages);
                        }
                      }

                      return pages.map((page, index) => {
                        if (page === '...') {
                          return (
                            <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">
                              ...
                            </span>
                          );
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

        {/* EMPTY STATE */}
        {!loading && filteredOrders.length === 0 && (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery ||
                statusFilter.length < 3 ||
                dateFilter !== 'all' ||
                customerFilter !== 'all'
                ? 'No orders match your current filters. Try adjusting your search criteria.'
                : 'Get started by creating your first production order.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchQuery ||
                statusFilter.length < 3 ||
                dateFilter !== 'all' ||
                customerFilter !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              <button
                onClick={() => setOpenCreate(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Order
              </button>
            </div>
          </div>
        )}

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
