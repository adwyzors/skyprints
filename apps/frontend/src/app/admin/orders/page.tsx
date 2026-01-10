"use client";
// apps/frontend/src/app/admin/orders/page.tsx

import {
    Calendar,
    CheckCircle,
    ChevronRight,
    Clock,
    Download,
    Eye as EyeIcon,
    EyeOff,
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
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import CreateOrderModal from "@/components/modals/CreateOrderModal";
import ViewOrderModal from "@/components/modals/ViewOrderModal";
import { Order } from "@/model/order.model";
import { getOrders } from "@/services/orders.service";

/* =================================================
   COMPONENT
   ================================================= */

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get("selectedOrder");

  /* ================= STATE ================= */

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("hide_completed");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  /* ================= FETCH ORDERS ================= */

  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const fetchedOrders = await getOrders();
        if (!cancelled) {
          setOrders(fetchedOrders);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchOrders, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, statusFilter, dateFilter]);

  /* ================= FILTERED ORDERS ================= */

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch =
        !searchQuery ||
        order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.customer?.code
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      if (statusFilter !== "hide_completed" && statusFilter !== "all") {
        matchesStatus = order.status === statusFilter;
      }

      if (statusFilter === "hide_completed") {
        matchesStatus =
          order.status !== "COMPLETED" &&
          order.status !== "BILLED";
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  /* ================= HELPERS ================= */

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const toggleShowCompleted = () => {
    setShowCompleted(prev => !prev);
    setStatusFilter(showCompleted ? "hide_completed" : "all");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("hide_completed");
    setDateFilter("all");
  };

  const getProcessSummary = (order: Order) => {
    const totalRuns = order.processes.reduce(
      (sum, p) => sum + p.runs.length,
      0
    );
    const configuredRuns = order.processes.reduce(
      (sum, p) =>
        sum +
        p.runs.filter(r => r.status === "CONFIGURED").length,
      0
    );
    return { configuredRuns, totalRuns };
  };

  const getCompletionProgress = (order: Order) => {
    if (
      order.status === "COMPLETED" ||
      order.status === "BILLED"
    ) {
      return 100;
    }

    const steps = [
      "CONFIGURED",
      "DESIGN",
      "SIZE_COLOR",
      "TRACING",
      "EXPOSING",
      "SAMPLE",
      "PRODUCTION",
      "FUSING",
      "CARTING",
      "COMPLETED",
    ];

    let total = 0;
    let completed = 0;

    order.processes.forEach(process => {
      process.runs.forEach(run => {
        if (run.status === "NOT_CONFIGURED") return;
        total += steps.length - 1;
        const idx = steps.indexOf(run.status);
        completed += idx >= 0 ? idx : 0;
      });
    });

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="w-4 h-4" />,
          label: "Completed",
          bgColor: "bg-green-50",
        };
      case "IN_PRODUCTION":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Settings className="w-4 h-4" />,
          label: "In Production",
          bgColor: "bg-blue-50",
        };
      case "PRODUCTION_READY":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Clock className="w-4 h-4" />,
          label: "Ready",
          bgColor: "bg-yellow-50",
        };
      case "CONFIGURE":
        return {
          color: "bg-purple-100 text-purple-800 border-purple-200",
          icon: <Package className="w-4 h-4" />,
          label: "Configure",
          bgColor: "bg-purple-50",
        };
      case "BILLED":
        return {
          color: "bg-indigo-100 text-indigo-800 border-indigo-200",
          icon: <FileText className="w-4 h-4" />,
          label: "Billed",
          bgColor: "bg-indigo-50",
        };
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock className="w-4 h-4" />,
          label: status,
          bgColor: "bg-gray-50",
        };
    }
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
              onClick={toggleShowCompleted}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              {showCompleted ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Hide Completed</span>
                </>
              ) : (
                <>
                  <EyeIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Show All</span>
                </>
              )}
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
              
              {(searchQuery || statusFilter !== "hide_completed" || dateFilter !== "all") && (
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
                    <option value="hide_completed">Hide Completed & Billed</option>
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
                    <option value="fashion">Fashion Hub</option>
                    <option value="trendy">Trendy Tees</option>
                    <option value="elite">Elite Apparel</option>
                    <option value="sporty">Sporty Gear</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RESULTS SUMMARY */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-800">{filteredOrders?.length}</span> of{" "}
                <span className="font-semibold text-gray-800">{orders?.length}</span> orders
              </p>
              {statusFilter === "hide_completed" && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                  Completed orders hidden
                </span>
              )}
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

        {/* ORDERS GRID */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredOrders?.map(order => {
              const statusConfig = getStatusConfig(order.status);
              const processSummary = getProcessSummary(order);
              const progressPercentage = getCompletionProgress(order);
              const progressColor = progressPercentage < 30 ? 'from-red-500 to-red-600' : 
                                  progressPercentage < 70 ? 'from-yellow-500 to-yellow-600' : 
                                  'from-green-500 to-green-600';
              
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
                          {order.code}
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
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(order.createdAt.toString())}</span>
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
                        <span>Production Progress</span>
                        <span className="font-medium">{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`bg-linear-to-r ${progressColor} h-2 rounded-full transition-all duration-700`}
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
                            <span className="text-sm text-gray-700 truncate">{process.processName}</span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                              {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CARD FOOTER */}
                  <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {processSummary.configuredRuns}/{processSummary.totalRuns} runs configured
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/orders/${order.id}`);
                          }}
                          className="px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
        )}

        {/* EMPTY STATE */}
        {!loading && filteredOrders?.length === 0 && (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || statusFilter !== "hide_completed" || dateFilter !== "all"
                ? "No orders match your current filters. Try adjusting your search criteria."
                : "Get started by creating your first production order."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchQuery || statusFilter !== "hide_completed" || dateFilter !== "all") && (
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
          onCreate={() => {}}
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