"use client";
//apps\frontend\src\app\admin\billing\page.tsx
import { useState } from "react";
import { Search, Filter, Calendar, X, DollarSign, CheckCircle, FileText, ChevronRight } from "lucide-react";
import { Order } from "@/types/domain";
import { getCompletedOrders } from "@/services/orders.service";
import BillingModal from "@/components/modals/BillingModal";
import CompletedOrderModal from "@/components/modals/CompletedOrderModal";

export default function BillingPage() {
  const [orders] = useState<Order[]>(getCompletedOrders());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      searchQuery === "" ||
      order.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = dateFilter === "all" || true;
    
    return matchesSearch && matchesDate;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTotalAmount = (order: Order) => {
    return order.processes.reduce((sum, process) =>
      sum + process.runs.reduce((rSum, run) => {
        const quantity = run.fields.quantity || 0;
        const billingRate = run.fields.billingRate || run.fields.rate || 0;
        return rSum + (quantity * billingRate);
      }, 0), 0);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER SECTION */}
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

        {/* SEARCH AND FILTERS BAR */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* SEARCH INPUT */}
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
              
              {(searchQuery || dateFilter !== "all") && (
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
                <div className="md:col-span-2">
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
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span> completed orders
            </p>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Calendar className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* ORDERS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map(order => {
            const totalAmount = getTotalAmount(order);
            const originalAmount = order.processes.reduce((sum, process) =>
              sum + process.runs.reduce((rSum, run) => {
                const quantity = run.fields.quantity || 0;
                const rate = run.fields.rate || 0;
                return rSum + (quantity * rate);
              }, 0), 0);
            const hasBillingRate = order.processes.some(p => 
              p.runs.some(r => r.fields.billingRate !== undefined)
            );
            
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                {/* CARD HEADER */}
                <div className="p-5 bg-linear-to-r from-green-50 to-emerald-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">
                        {order.orderCode}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-700">{order.customerName}</span>
                        <span className="text-xs px-2 py-1 bg-white/70 text-gray-700 rounded-full">
                          {order.customerCode}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        Ready for Billing
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-5 space-y-4">
                  {/* AMOUNT SUMMARY */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Estimated Amount:</span>
                      <span className="text-lg font-bold text-green-700">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    {hasBillingRate && originalAmount !== totalAmount && (
                      <div className="text-xs text-gray-500">
                        Original: ₹{originalAmount.toLocaleString()} • Adjusted: +₹{(totalAmount - originalAmount).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* ORDER INFO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Quantity</div>
                      <p className="font-bold text-gray-800">{order.quantity}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Processes</div>
                      <p className="font-bold text-gray-800">{order.processes.length}</p>
                    </div>
                  </div>

                  {/* RUNS SUMMARY */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Production Summary:</div>
                    <div className="space-y-2">
                      {order.processes.map(process => (
                        <div key={process.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{process.name}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewOrder(order)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Bill Now
                    </button>
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
              <CheckCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders ready for billing</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || dateFilter !== "all"
                ? "No completed orders match your current filters. Try adjusting your search criteria."
                : "All orders have been billed. Check back when more orders are completed."}
            </p>
            {searchQuery || dateFilter !== "all" && (
              <button
                onClick={clearFilters}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* MODALS */}
        {selectedOrder && (
          <BillingModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}

        {viewOrder && (
          <CompletedOrderModal
            order={viewOrder}
            onClose={() => setViewOrder(null)}
          />
        )}
      </div>
    </div>
  );
}