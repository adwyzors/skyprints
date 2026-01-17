'use client';
//apps\frontend\src\app\admin\billing\page.tsx
import BillingModal from '@/components/modals/BillingModal';
import { Order } from '@/domain/model/order.model';
import { getOrders } from '@/services/orders.service';
import {
  Calendar,
  CheckCircle,
  DollarSign,
  FileText,
  Filter,
  Loader2,
  Package,
  Search,
  User,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get('selectedOrder');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const fetchedOrders = await getOrders();
        if (!cancelled) setOrders(fetchedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh orders function for after billing success
  const refreshOrders = async () => {
    try {
      const fetchedOrders = await getOrders();
      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Error refreshing orders:', error);
    }
  };

  // Filter only completed orders (ready for billing, not yet billed)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Only show completed orders ready for billing (not already billed)
      if (order.status !== 'COMPLETED' && order.status !== 'COMPLETE') {
        return false;
      }

      const orderCode = order.id.slice(0, 8).toUpperCase();

      const matchesSearch =
        !searchQuery ||
        orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.code?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [orders, searchQuery]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Billing</h1>
            <p className="text-gray-600 mt-1">Generate invoices for completed orders</p>
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

              {(searchQuery || dateFilter !== 'all') && (
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
                <div className="md:col-span-2">
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
                  <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All Customers</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-800">{filteredOrders.length}</span>{' '}
              completed orders
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/admin/billing?selectedOrder=${order.id}`)}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-green-300 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className={`p-5 ${statusConfig.bgColor}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-green-600 transition-colors">
                          {order.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{order.customer?.name}</span>
                          <span className="text-xs px-2 py-1 bg-white/70 text-gray-700 rounded-full">
                            {order.customer?.code}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusConfig.color}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
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
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">Processes</span>
                        </div>
                        <p className="text-lg font-bold text-gray-800">{order.processes.length}</p>
                      </div>
                    </div>

                    {/* Runs Overview */}
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Production Summary:</div>
                      <div className="space-y-2">
                        {order.processes.map((process) => (
                          <div key={process.id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 truncate">
                              {process.name}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                              {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/billing?selectedOrder=${order.id}`);
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-linear-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      View & Bill Order
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

