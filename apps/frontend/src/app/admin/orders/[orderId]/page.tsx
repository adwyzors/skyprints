"use client";
//apps\frontend\src\app\admin\orders\[orderId]\page.tsx
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, ChevronRight, ArrowLeft, Save, X, AlertCircle } from "lucide-react";

import {
  getOrderById,
  updateOrder,
} from "@/services/orders.service";

import {
  isOrderCompleted,
} from "@/utils/orderStatus";

import processesData from "@/data/processes.json";
import { Order, ProcessRun } from "@/types/domain";

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

  const initialOrder = getOrderById(orderId);
  const [order, setOrder] = useState<Order | undefined>(
    initialOrder
  );

  const [openRunId, setOpenRunId] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState<string | null>(null);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Order not found</h2>
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

  const processMaster = processesData.processes[0];

  /* ================= HELPERS ================= */

  const areAllFieldsFilled = (run: ProcessRun) =>
    Object.values(run.fields).every(
      v => v !== null && v !== ""
    );

  const areAllRunsConfigured = (order: Order) =>
    order.processes.every(p =>
      p.runs.every(r => r.status === "CONFIGURED")
    );

  const prettyLabel = (field: string) =>
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, s => s.toUpperCase());

  const getRunProgress = (run: ProcessRun) => {
    const totalFields = Object.keys(run.fields).length;
    const filledFields = Object.values(run.fields).filter(v => v !== null && v !== "").length;
    return Math.round((filledFields / totalFields) * 100);
  };

  /* ================= SAVE RUN ================= */

  const saveRun = async (processId: string, runId: string) => {
    const process = order.processes.find(
      p => p.id === processId
    );
    const run = process?.runs.find(r => r.id === runId);

    if (!run) return;

    // ❌ BLOCK SAVE IF NOT FULLY CONFIGURED
    if (!areAllFieldsFilled(run)) {
      alert("Please fill all fields before saving this run.");
      return;
    }

    setIsSaving(runId);

    try {
      const updated: Order = {
        ...order,
        processes: order.processes.map(p =>
          p.id !== processId
            ? p
            : {
                ...p,
                runs: p.runs.map(r =>
                  r.id !== runId
                    ? r
                    : {
                        ...r,
                        status: "CONFIGURED",
                      }
                ),
              }
        ),
      };

      // ✅ ORDER STATUS DERIVATION (CONFIG SCREEN ONLY)
      if (isOrderCompleted(updated)) {
        updated.status = "COMPLETED";
      } else if (areAllRunsConfigured(updated)) {
        updated.status = "PRODUCTION_READY";
      } else {
        updated.status = "CONFIGURE";
      }

      setOrder(updated);
      updateOrder(updated);
      setOpenRunId(null);
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
                    {order.customerName} ({order.customerCode})
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
                order.status === "PRODUCTION_READY" 
                  ? "bg-green-100 text-green-800"
                  : order.status === "CONFIGURE"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                {order.status.replace("_", " ")}
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
                const isConfigured = run.status === "CONFIGURED";
                
                return (
                  <div key={run.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-700">
                          {process.name} • Run {run.runNumber}
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
                      className={`w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        openRunId === run.id
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {openRunId === run.id ? 'Close' : 'Configure'}
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
            {process.runs.map(run => (
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
                        {process.name} • Run {run.runNumber}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          run.status === "CONFIGURED"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {run.status === "CONFIGURED" ? "Configured" : "Not Configured"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getRunProgress(run)}% complete
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {run.status === "CONFIGURED" && (
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
                        Job Card Configuration
                      </h4>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                        {chunk(Object.entries(processMaster.fields), 2).map((pair, rowIndex) => (
                          <div
                            key={rowIndex}
                            className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-200"
                          >
                            {pair.map(([field, type]) => {
                              const isColors = field === "colors";
                              const isTextarea = field === "design" || field === "area";
                              const isNumber = type === "number";
                              const highlight = field === "quantity" || field === "rate" || field === "totalAmount";

                              return (
                                <>
                                  <div className={`px-4 py-4 text-sm font-medium ${
                                    highlight ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      {prettyLabel(field)}
                                      {highlight && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                      )}
                                    </div>
                                  </div>

                                  <div className={`px-4 py-3 ${
                                    highlight ? 'bg-green-50' : 'bg-white'
                                  }`}>
                                    {isColors ? (
                                      <select
                                        value={run.fields[field] ?? ""}
                                        onChange={e =>
                                          updateRunField(
                                            process.id,
                                            run.id,
                                            field,
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      >
                                        <option value="">Select colors...</option>
                                        {Array.from({ length: 8 }).map((_, i) => (
                                          <option key={i + 1} value={i + 1}>
                                            {i + 1} color{i !== 0 ? 's' : ''}
                                          </option>
                                        ))}
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
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
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
                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                          highlight ? 'font-semibold' : ''
                                        }`}
                                        placeholder={`Enter ${prettyLabel(field).toLowerCase()}...`}
                                      />
                                    )}
                                  </div>
                                </>
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
                            <span>Please fill all fields before saving</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setOpenRunId(null)}
                          className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
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
            ))}
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
                  {order.processes.flatMap(p => p.runs).filter(r => r.status === "CONFIGURED").length}
                  <span className="text-sm font-normal text-gray-400"> / {order.processes.flatMap(p => p.runs).length}</span>
                </p>
              </div>
              
              {areAllRunsConfigured(order) && (
                <button
                  onClick={() => {
                    // Navigate to execution view or trigger production start
                    router.push(`/admin/orders/view/${order.id}`);
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