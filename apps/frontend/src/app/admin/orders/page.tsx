'use client';

import debounce from 'lodash/debounce';
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  MoreVertical,
  Package,
  Plus,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import CreateOrderModal from '@/components/modals/CreateOrderModal';
import ViewOrderModal from '@/components/modals/ViewOrderModal';
import { Order } from '@/domain/model/order.model';
import { GetOrdersParams, getOrders } from '@/services/orders.service';

/* =================================================
   COMPONENT
   ================================================= */

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get('selectedOrder');

  /* ================= STATE ================= */

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
    limit: 12, // Default limit
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      if (isSearching) {
        setIsSearching(false);
      }

      setLoading(true);
      try {
        // Build query params
        const params: GetOrdersParams = {
          page: ordersData.page,
          limit: ordersData.limit,
        };

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
  }, [debouncedSearch, statusFilter, dateFilter, customerFilter, ordersData.page, refreshTrigger]);

  /* ================= HANDLERS ================= */

  const handleOrderCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
    setOpenCreate(false);
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

  const getProcessSummary = (order: Order) => {
    const totalRuns = order.processes.reduce((sum, p) => sum + p.runs.length, 0);

    const configuredRuns = order.processes.reduce(
      (sum, p) => sum + p.runs.filter((r) => r.configStatus === 'CONFIGURED').length,
      0,
    );

    return { configuredRuns, totalRuns };
  };
  const getCompletionProgress = (order: Order): number => {
    let total = 0;
    let completed = 0;

    order.processes.forEach((process) => {
      process.runs.forEach((run) => {
        // lifecycle
        total += run.lifecycle.length;
        completed += run.lifecycle.filter((step) => step.completed).length;

        // fields
        total += run.fields.length - 1;
        completed += run.fields.filter((field) => run.values?.[field.key] != null).length;
      });
    });

    if (total === 0) return 0;

    return Math.round((completed / total) * 100);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Completed',
          bgColor: 'bg-green-50',
        };
      case 'IN_PRODUCTION':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <Settings className="w-4 h-4" />,
          label: 'In Production',
          bgColor: 'bg-blue-50',
        };
      case 'PRODUCTION_READY':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: <Clock className="w-4 h-4" />,
          label: 'Ready',
          bgColor: 'bg-yellow-50',
        };
      case 'CONFIGURE':
        return {
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <Package className="w-4 h-4" />,
          label: 'Configure',
          bgColor: 'bg-purple-50',
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
          icon: <Clock className="w-4 h-4" />,
          label: status,
          bgColor: 'bg-gray-50',
        };
    }
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
                {ordersData.totalPages > 1 && (
                  <span>
                    {' '}
                    (Page {ordersData.page} of {ordersData.totalPages})
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Calendar className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
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

        {/* ORDERS GRID - IMPROVED LAYOUT */}
        {!loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const processSummary = getProcessSummary(order);
                const progressPercentage = getCompletionProgress(order);
                const progressColor =
                  progressPercentage < 30
                    ? 'from-red-500 to-red-600'
                    : progressPercentage < 70
                      ? 'from-yellow-500 to-yellow-600'
                      : 'from-green-500 to-green-600';

                return (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/admin/orders?selectedOrder=${order.id}`)}
                    className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  >
                    {/* CARD HEADER */}
                    <div className={`p-5 ${statusConfig.bgColor}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                            {order.code}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">
                              {order.customer?.name}
                            </span>
                            <span className="text-xs px-2 py-1 bg-white/70 text-gray-700 rounded-full flex-shrink-0">
                              {order.customer?.code}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusConfig.color}`}
                          >
                            {statusConfig.icon}
                            <span className="truncate">{statusConfig.label}</span>
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CARD BODY */}
                    <div className="p-5 space-y-4 flex-1">
                      {/* QUANTITY & PROCESS INFO */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Quantity</span>
                          </div>
                          <p className="text-lg font-bold text-gray-800">{order.quantity}</p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Processes</span>
                          </div>
                          <p className="text-lg font-bold text-gray-800">{order.totalProcesses}</p>
                        </div>
                      </div>

                      {/* PROGRESS BAR */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                          <span>Production Progress</span>
                          <span className="font-medium">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`bg-gradient-to-r ${progressColor} h-2 rounded-full transition-all duration-700`}
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* RUNS OVERVIEW */}
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">Runs by Process:</div>
                        <div className="space-y-2">
                          {order.processes.slice(0, 3).map((process) => (
                            <div key={process.id} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 truncate">{process.name}</span>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full flex-shrink-0">
                                {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                          {order.processes.length > 3 && (
                            <div className="text-xs text-gray-500 pt-1">
                              +{order.processes.length - 3} more processes
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CARD FOOTER */}
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 truncate mr-2">
                          {processSummary.configuredRuns}/{processSummary.totalRuns} runs configured
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/orders/${order.id}`);
                            }}
                            className="px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                          >
                            Configure
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION */}
            {ordersData.totalPages > 1 && (
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
                    {Array.from({ length: Math.min(5, ordersData.totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      if (ordersData.totalPages <= 5) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 rounded-lg ${
                              ordersData.page === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 hover:bg-gray-50'
                            } transition-colors`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      return null;
                    })}
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
          <ViewOrderModal orderId={selectedOrderId} onClose={() => router.push('/admin/orders')} />
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
