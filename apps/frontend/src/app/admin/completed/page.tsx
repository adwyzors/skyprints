"use client";
//apps\frontend\src\app\admin\completed\page.tsx
import { useState } from "react";
import { Search, Filter, Calendar, X, FileText, Eye, Download, DollarSign, CheckCircle, ChevronRight } from "lucide-react";
import { Order } from "@/types/domain";
import { getOrders } from "@/services/orders.service";
import CompletedOrderModal from "@/components/modals/CompletedOrderModal";

export default function CompletedPage() {
  const [orders] = useState<Order[]>(getOrders().filter(o => o.status === "BILLED"));
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      searchQuery === "" ||
      order.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCustomer = 
      customerFilter === "all" || 
      order.customerCode.toLowerCase() === customerFilter.toLowerCase();
    
    const matchesDate = dateFilter === "all" || true;
    
    return matchesSearch && matchesCustomer && matchesDate;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getBillingDate = (order: Order) => {
    return order.billedAt ? formatDate(order.billedAt) : "Not billed";
  };

  const getTotalAmount = (order: Order) => {
    return order.billingTotal || order.processes.reduce((sum, process) =>
      sum + process.runs.reduce((rSum, run) => {
        const quantity = run.fields.quantity || 0;
        const billingRate = run.fields.billingRate || run.fields.rate || 0;
        return rSum + (quantity * billingRate);
      }, 0), 0);
  };

  const getOriginalTotal = (order: Order) => {
    return order.originalTotal || order.processes.reduce((sum, process) =>
      sum + process.runs.reduce((rSum, run) => {
        const quantity = run.fields.quantity || 0;
        const rate = run.fields.rate || 0;
        return rSum + (quantity * rate);
      }, 0), 0);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setCustomerFilter("all");
  };

  const exportToCSV = () => {
    // Simple CSV export implementation
    const csvContent = [
      ["Order Code", "Customer", "Quantity", "Original Amount", "Billed Amount", "Billing Date", "Difference"],
      ...filteredOrders.map(order => [
        order.orderCode,
        order.customerName,
        order.quantity,
        getOriginalTotal(order),
        getTotalAmount(order),
        getBillingDate(order),
        getTotalAmount(order) - getOriginalTotal(order)
      ])
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `completed-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Completed Orders</h1>
            <p className="text-gray-600 mt-1">View all billed and completed orders</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <div className="px-4 py-2.5 bg-indigo-100 text-indigo-800 rounded-xl text-sm font-medium">
              {filteredOrders.length} billed orders
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
              
              {(searchQuery || dateFilter !== "all" || customerFilter !== "all") && (
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
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Customers</option>
                    <option value="SKY">Sky Prints</option>
                    <option value="URB">Urban Wear</option>
                    <option value="FASH">Fashion Hub</option>
                    <option value="TRND">Trendy Tees</option>
                    <option value="ELIT">Elite Apparel</option>
                    <option value="SPRT">Sporty Gear</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>Most Recent</option>
                    <option>Highest Amount</option>
                    <option>Customer Name</option>
                    <option>Order Code</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RESULTS SUMMARY */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-800">{filteredOrders.length}</span> billed orders
              </p>
              {filteredOrders.length > 0 && (
                <span className="text-sm text-gray-600">
                  Total billed: <span className="font-bold text-green-700">
                    ₹{filteredOrders.reduce((sum, order) => sum + getTotalAmount(order), 0).toLocaleString()}
                  </span>
                </span>
              )}
            </div>
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
            const originalAmount = getOriginalTotal(order);
            const difference = totalAmount - originalAmount;
            const billingDate = getBillingDate(order);
            
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                {/* CARD HEADER */}
                <div className="p-5 bg-linear-to-r from-indigo-50 to-purple-50">
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
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        Billed
                      </span>
                      <span className="text-xs text-gray-500">{billingDate}</span>
                    </div>
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-5 space-y-4">
                  {/* AMOUNT SUMMARY */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Billed Amount:</span>
                      <span className="text-xl font-bold text-green-700">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    {difference !== 0 && (
                      <div className={`text-sm ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {difference > 0 ? '➕' : '➖'} ₹{Math.abs(difference).toLocaleString()} from estimate
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
                      <div className="text-xs text-gray-500">Runs</div>
                      <p className="font-bold text-gray-800">
                        {order.processes.reduce((sum, p) => sum + p.runs.length, 0)}
                      </p>
                    </div>
                  </div>

                  {/* RUNS SUMMARY */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Processes:</div>
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
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="flex items-center justify-center px-4 py-2.5 text-gray-400 hover:text-gray-600">
                      <ChevronRight className="w-4 h-4" />
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
              <FileText className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No billed orders found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || dateFilter !== "all" || customerFilter !== "all"
                ? "No orders match your current filters. Try adjusting your search criteria."
                : "All orders are currently in production or awaiting billing."}
            </p>
            {(searchQuery || dateFilter !== "all" || customerFilter !== "all") && (
              <button
                onClick={clearFilters}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* VIEW MODAL */}
        {selectedOrder && (
          <CompletedOrderModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </div>
    </div>
  );
}