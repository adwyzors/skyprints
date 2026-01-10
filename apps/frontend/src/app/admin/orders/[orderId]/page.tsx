"use client";
//apps\frontend\src\app\admin\orders\[orderId]\page.tsx
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { CheckCircle, ChevronRight, ArrowLeft, Save, X, AlertCircle, Loader2 } from "lucide-react";

import {
  getOrderById,
  configureRun,
  getProcesses
} from "@/services/orders.service";

import {
  isOrderCompleted,
} from "@/utils/orderStatus";

import { Order, ProcessRun, Process } from "@/types/domain";
import React from "react";

/* ================= UTIL ================= */

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

export default function OrderConfigPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [fieldConfigs, setFieldConfigs] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    const fetchOrderData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (!orderId) {
          throw new Error("Order ID is missing");
        }

        // Fetch order data from API
        const orderData = await getOrderById(orderId);
        
        if (!orderData) {
          throw new Error("Order not found");
        }

        setOrder(orderData);

        // Extract field configurations from run templates in the order data
        const fieldConfigsMap: {[key: string]: any[]} = {};
        
        orderData.processes.forEach(process => {
          process.runs.forEach(run => {
            // The field configurations are in run.runTemplate.fields from API
            if (run.runTemplate?.fields) {
              fieldConfigsMap[run.id] = run.runTemplate.fields;
            }
          });
        });
        
        setFieldConfigs(fieldConfigsMap);

        // Fetch processes for field templates (optional, for fallback)
        const processesData = await getProcesses();
        setProcesses(processesData);

      } catch (err) {
        console.error("Error fetching order:", err);
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  // Get field configurations for a specific run
  const getRunFieldConfigs = (runId: string) => {
    return fieldConfigs[runId] || [];
  };

  // Get process template fields from field configs
  const getProcessTemplateFields = (runId: string) => {
    const fieldConfigs = getRunFieldConfigs(runId);
    
    if (fieldConfigs.length === 0) {
      return {};
    }
    
    // Convert fields array to object: { fieldName: fieldType }
    const fields: Record<string, string> = {};
    fieldConfigs.forEach((field: any) => {
      fields[field.key] = field.type || "string";
    });
    
    return fields;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order configuration...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {error || "Order not found"}
          </h2>
          <button
            onClick={() => router.push("/admin/orders")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  /* ================= HELPERS ================= */

  const areAllFieldsFilled = (run: ProcessRun) => {
    const fieldConfigs = getRunFieldConfigs(run.id);
    
    // Get required fields
    const requiredFields = fieldConfigs
      .filter((field: any) => field.required === true)
      .map((field: any) => field.key);
    
    // Check if all required fields are filled
    return requiredFields.every(field => {
      const value = run.fields[field];
      return value !== null && value !== undefined && value !== "";
    });
  };

  const areAllRunsConfigured = (order: Order) =>
    order.processes.every(p =>
      p.runs.every(r => r.statusCode === "CONFIGURED" || r.statusCode === "CONFIGURE")
    );

  const prettyLabel = (field: string) =>
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, s => s.toUpperCase())
      .replace(/_/g, " ");

  const getRunProgress = (run: ProcessRun) => {
    const fieldConfigs = getRunFieldConfigs(run.id);
    
    if (fieldConfigs.length === 0) return 0;
    
    const filledFields = fieldConfigs.filter((fieldConfig: any) => {
      const value = run.fields[fieldConfig.key];
      return value !== null && value !== undefined && value !== "";
    }).length;
    
    return Math.round((filledFields / fieldConfigs.length) * 100);
  };

  /* ================= SAVE RUN ================= */

  const saveRun = async (processId: string, runId: string) => {
    if (!order) return;

    const process = order.processes.find(p => p.id === processId);
    const run = process?.runs.find(r => r.id === runId);

    if (!process || !run) return;

    // Check if all required fields are filled
    if (!areAllFieldsFilled(run)) {
      alert("Please fill all required fields before saving this run.");
      return;
    }

    setIsSaving(runId);
    setError(null);

    try {
      // Call API to configure the run
      const updatedOrder = await configureRun(order.id, processId, runId, run.fields);
      
      if (updatedOrder) {
        setOrder(updatedOrder);
        setOpenRunId(null);
        
        // Show success message
        alert(`Run ${run.runNumber} configured successfully!`);
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (err) {
      console.error("Error configuring run:", err);
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(null);
    }
  };

  /* ================= UPDATE FIELD ================= */

  const updateRunField = (
    processId: string,
    runId: string,
    field: string,
    value: string | number
  ) => {
    setOrder(prev =>
      !prev
        ? prev
        : {
            ...prev,
            processes: prev.processes.map(p =>
              p.id !== processId
                ? p
                : {
                    ...p,
                    runs: p.runs.map(r =>
                      r.id !== runId
                        ? r
                        : {
                            ...r,
                            fields: {
                              ...r.fields,
                              [field]: value,
                            },
                          }
                    ),
                  }
            ),
          }
    );
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        {/* HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => router.push("/admin/orders")}
                  className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Orders</span>
                </button>
                <div className="h-6 w-px bg-gray-300 hidden md:block" />
                <h1 className="text-2xl font-bold text-gray-800">
                  {order.orderCode}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-sm text-gray-600">
                    {order.customer?.name || `Customer ${order.customerId}`} ({order.customer?.code || order.customerId})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-600">
                    Quantity: {order.quantity}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                order.statusCode === "PRODUCTION_READY" 
                  ? "bg-green-100 text-green-800"
                  : order.statusCode === "CONFIGURE"
                  ? "bg-yellow-100 text-yellow-800"
                  : order.statusCode === "IN_PRODUCTION"
                  ? "bg-blue-100 text-blue-800"
                  : order.statusCode === "COMPLETED"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {order.statusCode?.replace("_", " ") || "Unknown"}
              </div>
              <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {order.processes.length} Process{order.processes.length !== 1 ? 'es' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS OVERVIEW */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {order.processes.flatMap(process => 
              process.runs.map(run => {
                const progress = getRunProgress(run);
                const isConfigured = run.statusCode === "CONFIGURED" || run.statusCode === "CONFIGURE";
                const hasFieldConfigs = getRunFieldConfigs(run.id).length > 0;
                
                return (
                  <div key={run.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-700">
                          {process.process?.name || process.name} • Run {run.runNumber}
                        </span>
                      </div>
                      {isConfigured && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Completion</span>
                        <span className={`font-medium ${isConfigured ? 'text-green-600' : 'text-blue-600'}`}>
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${isConfigured ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}
                      disabled={run.statusCode === "COMPLETED" || run.statusCode === "IN_PRODUCTION" || !hasFieldConfigs}
                      className={`w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        openRunId === run.id
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : run.statusCode === "COMPLETED" || run.statusCode === "IN_PRODUCTION" || !hasFieldConfigs
                          ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {openRunId === run.id ? 'Close' : 
                       run.statusCode === "COMPLETED" ? 'Completed' : 
                       run.statusCode === "IN_PRODUCTION" ? 'In Progress' : 
                       !hasFieldConfigs ? 'No Config' : 'Configure'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CONFIGURATION FORMS */}
        {order.processes.map(process => (
          <div key={process.id} className="space-y-4">
            {process.runs.map(run => {
              if (run.statusCode === "COMPLETED" || run.statusCode === "IN_PRODUCTION") return null;
              
              const fieldConfigs = getRunFieldConfigs(run.id);
              if (fieldConfigs.length === 0) return null;
              
              return (
                <div key={run.id} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 ${
                  openRunId === run.id ? 'border-blue-300' : 'border-gray-200'
                }`}>
                  {/* RUN HEADER */}
                  <div
                    onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-2xl"
                  >
                    <div className="flex items-center gap-4">
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                        openRunId === run.id ? 'rotate-90' : ''
                      }`} />
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">
                          {process.process?.name || process.name} • Run {run.runNumber}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            run.statusCode === "CONFIGURED" || run.statusCode === "CONFIGURE"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {run.statusCode === "CONFIGURED" || run.statusCode === "CONFIGURE" ? "Configured" : "Not Configured"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getRunProgress(run)}% complete
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {(run.statusCode === "CONFIGURED" || run.statusCode === "CONFIGURE") && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Ready</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CONFIGURATION FORM */}
                  {openRunId === run.id && (
                    <div className="p-6 border-t border-gray-200">
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                          Run Configuration
                        </h4>
                        
                        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                          {chunk(fieldConfigs, 2).map((pair, rowIndex) => (
                            <div
                              key={rowIndex}
                              className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-200"
                            >
                              {pair.map((fieldConfig: any) => {
                                const field = fieldConfig.key;
                                const type = fieldConfig.type || "string";
                                const isRequired = fieldConfig.required === true;
                                const isTextarea = field.toLowerCase().includes("description") || 
                                                  field.toLowerCase().includes("notes") || 
                                                  field.toLowerCase().includes("comments");
                                const isNumber = type === "number" || 
                                                field.toLowerCase().includes("quantity") || 
                                                field.toLowerCase().includes("amount") ||
                                                field.toLowerCase().includes("copies") ||
                                                field.toLowerCase().includes("count");
                                const isSelect = field.toLowerCase().includes("color") || 
                                                field.toLowerCase().includes("size") || 
                                                field.toLowerCase().includes("type") ||
                                                field.toLowerCase().includes("paper");

                                return (
                                  <React.Fragment key={field}>
                                    <div className={`px-4 py-4 text-sm font-medium ${
                                      isRequired ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        {prettyLabel(field)}
                                        {isRequired && (
                                          <span className="text-xs text-red-600">*</span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                          ({type})
                                        </span>
                                      </div>
                                    </div>

                                    <div className={`px-4 py-3 ${isRequired ? 'bg-red-50' : 'bg-white'}`}>
                                      {isSelect ? (
                                        <select
                                          value={run.fields[field] ?? ""}
                                          onChange={e =>
                                            updateRunField(
                                              process.id,
                                              run.id,
                                              field,
                                              e.target.value
                                            )
                                          }
                                          className={`w-full border ${isRequired && !run.fields[field] ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                                        >
                                          <option value="">Select {prettyLabel(field).toLowerCase()}...</option>
                                          {/* Add options based on field type */}
                                          {field.toLowerCase().includes("paper") && (
                                            <>
                                              <option value="A4">A4</option>
                                              <option value="A3">A3</option>
                                              <option value="LETTER">Letter</option>
                                              <option value="LEGAL">Legal</option>
                                            </>
                                          )}
                                          {field.toLowerCase().includes("color") && (
                                            <>
                                              <option value="RED">Red</option>
                                              <option value="BLUE">Blue</option>
                                              <option value="GREEN">Green</option>
                                              <option value="BLACK">Black</option>
                                              <option value="WHITE">White</option>
                                              <option value="MULTICOLOR">Multi-color</option>
                                            </>
                                          )}
                                          {field.toLowerCase().includes("size") && (
                                            <>
                                              <option value="S">Small (S)</option>
                                              <option value="M">Medium (M)</option>
                                              <option value="L">Large (L)</option>
                                              <option value="XL">Extra Large (XL)</option>
                                            </>
                                          )}
                                        </select>
                                      ) : isTextarea ? (
                                        <textarea
                                          value={run.fields[field] ?? ""}
                                          onChange={e =>
                                            updateRunField(
                                              process.id,
                                              run.id,
                                              field,
                                              e.target.value
                                            )
                                          }
                                          className={`w-full border ${isRequired && !run.fields[field] ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none`}
                                          placeholder={`Enter ${prettyLabel(field).toLowerCase()}...`}
                                        />
                                      ) : (
                                        <input
                                          type={isNumber ? "number" : "text"}
                                          value={run.fields[field] ?? ""}
                                          onChange={e =>
                                            updateRunField(
                                              process.id,
                                              run.id,
                                              field,
                                              isNumber
                                                ? Number(e.target.value)
                                                : e.target.value
                                            )
                                          }
                                          className={`w-full border ${isRequired && !run.fields[field] ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                                          placeholder={`Enter ${prettyLabel(field).toLowerCase()}...`}
                                          min={isNumber ? "0" : undefined}
                                          step={isNumber ? "1" : undefined}
                                        />
                                      )}
                                      {isRequired && !run.fields[field] && (
                                        <p className="text-xs text-red-600 mt-1">
                                          This field is required
                                        </p>
                                      )}
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          {!areAllFieldsFilled(run) && (
                            <div className="flex items-center gap-2 text-yellow-600">
                              <AlertCircle className="w-4 h-4" />
                              <span>Please fill all required fields before saving</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setOpenRunId(null)}
                            disabled={isSaving === run.id}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            onClick={() => saveRun(process.id, run.id)}
                            disabled={!areAllFieldsFilled(run) || isSaving === run.id}
                            className={`px-5 py-2.5 font-medium rounded-lg transition-colors flex items-center gap-2 ${
                              areAllFieldsFilled(run)
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isSaving === run.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Configuration
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* FOOTER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Order Configuration Summary</p>
              <p className="mt-1">
                Configure all runs to move this order to <span className="font-semibold text-green-600">PRODUCTION_READY</span> status
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Configured Runs</p>
                <p className="text-2xl font-bold text-gray-800">
                  {order.processes.flatMap(p => p.runs).filter(r => 
                    r.statusCode === "CONFIGURED" || r.statusCode === "CONFIGURE"
                  ).length}
                  <span className="text-sm font-normal text-gray-400"> / {order.processes.flatMap(p => p.runs).length}</span>
                </p>
              </div>
              
              {areAllRunsConfigured(order) && order.statusCode === "CONFIGURE" && (
                <button
                  onClick={() => {
                    // Navigate back to orders list with selected order
                    router.push(`/admin/orders?selectedOrder=${order.id}`);
                  }}
                  className="px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow"
                >
                  Start Production
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}