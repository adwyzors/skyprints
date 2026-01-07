"use client";

import { useState } from "react";
import { ChevronDown, Calculator, DollarSign, Package, MapPin } from "lucide-react";
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

  const updateRunRate = (
    processId: string,
    runId: string,
    rate: number
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
                const totalAmount = rate * quantity;
                
                return { 
                  ...r, 
                  fields: {
                    ...r.fields,
                    rate: rate,
                    totalAmount: totalAmount
                  }
                };
              }),
            }
      ),
    }));
  };

  // Calculate total amount from all runs
  const totalAmount = localOrder.processes.reduce(
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
    updateOrder(localOrder);
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
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex overflow-hidden shadow-2xl">

        {/* LEFT — ORDER SUMMARY */}
        <div className="w-1/3 border-r border-gray-200 bg-linear-to-b from-gray-50 to-white p-6 flex flex-col">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {localOrder.orderCode}
            </h2>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Customer:</span>
                <strong className="text-gray-800">{localOrder.customerName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Customer Code:</span>
                <span className="font-medium">{localOrder.customerCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Order Quantity:</span>
                <span className="font-medium">{localOrder.quantity} units</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  localOrder.status === "COMPLETED" 
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {localOrder.status.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* RUNS SUMMARY */}
            <div className="mt-8">
              <h3 className="font-semibold text-gray-700 mb-3">Process Summary</h3>
              <div className="space-y-3">
                {localOrder.processes.map(process => (
                  <div key={process.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="font-medium text-gray-800 mb-1">{process.name}</div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{process.runs.length} run{process.runs.length !== 1 ? 's' : ''}</span>
                      <span className="font-medium">
                        ₹{process.runs.reduce((sum, r) => {
                          const quantity = r.fields.quantity || 0;
                          const rate = r.fields.rate || 0;
                          return sum + (quantity * rate);
                        }, 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TOTAL AMOUNT CARD */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-linear-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Total Amount</span>
                </div>
                <span className="text-sm text-gray-500">Inclusive of all taxes</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">₹{totalAmount.toLocaleString()}</div>
              <div className="text-sm text-gray-600 mt-2">
                Based on {localOrder.processes.reduce((sum, p) => sum + p.runs.length, 0)} runs across {localOrder.processes.length} processes
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — RUN BILLING DETAILS */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Billing Details</h2>
              <p className="text-gray-600">Enter rates for each run to calculate billing</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                {localOrder.processes.reduce((sum, p) => sum + p.runs.length, 0)} runs
              </div>
            </div>
          </div>

          {/* PROCESSES LIST */}
          <div className="space-y-6">
            {localOrder.processes.map(process => (
              <div key={process.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* PROCESS HEADER */}
                <div className="bg-linear-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-800">{process.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                        <span>{process.runs.length} run{process.runs.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Order quantity: {process.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Process Total</div>
                      <div className="text-lg font-bold text-blue-700">
                        ₹{process.runs.reduce((sum, r) => {
                          const quantity = r.fields.quantity || 0;
                          const rate = r.fields.rate || 0;
                          return sum + (quantity * rate);
                        }, 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RUNS LIST */}
                <div className="divide-y divide-gray-100">
                  {process.runs.map(run => {
                    const isExpanded = expandedRuns.has(run.id);
                    const quantity = run.fields.quantity || 0;
                    const rate = run.fields.rate || 0;
                    const total = quantity * rate;
                    
                    return (
                      <div key={run.id} className="bg-white">
                        {/* RUN HEADER */}
                        <div 
                          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleRunExpansion(run.id)}
                        >
                          <div className="flex items-center gap-4">
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <div>
                              <div className="font-medium text-gray-800">Run {run.runNumber}</div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                {run.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{run.location}</span>
                                  </div>
                                )}
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                  Status: {run.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            {/* RUN TOTAL */}
                            <div className="text-right">
                              <div className="text-sm text-gray-600">Run Total</div>
                              <div className={`text-lg font-bold ${total > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                                ₹{total.toLocaleString()}
                              </div>
                            </div>
                            
                            {/* RATE INPUT */}
                            <div className="w-40">
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Enter rate"
                                  value={rate || ""}
                                  onChange={e => {
                                    const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                    updateRunRate(process.id, run.id, value);
                                  }}
                                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Rate per unit
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED DETAILS */}
                        {isExpanded && (
                          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {/* QUANTITY CALCULATION */}
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calculator className="w-4 h-4 text-blue-600" />
                                  <span className="font-medium text-gray-700">Calculation</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Quantity:</span>
                                    <span className="font-medium">{quantity} units</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Rate:</span>
                                    <span className="font-medium">₹{rate}/unit</span>
                                  </div>
                                  <div className="pt-2 border-t border-gray-200">
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Total:</span>
                                      <span className="font-bold text-green-700">₹{total}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* RUN DETAILS */}
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Package className="w-4 h-4 text-gray-600" />
                                  <span className="font-medium text-gray-700">Run Details</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  {Object.entries(run.fields).filter(([key]) => 
                                    key === 'printType' || key === 'colors' || key === 'fabricColor' || key === 'design'
                                  ).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-gray-600">{formatFieldName(key)}:</span>
                                      <span className="font-medium">{String(value) || '-'}</span>
                                    </div>
                                  ))}
                                  {run.location && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Location:</span>
                                      <span className="font-medium">{run.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* BILLING NOTES */}
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                  <span className="font-medium text-gray-700">Billing Notes</span>
                                </div>
                                <textarea
                                  placeholder="Add notes for this run..."
                                  className="w-full h-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                  value={run.fields.billingNotes || ''}
                                  onChange={e => {
                                    setLocalOrder(prev => ({
                                      ...prev,
                                      processes: prev.processes.map(p =>
                                        p.id !== process.id
                                          ? p
                                          : {
                                              ...p,
                                              runs: p.runs.map(r =>
                                                r.id !== run.id
                                                  ? r
                                                  : {
                                                      ...r,
                                                      fields: {
                                                        ...r.fields,
                                                        billingNotes: e.target.value
                                                      }
                                                    }
                                              ),
                                            }
                                      ),
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
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
                <p>All rates will be saved and can be modified until finalizing billing.</p>
                <p className="mt-1">Once finalized, the order status will change to "BILLED".</p>
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
                  className={`px-6 py-3 font-medium rounded-xl transition-colors flex items-center gap-2 ${
                    totalAmount > 0
                      ? 'bg-linear-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-sm hover:shadow'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  Finalize Billing (₹{totalAmount.toLocaleString()})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}