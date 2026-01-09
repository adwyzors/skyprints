"use client";
//apps\frontend\src\components\modals\CompletedOrderModal.tsx
import { useState } from "react";
import { X, FileText, DollarSign, Calculator, Package, MapPin, CheckCircle, Printer, Download } from "lucide-react";
import { Order } from "@/types/domain";

interface Props {
  order: Order;
  onClose: () => void;
}

export default function CompletedOrderModal({ order, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "runs" | "invoice">("summary");

  const getBillingDate = () => {
    return order.billedAt ? new Date(order.billedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : "Not specified";
  };

  const getTotalAmount = () => {
    return order.billingTotal || order.processes.reduce((sum, process) =>
      sum + process.runs.reduce((rSum, run) => {
        const quantity = run.fields.quantity || 0;
        const billingRate = run.fields.billingRate || run.fields.rate || 0;
        return rSum + (quantity * billingRate);
      }, 0), 0);
  };

  const getOriginalTotal = () => {
    return order.originalTotal || order.processes.reduce((sum, process) =>
      sum + process.runs.reduce((rSum, run) => {
        const quantity = run.fields.quantity || 0;
        const rate = run.fields.rate || 0;
        return rSum + (quantity * rate);
      }, 0), 0);
  };

  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const downloadInvoice = () => {
    // Simple invoice generation
    const invoiceContent = `
      INVOICE
      Order: ${order.orderCode}
      Customer: ${order.customerName} (${order.customerCode})
      Billing Date: ${getBillingDate()}
      
      Total Amount: ₹${getTotalAmount().toLocaleString()}
      Original Estimate: ₹${getOriginalTotal().toLocaleString()}
      Difference: ₹${(getTotalAmount() - getOriginalTotal()).toLocaleString()}
      
      Thank you for your business!
    `;
    
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${order.orderCode}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{order.orderCode} - Billed Order</h2>
            <p className="text-gray-600">View complete order details and billing information</p>
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
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "summary"
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
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "runs"
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
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "invoice"
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
                      <span className="font-medium">{order.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer Code:</span>
                      <span className="font-medium">{order.customerCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Quantity:</span>
                      <span className="font-medium">{order.quantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created Date:</span>
                      <span className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
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
                      <span className="text-gray-600">Billing Date:</span>
                      <span className="font-medium">{getBillingDate()}</span>
                    </div>
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
              <div className="bg-linear-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Amount Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-600">Original Estimate</div>
                      <div className="text-2xl font-bold text-gray-700">₹{getOriginalTotal().toLocaleString()}</div>
                    </div>
                    <div className="text-3xl text-gray-400">→</div>
                    <div>
                      <div className="text-sm text-gray-600">Final Billed Amount</div>
                      <div className="text-3xl font-bold text-green-700">₹{getTotalAmount().toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Difference:</span>
                      <span className={`text-xl font-bold ${getTotalAmount() > getOriginalTotal() ? 'text-green-600' : getTotalAmount() < getOriginalTotal() ? 'text-red-600' : 'text-gray-600'}`}>
                        {getTotalAmount() > getOriginalTotal() ? '+' : ''}₹{(getTotalAmount() - getOriginalTotal()).toLocaleString()}
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
                          const quantity = run.fields.quantity || 0;
                          const originalRate = run.fields.rate || 0;
                          const billingRate = run.fields.billingRate || originalRate;
                          const originalTotal = quantity * originalRate;
                          const billingTotal = quantity * billingRate;
                          
                          return (
                            <div key={run.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-700">Run {run.runNumber}</span>
                                {run.location && (
                                  <span className="flex items-center gap-1 text-gray-500">
                                    <MapPin className="w-3 h-3" />
                                    {run.location}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-600">₹{billingTotal.toLocaleString()}</span>
                                {billingRate !== originalRate && (
                                  <span className={`text-xs ${billingRate > originalRate ? 'text-green-600' : 'text-red-600'}`}>
                                    {billingRate > originalRate ? '+' : ''}₹{billingRate - originalRate}/unit
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
                    <p className="text-sm text-gray-600 mt-1">{process.runs.length} runs • {process.quantity} units</p>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {process.runs.map(run => {
                      const quantity = run.fields.quantity || 0;
                      const originalRate = run.fields.rate || 0;
                      const billingRate = run.fields.billingRate !== undefined ? run.fields.billingRate : originalRate;
                      const originalTotal = quantity * originalRate;
                      const billingTotal = quantity * billingRate;
                      const rateDifference = billingRate - originalRate;
                      const totalDifference = billingTotal - originalTotal;
                      
                      return (
                        <div key={run.id} className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-medium text-gray-800">Run {run.runNumber}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                {run.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {run.location}
                                  </span>
                                )}
                                <span>Quantity: {quantity} units</span>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-gray-600">Billed Amount</div>
                              <div className="text-xl font-bold text-green-700">₹{billingTotal.toLocaleString()}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Rate Comparison</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Production Rate:</span>
                                  <span>₹{originalRate}/unit</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Billing Rate:</span>
                                  <span className="font-bold text-blue-700">₹{billingRate}/unit</span>
                                </div>
                                {rateDifference !== 0 && (
                                  <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="text-gray-700">Difference:</span>
                                    <span className={`font-bold ${rateDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {rateDifference > 0 ? '+' : ''}₹{rateDifference}/unit
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Total Comparison</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Production Total:</span>
                                  <span>₹{originalTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Billing Total:</span>
                                  <span className="font-bold text-green-700">₹{billingTotal.toLocaleString()}</span>
                                </div>
                                {totalDifference !== 0 && (
                                  <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="text-gray-700">Net Difference:</span>
                                    <span className={`font-bold ${totalDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {totalDifference > 0 ? '+' : ''}₹{totalDifference.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* RUN DETAILS */}
                          {Object.keys(run.fields).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="text-sm font-medium text-gray-700 mb-2">Run Details</div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(run.fields).filter(([key]) => 
                                  !['rate', 'billingRate', 'totalAmount', 'billingTotal', 'rateDifference', 'totalDifference', 'billingNotes'].includes(key)
                                ).map(([key, value]) => (
                                  <div key={key} className="bg-white border border-gray-200 rounded p-3">
                                    <div className="text-xs text-gray-500">{formatFieldName(key)}</div>
                                    <div className="font-medium text-gray-800 mt-1">{String(value) || '-'}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* BILLING NOTES */}
                          {run.fields.billingNotes && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="text-sm font-medium text-gray-700 mb-2">Billing Notes</div>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700">
                                {run.fields.billingNotes}
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
              <div className="bg-white border-2 border-gray-300 rounded-xl p-8">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h1>
                  <p className="text-gray-600">Order: {order.orderCode}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Bill To:</h3>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">{order.customerName}</p>
                      <p className="text-gray-600">{order.customerCode}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <h3 className="font-semibold text-gray-800 mb-3">Invoice Details:</h3>
                    <div className="space-y-2">
                      <p className="text-gray-600">Invoice Date: {getBillingDate()}</p>
                      <p className="text-gray-600">Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-gray-600">Status: <span className="font-bold text-green-600">PAID</span></p>
                    </div>
                  </div>
                </div>
                
                {/* INVOICE TABLE */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
                  <div className="bg-gray-50 grid grid-cols-5 p-4 font-semibold text-gray-700">
                    <div>Description</div>
                    <div className="text-center">Quantity</div>
                    <div className="text-center">Rate</div>
                    <div className="text-center">Billing Rate</div>
                    <div className="text-right">Amount</div>
                  </div>
                  
                  {order.processes.flatMap(process => 
                    process.runs.map(run => {
                      const quantity = run.fields.quantity || 0;
                      const originalRate = run.fields.rate || 0;
                      const billingRate = run.fields.billingRate !== undefined ? run.fields.billingRate : originalRate;
                      const amount = quantity * billingRate;
                      
                      return (
                        <div key={run.id} className="grid grid-cols-5 p-4 border-t border-gray-200">
                          <div>
                            <div className="font-medium">{process.name} - Run {run.runNumber}</div>
                            {run.location && (
                              <div className="text-sm text-gray-500">{run.location}</div>
                            )}
                          </div>
                          <div className="text-center">{quantity}</div>
                          <div className="text-center">₹{originalRate}</div>
                          <div className="text-center font-bold text-blue-700">₹{billingRate}</div>
                          <div className="text-right font-bold">₹{amount.toLocaleString()}</div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* TOTALS */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="max-w-md ml-auto space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>₹{getTotalAmount().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax (18%):</span>
                      <span>₹{(getTotalAmount() * 0.18).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-200">
                      <span>Total:</span>
                      <span>₹{(getTotalAmount() * 1.18).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={downloadInvoice}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Invoice
                </button>
                <button className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  <Printer className="w-4 h-4" />
                  Print
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