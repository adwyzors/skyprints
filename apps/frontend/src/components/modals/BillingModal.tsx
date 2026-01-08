"use client";
//apps\frontend\src\components\modals\BillingModal.tsx
import { useState } from "react";
import { ChevronDown, Calculator, DollarSign, Package, MapPin, X, FileText } from "lucide-react";
import { Order } from "@/types/domain";
import { updateOrder, markOrderBilled } from "@/services/orders.service";

interface Props {
  order: Order;
  onClose: () => void;
}

export default function BillingModal({ order, onClose }: Props) {
  const [localOrder, setLocalOrder] = useState<Order>(order);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const toggleRunExpansion = (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const updateRunBillingRate = (
    processId: string,
    runId: string,
    billingRate: number
  ) => {
    setLocalOrder(prev => ({
      ...prev,
      processes: prev.processes.map(p =>
        p.id !== processId
          ? p
          : {
              ...p,
              runs: p.runs.map(r => {
                if (r.id !== runId) return r;
                
                const quantity = r.fields.quantity || 0;
                const billingTotal = billingRate * quantity;
                const originalRate = r.fields.rate || 0;
                const originalTotal = originalRate * quantity;
                
                return { 
                  ...r, 
                  fields: {
                    ...r.fields,
                    billingRate: billingRate,
                    billingTotal: billingTotal,
                    rateDifference: billingRate - originalRate,
                    totalDifference: billingTotal - originalTotal
                  }
                };
              }),
            }
      ),
    }));
  };

  // Calculate total amount using billingRate if available, otherwise use rate
  const totalAmount = localOrder.processes.reduce(
    (sum, p) =>
      sum +
      p.runs.reduce((rSum, r) => {
        const quantity = r.fields.quantity || 0;
        const rate = r.fields.billingRate !== undefined ? r.fields.billingRate : r.fields.rate || 0;
        return rSum + (quantity * rate);
      }, 0),
    0
  );

  const originalTotal = localOrder.processes.reduce(
    (sum, p) =>
      sum +
      p.runs.reduce((rSum, r) => {
        const quantity = r.fields.quantity || 0;
        const rate = r.fields.rate || 0;
        return rSum + (quantity * rate);
      }, 0),
    0
  );

  const finalizeBilling = () => {
    const billedOrder = {
      ...localOrder,
      status: "BILLED",
      billedAt: new Date().toISOString(),
      billingTotal: totalAmount,
      originalTotal: originalTotal
    };
    
    updateOrder(billedOrder);
    markOrderBilled(localOrder.id);
    onClose();
  };

  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl flex overflow-hidden shadow-2xl">
        {/* LEFT — ORDER SUMMARY */}
        <div className="w-1/3 border-r border-gray-200 bg-linear-to-b from-gray-50 to-white p-6 flex flex-col">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {localOrder.orderCode}
                </h2>
                <p className="text-gray-600">Billing Generation</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* ORDER INFO */}
            <div className="space-y-4 mb-8">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="font-medium text-gray-700">Customer Information</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{localOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Code:</span>
                    <span className="font-medium">{localOrder.customerCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Quantity:</span>
                    <span className="font-medium">{localOrder.quantity} units</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AMOUNT SUMMARY */}
            <div className="bg-linear-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-6 h-6 text-blue-600" />
                <span className="font-medium text-gray-800">Amount Summary</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Original Estimate:</span>
                  <span className="font-medium">₹{originalTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Billing Adjustments:</span>
                  <span className={`font-medium ${totalAmount > originalTotal ? 'text-green-600' : totalAmount < originalTotal ? 'text-red-600' : 'text-gray-600'}`}>
                    ₹{(totalAmount - originalTotal).toLocaleString()}
                  </span>
                </div>
                <div className="pt-3 border-t border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-800">Final Amount:</span>
                    <span className="text-2xl font-bold text-gray-800">₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — BILLING DETAILS */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Billing Details</h2>
              <p className="text-gray-600">Enter billing rates for each run (separate from production rates)</p>
            </div>
          </div>

          {/* PROCESSES LIST */}
          <div className="space-y-6">
            {localOrder.processes.map(process => (
              <div key={process.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* PROCESS HEADER */}
                <div className="bg-linear-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{process.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span>{process.runs.length} run{process.runs.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>Order quantity: {process.quantity}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RUNS LIST */}
                <div className="divide-y divide-gray-100">
                  {process.runs.map(run => {
                    const isExpanded = expandedRuns.has(run.id);
                    const quantity = run.fields.quantity || 0;
                    const originalRate = run.fields.rate || 0;
                    const originalTotal = quantity * originalRate;
                    const billingRate = run.fields.billingRate !== undefined ? run.fields.billingRate : originalRate;
                    const billingTotal = quantity * billingRate;
                    const rateDifference = billingRate - originalRate;
                    const totalDifference = billingTotal - originalTotal;
                    
                    return (
                      <div key={run.id} className="bg-white">
                        {/* RUN HEADER */}
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => toggleRunExpansion(run.id)}
                            >
                              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="font-bold text-gray-700">{run.runNumber}</span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-800">Run {run.runNumber}</div>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <MapPin className="w-3 h-3" />
                                    <span>{run.location || "No location"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              {/* BILLING TOTAL */}
                              <div className="text-right">
                                <div className="text-sm text-gray-600">Billing Total</div>
                                <div className={`text-lg font-bold ${billingTotal > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                                  ₹{billingTotal.toLocaleString()}
                                </div>
                                {rateDifference !== 0 && (
                                  <div className={`text-xs ${rateDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {rateDifference > 0 ? '+' : ''}{rateDifference}/unit
                                  </div>
                                )}
                              </div>
                              
                              {/* BILLING RATE INPUT */}
                              <div className="w-48">
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Billing rate"
                                    value={billingRate || ""}
                                    onChange={e => {
                                      const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      updateRunBillingRate(process.id, run.id, value);
                                    }}
                                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                                  <span>Billing rate</span>
                                  {originalRate > 0 && (
                                    <span className="text-gray-400">
                                      Original: ₹{originalRate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* EXPANDED DETAILS */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* CALCULATION COMPARISON */}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Calculator className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium text-gray-700">Rate Comparison</span>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Original Rate:</span>
                                      <span className="font-medium">₹{originalRate}/unit</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Billing Rate:</span>
                                      <span className="font-bold text-blue-700">₹{billingRate}/unit</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-700">Difference:</span>
                                        <span className={`font-bold ${rateDifference > 0 ? 'text-green-600' : rateDifference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                          {rateDifference > 0 ? '+' : ''}₹{rateDifference}/unit
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* TOTAL COMPARISON */}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-green-600" />
                                    <span className="font-medium text-gray-700">Total Comparison</span>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Original Total:</span>
                                      <span className="font-medium">₹{originalTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Billing Total:</span>
                                      <span className="font-bold text-green-700">₹{billingTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200">
                                      <div className="flex justify-between">
                                        <span className="font-bold text-gray-800">Net Difference:</span>
                                        <span className={`text-lg font-bold ${totalDifference > 0 ? 'text-green-600' : totalDifference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                          {totalDifference > 0 ? '+' : ''}₹{totalDifference.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ACTION BUTTONS */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>Billing rates are stored separately and won't affect production rates</span>
                </div>
                <p>Once finalized, the order status will change to "BILLED" and moved to completed orders.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={finalizeBilling}
                  disabled={totalAmount <= 0}
                  className={`px-8 py-3 font-medium rounded-xl transition-all flex items-center gap-3 ${
                    totalAmount > 0
                      ? 'bg-linear-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-bold">Finalize Billing</div>
                    <div className="text-xs opacity-90">₹{totalAmount.toLocaleString()}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}