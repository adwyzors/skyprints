"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Package, 
  CheckCircle, 
  Clock, 
  Settings,
  ChevronRight,
  Eye,
  FileText,
  BarChart3,
  Download,
  MoreVertical,
  X
} from "lucide-react";

import { Order } from "@/types/domain";
import {
  getOrders,
  createOrder,
} from "@/services/orders.service";

import CreateOrderModal from "@/components/modals/CreateOrderModal";
import ViewOrderModal from "@/components/modals/ViewOrderModal";

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get("selectedOrder");

  const [orders, setOrders] = useState<Order[]>(getOrders());
  const [openCreate, setOpenCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  /* ================= CREATE ================= */

  const handleCreate = (payload: any) => {
    const order = createOrder(payload);
    setOrders(prev => [...prev, order]);

    router.push(`/admin/orders?selectedOrder=${order.id}`);
    setOpenCreate(false);
  };

  /* ================= FILTERS & SEARCH ================= */

  const filteredOrders = orders.filter(order => {
    // Search filter
    const matchesSearch = 
      searchQuery === "" ||
      order.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = 
      statusFilter === "all" || 
      order.status.toLowerCase() === statusFilter.toLowerCase();
    
    // Date filter (simple implementation)
    const matchesDate = dateFilter === "all" || true; // Add actual date filtering logic
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="w-4 h-4" />,
          label: "Completed",
          bgColor: "bg-green-50"
        };
      case "IN_PRODUCTION":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Settings className="w-4 h-4" />,
          label: "In Production",
          bgColor: "bg-blue-50"
        };
      case "PRODUCTION_READY":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Clock className="w-4 h-4" />,
          label: "Ready",
          bgColor: "bg-yellow-50"
        };
      case "CONFIGURE":
        return {
          color: "bg-purple-100 text-purple-800 border-purple-200",
          icon: <Package className="w-4 h-4" />,
          label: "Configure",
          bgColor: "bg-purple-50"
        };
      case "BILLED":
        return {
          color: "bg-indigo-100 text-indigo-800 border-indigo-200",
          icon: <FileText className="w-4 h-4" />,
          label: "Billed",
          bgColor: "bg-indigo-50"
        };
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock className="w-4 h-4" />,
          label: status,
          bgColor: "bg-gray-50"
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getProcessSummary = (order: Order) => {
    const totalRuns = order.processes.reduce((sum, process) => sum + process.runs.length, 0);
    const configuredRuns = order.processes.reduce((sum, process) => 
      sum + process.runs.filter(run => run.status === "CONFIGURED").length, 0);
    return { configuredRuns, totalRuns };
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
  };

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
              className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Create Order</span>
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTERS BAR */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* SEARCH INPUT */}
            <div className="flex-1">
              <div className="relative">
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
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              
              {(searchQuery || statusFilter !== "all" || dateFilter !== "all") && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* EXPANDED FILTERS */}
          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="CONFIGURE">To Configure</option>
                    <option value="PRODUCTION_READY">Ready for Production</option>
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BILLED">Billed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer
                  </label>
                  <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All Customers</option>
                    <option value="sky">Sky Prints</option>
                    <option value="urban">Urban Wear</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RESULTS SUMMARY */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span> of{" "}
              <span className="font-semibold text-gray-800">{orders.length}</span> orders
            </p>
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

        {/* ORDERS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredOrders.map(order => {
            const statusConfig = getStatusConfig(order.status);
            const processSummary = getProcessSummary(order);
            const progressPercentage = (processSummary.configuredRuns / processSummary.totalRuns) * 100;
            
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/admin/orders?selectedOrder=${order.id}`)}
                className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1"
              >
                {/* CARD HEADER */}
                <div className={`p-5 ${statusConfig.bgColor}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
                        {order.orderCode}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{order.customerName}</span>
                        <span className="text-xs px-2 py-1 bg-white/70 text-gray-700 rounded-full">
                          {order.customerCode}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-5 space-y-4">
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
                      <p className="text-lg font-bold text-gray-800">{order.processes.length}</p>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                      <span>Configuration Progress</span>
                      <span className="font-medium">{processSummary.configuredRuns}/{processSummary.totalRuns} runs</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* RUNS OVERVIEW */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Runs by Process:</div>
                    <div className="space-y-2">
                      {order.processes.map(process => (
                        <div key={process.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate">{process.name}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* EMPTY STATE */}
        {filteredOrders.length === 0 && (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                ? "No orders match your current filters. Try adjusting your search criteria."
                : "Get started by creating your first production order for Sky Prints manufacturing."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchQuery || statusFilter !== "all" || dateFilter !== "all") && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
              <button
                onClick={() => setOpenCreate(true)}
                className="px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center gap-2"
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
          onCreate={handleCreate}
        />

        {selectedOrderId && (
          <ViewOrderModal
            orderId={selectedOrderId}
            onClose={() => router.push("/admin/orders")}
          />
        )}
      </div>
    </div>
  );
}