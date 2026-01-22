"use client";
//apps\frontend\src\components\modals\BillingModal.tsx
import { Order } from "@/domain/model/order.model";
import { apiRequest } from "@/services/api.service";
import { getOrderById } from "@/services/orders.service";
import { Calculator, ChevronDown, Clock, DollarSign, FileText, Loader2, Package, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  orderId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// Track billing rates for each run
interface BillingRates {
  [runId: string]: number;
}

export default function BillingModal({ orderId, onClose, onSuccess }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingRates, setBillingRates] = useState<BillingRates>({});
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch order details when modal opens
  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const fetchedOrder = await getOrderById(orderId);
        setOrder(fetchedOrder);
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const toggleRunExpansion = (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const updateRunBillingRate = (runId: string, rate: number) => {
    setBillingRates(prev => ({
      ...prev,
      [runId]: rate
    }));
  };

  const getBillingRate = (runId: string, originalRate: number): number => {
    return billingRates[runId] !== undefined ? billingRates[runId] : originalRate;
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!order) return { totalAmount: 0, originalTotal: 0 };

    let totalAmount = 0;
    let originalTotal = 0;

    order.processes.forEach(process => {
      process.runs.forEach(run => {
        const quantity = (run.values?.['Quantity'] as number) || 0;
        const estimatedRate = (run.values?.['Estimated Rate'] as number) || 0;
        const billingRate = getBillingRate(run.id, estimatedRate);

        originalTotal += quantity * estimatedRate;
        totalAmount += quantity * billingRate;
      });
    });

    return { totalAmount, originalTotal };
  };

  const { totalAmount, originalTotal } = calculateTotals();

  // Build the API payload
  const buildPayload = (): { orderId: string; inputs: Record<string, { new_rate: number }> } => {
    const inputs: Record<string, { new_rate: number }> = {};

    if (!order) return { orderId: '', inputs };

    order.processes.forEach(process => {
      process.runs.forEach(run => {
        const estimatedRate = (run.values?.['Estimated Rate'] as number) || 0;
        const billingRate = getBillingRate(run.id, estimatedRate);
        inputs[run.id] = { new_rate: billingRate };
      });
    });

    return { orderId: order.id, inputs };
  };

  const finalizeBilling = async () => {
    if (!order) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = buildPayload();
      const response = await apiRequest<{ success: boolean }>(`/billing/finalize/order`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.success) {
        onSuccess?.();
        onClose();
      } else {
        setError("Failed to finalize billing. Please try again.");
      }
    } catch (err) {
      console.error("Billing error:", err);
      setError(err instanceof Error ? err.message : "Failed to finalize billing");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if process is Screen Printing New
  const isScreenPrintingNew = (processName: string) => processName === "Screen Printing";

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading order details...</span>
        </div>
      </div>
    );
  }

  // Error state or no order
  if (!order) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="text-red-500 mb-4">Failed to load order</div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl flex overflow-hidden shadow-2xl">
        {/* LEFT — ORDER SUMMARY */}
        <div className="w-1/3 border-r border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {order.code}
                </h2>
                <p className="text-gray-600">Billing Generation</p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
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
                    <span className="font-medium">{order.customer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Code:</span>
                    <span className="font-medium">{order.customer?.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Quantity:</span>
                    <span className="font-medium">{order.quantity} units</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AMOUNT SUMMARY */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
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

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="pt-4 border-t border-gray-200 mt-4">
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* RIGHT — BILLING DETAILS */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Billing Details</h2>
              <p className="text-gray-600">Enter billing rates for each run (separate from production rates)</p>
            </div>
          </div>

          {/* PROCESSES LIST */}
          <div className="space-y-6 flex-1">
            {order.processes.map(process => (
              <div key={process.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* PROCESS HEADER */}
                <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{process.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span>{process.runs.length} run{process.runs.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONDITIONAL RENDERING BASED ON PROCESS TYPE */}
                {isScreenPrintingNew(process.name) ? (
                  // SCREEN PRINTING NEW - Show billing rates input
                  <div className="divide-y divide-gray-100">
                    {process.runs.map(run => {
                      const isExpanded = expandedRuns.has(run.id);
                      const quantity = (run.values?.['Quantity'] as number) || 0;
                      const estimatedRate = (run.values?.['Estimated Rate'] as number) || 0;
                      const billingRate = getBillingRate(run.id, estimatedRate);
                      const originalRunTotal = quantity * estimatedRate;
                      const billingTotal = quantity * billingRate;
                      const rateDifference = billingRate - estimatedRate;
                      const totalDifference = billingTotal - originalRunTotal;

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
                                  <div className="font-medium text-gray-800">Run {run.runNumber} - {run.displayName}</div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span>Qty: {quantity}</span>
                                    <span>•</span>
                                    <span>Status: {run.lifecycleStatus}</span>
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
                                      value={billingRates[run.id] !== undefined ? billingRates[run.id] : estimatedRate || ""}
                                      onChange={e => {
                                        const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        updateRunBillingRate(run.id, value);
                                      }}
                                      disabled={submitting}
                                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                                    <span>Billing rate</span>
                                    {estimatedRate > 0 && (
                                      <span className="text-gray-400">
                                        Estimated: ₹{estimatedRate}
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
                                        <span className="text-gray-600">Estimated Rate:</span>
                                        <span className="font-medium">₹{estimatedRate}/unit</span>
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
                                        <span className="font-medium">₹{originalRunTotal.toLocaleString()}</span>
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

                                {/* Run Details */}
                                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                  <div className="font-medium text-gray-700 mb-2">Run Values</div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                    {Object.entries(run.values || {})
                                      .filter(([key]) => !['New Rate', 'New Amount'].includes(key))
                                      .map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                          <span className="text-gray-500 capitalize">{key.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ')}:</span>
                                          <span className="font-medium">{String(value)}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // OTHER PROCESSES - Coming Soon
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Coming Soon</h4>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                      Billing configuration for {process.name} is not yet available.
                      This feature will be added in a future update.
                    </p>
                  </div>
                )}
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
                  disabled={submitting}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={finalizeBilling}
                  disabled={submitting}
                  className={`px-8 py-3 font-medium rounded-xl transition-all flex items-center gap-3 ${!submitting
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-bold">Finalize Billing</div>
                        <div className="text-xs opacity-90">₹{totalAmount.toLocaleString()}</div>
                      </div>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}