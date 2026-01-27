'use client';
import BillingModal from '@/components/modals/BillingModal';
import OrderCard from '@/components/orders/OrderCard';
//apps\frontend\src\app\admin\billing\page.tsx
import { Order } from '@/domain/model/order.model';
import { GetOrdersParams, getOrders } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import {
  Calendar,
  CheckCircle,
  FileText,
  Filter,
  Loader2,
  Search,
  X,
} from 'lucide-react';
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
  const [dateFilter, setDateFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Customer data from API
  const [customers, setCustomers] = useState<{ id: string; name: string; code?: string }[]>([
    { id: 'all', name: 'All Customers' },
  ]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { getCustomers } = await import('@/services/customer.service');
        const fetchedCustomers = await getCustomers();
        setCustomers([
          { id: 'all', name: 'All Customers' },
          ...fetchedCustomers.map(c => ({ id: c.id, name: c.name, code: c.code }))
        ]);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      }
    };
    fetchCustomers();
  }, []);

  // Debounce search input
  const debouncedSearchUpdate = useCallback(
    debounce((value: string) => {
      setDebouncedSearch(value);
      // Reset to page 1 when search changes
      setOrdersData((prev) => ({ ...prev, page: 1 }));
    }, 500),
    []
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

        console.log('Billing page fetching with params:', params);

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        // Handle date filters
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

        // Handle customer filter
        if (customerFilter !== 'all') {
          params.customerId = customerFilter;
        }

        const fetchedData = await getOrders(params);
        if (!cancelled) {
          setOrdersData(fetchedData);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        if (!cancelled) {
          setOrdersData(prev => ({ ...prev, orders: [], total: 0, totalPages: 0 }));
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
  }, [debouncedSearch, dateFilter, customerFilter, ordersData.page, refreshTrigger]);

  // Refresh orders function for after billing success
  const refreshOrders = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePageChange = (newPage: number) => {
    setOrdersData(prev => ({ ...prev, page: newPage }));
  };

  // Server already filters by status, so we just use the orders directly
  const filteredOrders = ordersData.orders;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setDateFilter('all');
    setCustomerFilter('all');
    setOrdersData(prev => ({ ...prev, page: 1 }));
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'COMPLETE':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Ready for Billing',
          bgColor: 'bg-green-50',
        };
      case 'BILLED':
        return {
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: <FileText className="w-4 h-4" />,
          label: 'Billed',
          bgColor: 'bg-indigo-50',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <CheckCircle className="w-4 h-4" />,
          label: status,
          bgColor: 'bg-gray-50',
        };
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Rate Configuration</h1>
            <p className="text-gray-600 mt-1">Configure rates for completed orders</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4" />
              <span>Generate Reports</span>
            </button>
            <div className="px-4 py-2.5 bg-green-100 text-green-800 rounded-xl text-sm font-medium">
              {filteredOrders.length} orders ready for billing
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search completed orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>

              {(searchQuery || dateFilter !== 'all' || customerFilter !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-800">{filteredOrders.length}</span> of{' '}
              <span className="font-semibold text-gray-800">{ordersData.total}</span>{' '}
              orders
              {ordersData.totalPages > 1 && (
                <span>
                  {' '}(Page {ordersData.page} of {ordersData.totalPages})
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Calendar className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-600">Loading orders...</span>
          </div>
        )}

        {/* Orders Grid */}
        {!loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredOrders.map((order) => (
                <div key={order.id}>
                  <OrderCard
                    order={{
                      ...order,
                      totalRuns: order.processes?.reduce((sum, p) => sum + (p.runs?.length || 0), 0) || 0
                    }}
                    showConfigure={false}
                    onClick={() => router.push(`/admin/billing?selectedOrder=${order.id}`)}
                  />
                </div>
              ))}
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
                              ? 'bg-green-600 text-white'
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

        {/* Empty State */}
        {!loading && filteredOrders.length === 0 && (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders ready for billing</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || dateFilter !== 'all'
                ? 'No completed orders match your current filters. Try adjusting your search criteria.'
                : 'All orders have been billed. Check back when more orders are completed.'}
            </p>
            {(searchQuery || dateFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Billing Modal */}
        {selectedOrderId && (
          <BillingModal
            orderId={selectedOrderId}
            onClose={() => router.push('/admin/billing')}
            onSuccess={refreshOrders}
          />
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
