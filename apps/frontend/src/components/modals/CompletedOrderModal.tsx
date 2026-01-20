"use client";
//apps\frontend\src\components\modals\CompletedOrderModal.tsx
import { BillingSnapshot } from "@/domain/model/billing.model";
import { Order } from "@/domain/model/order.model";
import { getLatestBillingSnapshot } from "@/services/billing.service";
import { getOrderById } from "@/services/orders.service";
import { Calculator, CheckCircle, DollarSign, ExternalLink, FileText, Loader2, Package, Printer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  orderId: string;
  onClose: () => void;
}

export default function CompletedOrderModal({ orderId, onClose }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "runs" | "invoice">("summary");
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch order and billing snapshot when modal opens
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedOrder, snapshot] = await Promise.all([
          getOrderById(orderId),
          getLatestBillingSnapshot(orderId),
        ]);
        setOrder(fetchedOrder);
        setBillingSnapshot(snapshot);
      } catch (err) {
        console.error("Error fetching order data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  // Get values from run with billing snapshot data if available
  const getRunValues = (run: Order['processes'][0]['runs'][0]) => {
    // First, get from order's run values
    const quantity = (run.values?.['Quantity'] as number) || 0;
    const estimatedRate = (run.values?.['Estimated Rate'] as number) || 0;
    const estimatedAmount = quantity * estimatedRate;

    // Check billing snapshot for revised rates
    let newRate = estimatedRate;
    let newAmount = estimatedAmount;

    if (billingSnapshot?.inputs) {
      const snapshotInput = billingSnapshot.inputs.find(input => input.runId === run.id);
      if (snapshotInput?.values) {
        // Billing API uses snake_case keys
        newRate = snapshotInput.values['new_rate'] ?? snapshotInput.values['New Rate'] ?? estimatedRate;
        const snapshotQuantity = snapshotInput.values['quantity'] ?? quantity;
        newAmount = snapshotQuantity * newRate;

        console.log('Using billing snapshot - newRate:', newRate, 'qty:', snapshotQuantity, 'newAmount:', newAmount);
      }
    } else {
      // Fallback to order's run values if no snapshot
      newRate = (run.values?.['New Rate'] as number) || estimatedRate;
      newAmount = (run.values?.['New Amount'] as number) || (quantity * newRate);
    }

    return { quantity, estimatedRate, newRate, newAmount, estimatedAmount };
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!order) return { billedTotal: 0, estimatedTotal: 0 };

    let billedTotal = 0;
    let estimatedTotal = 0;

    order.processes.forEach(process => {
      process.runs.forEach(run => {
        const { newAmount, estimatedAmount } = getRunValues(run);
        billedTotal += newAmount;
        estimatedTotal += estimatedAmount;
      });
    });

    return { billedTotal, estimatedTotal };
  };

  const { billedTotal, estimatedTotal } = calculateTotals();
  const difference = billedTotal - estimatedTotal;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // Print function
  const handlePrint = () => {
    if (!printRef.current || !order) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order.id.slice(0, 8).toUpperCase()}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .invoice-header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
            .invoice-header h1 { font-size: 32px; color: #1e3a8a; margin-bottom: 8px; }
            .invoice-header p { color: #666; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .info-section h3 { font-size: 14px; color: #666; margin-bottom: 12px; text-transform: uppercase; }
            .info-section p { margin: 4px 0; }
            .info-section .value { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
            td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { max-width: 300px; margin-left: auto; }
            .totals div { display: flex; justify-content: space-between; padding: 8px 0; }
            .totals .total-row { border-top: 2px solid #333; font-size: 18px; font-weight: bold; padding-top: 12px; margin-top: 8px; }
            .footer { margin-top: 60px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            @media print {
              body { padding: 20px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

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
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  router.push(`/admin/orders/${order.id}`);
                }}
                className="group flex items-center gap-2 text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
                title="View order details"
              >
                {order.code || order.id.slice(0, 8).toUpperCase()}
                <ExternalLink className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                Billed
              </span>
              {billingSnapshot && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Revised Rates
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              Click order code to view full details
              {billingSnapshot && ` • Billing v${billingSnapshot.version}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* TABS */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6 px-6">
            <button
              onClick={() => setActiveTab("summary")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "summary"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Summary
              </div>
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "runs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Runs Details
              </div>
            </button>
            <button
              onClick={() => setActiveTab("invoice")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "invoice"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Invoice
              </div>
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "summary" && (
            <div className="space-y-6">
              {/* ORDER INFO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Order Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{order.customer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer Code:</span>
                      <span className="font-medium">{order.customer?.code}</span>
                    </div>
                    {order.jobCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Job Code:</span>
                        <span className="font-medium text-blue-700">{order.jobCode}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Quantity:</span>
                      <span className="font-medium">{order.quantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created Date:</span>
                      <span className="font-medium">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Billing Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Processes:</span>
                      <span className="font-medium">{order.processes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Runs:</span>
                      <span className="font-medium">
                        {order.processes.reduce((sum, p) => sum + p.runs.length, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AMOUNT SUMMARY */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Amount Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-600">Estimated Total</div>
                      <div className="text-2xl font-bold text-gray-700">₹{estimatedTotal.toLocaleString()}</div>
                    </div>
                    <div className="text-3xl text-gray-400">→</div>
                    <div>
                      <div className="text-sm text-gray-600">Final Billed Amount</div>
                      <div className="text-3xl font-bold text-green-700">₹{billedTotal.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Difference:</span>
                      <span className={`text-xl font-bold ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {difference > 0 ? '+' : ''}₹{difference.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROCESSES SUMMARY */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-4">Processes Summary</h3>
                <div className="space-y-4">
                  {order.processes.map(process => (
                    <div key={process.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">{process.name}</h4>
                        <span className="text-sm text-gray-600">{process.runs.length} runs</span>
                      </div>
                      <div className="space-y-3">
                        {process.runs.map(run => {
                          const { newAmount, estimatedRate, newRate } = getRunValues(run);
                          const rateDiff = newRate - estimatedRate;

                          return (
                            <div key={run.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-700">Run {run.runNumber} - {run.displayName}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-600">₹{newAmount.toLocaleString()}</span>
                                {rateDiff !== 0 && (
                                  <span className={`text-xs ${rateDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {rateDiff > 0 ? '+' : ''}₹{rateDiff}/unit
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "runs" && (
            <div className="space-y-6">
              {order.processes.map(process => (
                <div key={process.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">{process.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{process.runs.length} runs</p>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {process.runs.map(run => {
                      const { quantity, estimatedRate, newRate, newAmount, estimatedAmount } = getRunValues(run);
                      const rateDiff = newRate - estimatedRate;
                      const amountDiff = newAmount - estimatedAmount;

                      return (
                        <div key={run.id} className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-medium text-gray-800">Run {run.runNumber} - {run.displayName}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                <span>Quantity: {quantity} units</span>
                                <span>•</span>
                                <span>Status: {run.lifecycleStatus}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-gray-600">Billed Amount</div>
                              <div className="text-xl font-bold text-green-700">₹{newAmount.toLocaleString()}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Rate Comparison</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Estimated Rate:</span>
                                  <span>₹{estimatedRate}/unit</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Billing Rate:</span>
                                  <span className="font-bold text-blue-700">₹{newRate}/unit</span>
                                </div>
                                {rateDiff !== 0 && (
                                  <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="text-gray-700">Difference:</span>
                                    <span className={`font-bold ${rateDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {rateDiff > 0 ? '+' : ''}₹{rateDiff}/unit
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Total Comparison</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Estimated Total:</span>
                                  <span>₹{estimatedAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Billing Total:</span>
                                  <span className="font-bold text-green-700">₹{newAmount.toLocaleString()}</span>
                                </div>
                                {amountDiff !== 0 && (
                                  <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="text-gray-700">Net Difference:</span>
                                    <span className={`font-bold ${amountDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {amountDiff > 0 ? '+' : ''}₹{amountDiff.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* RUN VALUES */}
                          {Object.keys(run.values || {}).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="text-sm font-medium text-gray-700 mb-2">Run Details</div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(run.values || {})
                                  .filter(([key]) => !['New Rate', 'New Amount'].includes(key))
                                  .map(([key, value]) => (
                                    <div key={key} className="bg-white border border-gray-200 rounded p-3">
                                      <div className="text-xs text-gray-500">{key}</div>
                                      <div className="font-medium text-gray-800 mt-1">{String(value) || '-'}</div>
                                    </div>
                                  ))}
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
          )}

          {activeTab === "invoice" && (
            <div className="space-y-6">
              {/* Printable Invoice Content */}
              <div ref={printRef} className="bg-white border-2 border-gray-300 rounded-xl p-8">
                <div className="invoice-header text-center mb-8 border-b-2 border-blue-800 pb-5">
                  <h1 className="text-3xl font-bold text-blue-800 mb-2">INVOICE</h1>
                  <p className="text-gray-600">Order: {order.id.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="info-grid grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="info-section">
                    <h3 className="font-semibold text-gray-800 mb-3">Bill To:</h3>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">{order.customer?.name}</p>
                      <p className="text-gray-600">Code: {order.customer?.code}</p>
                    </div>
                  </div>

                  <div className="info-section text-right">
                    <h3 className="font-semibold text-gray-800 mb-3">Invoice Details:</h3>
                    <div className="space-y-2">
                      <p className="text-gray-600">Invoice Date: {formatDate(new Date())}</p>
                      <p className="text-gray-600">Order Date: {formatDate(order.createdAt)}</p>
                      <p className="text-gray-600">Status: <span className="font-bold text-green-600">BILLED</span></p>
                    </div>
                  </div>
                </div>

                {/* INVOICE TABLE */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
                  <div className="bg-gray-50 grid grid-cols-5 p-4 font-semibold text-gray-700">
                    <div>Description</div>
                    <div className="text-center">Quantity</div>
                    <div className="text-center">Est. Rate</div>
                    <div className="text-center">Billing Rate</div>
                    <div className="text-right">Amount</div>
                  </div>

                  {order.processes.flatMap(process =>
                    process.runs.map(run => {
                      const { quantity, estimatedRate, newRate, newAmount } = getRunValues(run);

                      return (
                        <div key={run.id} className="grid grid-cols-5 p-4 border-t border-gray-200">
                          <div>
                            <div className="font-medium">{process.name} - Run {run.runNumber}</div>
                            <div className="text-sm text-gray-500">{run.displayName}</div>
                          </div>
                          <div className="text-center">{quantity}</div>
                          <div className="text-center">₹{estimatedRate}</div>
                          <div className="text-center font-bold text-blue-700">₹{newRate}</div>
                          <div className="text-right font-bold">₹{newAmount.toLocaleString()}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* TOTALS */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="max-w-md ml-auto space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Total:</span>
                      <span>₹{estimatedTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Adjustment:</span>
                      <span className={difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {difference >= 0 ? '+' : ''}₹{difference.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-200">
                      <span>Total Billed:</span>
                      <span>₹{billedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="footer mt-12 text-center text-gray-500 text-sm border-t border-gray-200 pt-5">
                  <p>Thank you for your business!</p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}