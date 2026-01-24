'use client';

import CreateOrderModal from '@/components/modals/CreateOrderModal';
import ViewOrderModal from '@/components/modals/ViewOrderModal';
import OrderCard from '@/components/orders/OrderCard';
import OrdersViewToggle from '@/components/orders/OrdersViewToggle';
import OrderTableRow from '@/components/orders/OrderTableRow';
import PageSizeSelector from '@/components/orders/PageSizeSelector';
import { Order } from '@/domain/model/order.model';
import { GetOrdersParams, getOrders } from '@/services/orders.service';
import debounce from 'lodash/debounce';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  Package,
  Plus,
  Search,
  Settings,
  User,
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

        const fetchedData = await getOrders(params);
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

  /* ================= OLD ORDER CARD COMPONENT (UNUSED - kept for reference) ================= */

  const _OldOrderCard = ({ order }: { order: Order }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const statusConfig = getStatusConfig(order.status);
    const processSummary = getProcessSummary(order);

    const images = order.images || [];
    const hasImages = images.length > 0;

    const nextImage = useCallback((e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const prevImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Auto-slide effect
    useEffect(() => {
      if (!hasImages || images.length <= 1 || isPaused) return;

      const interval = setInterval(() => {
        nextImage();
      }, 4000); // Auto-slide every 4 seconds

      return () => clearInterval(interval);
    }, [hasImages, images.length, isPaused, nextImage]);

    return (
      <div
        onClick={() => router.push(`/admin/orders?selectedOrder=${order.id}`)}
        className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 flex flex-col relative"
      >
        {/* STATUS BADGE - TOP RIGHT CORNER */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 shadow-md ${statusConfig.color}`}
          >
            {statusConfig.icon}
            <span className="truncate">{statusConfig.label}</span>
          </span>
        </div>

        {/* IMAGE CAROUSEL - OPTIMIZED FOR FAST LOADING */}
        <div
          className="relative w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {hasImages ? (
            <>
              {/* Render all images with absolute positioning for crossfade */}
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Order ${order.code}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                  loading="lazy"
                  decoding="async"
                />
              ))}

              {images.length > 1 && (
                <>
                  {/* Previous Arrow */}
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                    aria-label="Previous image"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-800 rotate-180" />
                  </button>
                  {/* Next Arrow */}
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-800" />
                  </button>
                  {/* Image Counter */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium z-20">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <Package className="w-16 h-16 mb-2" />
              <span className="text-sm font-medium">No images uploaded</span>
            </div>
          )}
        </div>

        {/* ORDER DETAILS SECTION */}
        <div className="p-4 space-y-3 flex-1">
          {/* Order Code & Job Code */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors truncate">
              {order.code}
            </h3>
            {order.jobCode && (
              <div className="flex items-center gap-2 mt-1">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-600">Job: {order.jobCode}</span>
              </div>
            )}
          </div>

          {/* Customer Name */}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate font-medium">
              {order.customer?.name}
            </span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">Quantity</span>
              </div>
              <p className="text-base font-bold text-gray-800">{order.quantity}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Settings className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">Processes</span>
              </div>
              <p className="text-base font-bold text-gray-800">{order.totalProcesses}</p>
            </div>
          </div>

          {/* Subtle Configure Link */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/admin/orders/${order.id}`);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
            >
              Configure order →
            </button>
          </div>
        </div>
      </div>
    );
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
