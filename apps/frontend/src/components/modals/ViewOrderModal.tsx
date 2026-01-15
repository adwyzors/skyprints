"use client";
// apps/frontend/src/components/modals/ViewOrderModal.tsx

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Order } from "@/domain/model/order.model";
import { getOrderById } from "@/services/orders.service";
import {
    CheckCircle,
    ChevronRight,
    Circle,
    MapPin,
    Save,
    Settings,
} from "lucide-react";

/* =================================================
   PROPS
   ================================================= */

export interface ViewOrderModalProps {
  orderId: string;
  onClose: () => void;
}

/* =================================================
   CONSTANTS (STATIC DOMAIN DATA)
   ================================================= */

const PROCESS_MASTER_STATUSES = [
  "DESIGN",
  "SIZE_COLOR",
  "TRACING",
  "EXPOSING",
  "SAMPLE",
  "PRODUCTION",
  "FUSING",
  "CARTING",
  "COMPLETED",
] as const;

type ProcessStepStatus = (typeof PROCESS_MASTER_STATUSES)[number];

/* =================================================
   COMPONENT
   ================================================= */

export default function ViewOrderModal({ orderId, onClose }: ViewOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [locationInput, setLocationInput] = useState<Record<string, string>>({});
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const router = useRouter();
  const hasFetchedRef = useRef(false);

  /* =================================================
     FETCH ORDER (SAFE + ONCE)
     ================================================= */

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchOrder = async () => {
      setLoading(true);
      try {
        const fetched = await getOrderById(orderId);
        if (!fetched) return;

        setOrder(fetched);

        // Preselect first active run for execution views
        if (
          fetched.status === "PRODUCTION_READY" ||
          fetched.status === "IN_PRODUCTION"
        ) {
          let firstActiveRun: string | null = null;

          outer: for (const process of fetched.processes) {
            for (const run of process.runs) {
              if (
                run.configStatus === "CONFIGURED" ||
                (run.configStatus !== "COMPLETED" &&
                  run.configStatus !== "NOT_CONFIGURED")
              ) {
                firstActiveRun = run.id;
                break outer;
              }
            }
          }

          setActiveRunId(
            firstActiveRun ??
              fetched.processes[0]?.runs[0]?.id ??
              null
          );

          if (fetched.processes[0]) {
            setExpandedProcesses(new Set([fetched.processes[0].id]));
          }
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  /* =================================================
     DOMAIN HELPERS (PURE FUNCTIONS)
     ================================================= */

  const getStatusIndex = (status: string): number => {
    if (status === "CONFIGURED") return -1;
    return PROCESS_MASTER_STATUSES.indexOf(status as ProcessStepStatus);
  };

  const getStatusDisplayName = (status: string): string => {
    const map: Record<string, string> = {
      CONFIGURED: "Configured",
      DESIGN: "Design",
      SIZE_COLOR: "Size & Color",
      TRACING: "Tracing",
      EXPOSING: "Exposing",
      SAMPLE: "Sample",
      PRODUCTION: "Production",
      FUSING: "Fusing",
      CARTING: "Carting",
      COMPLETED: "Completed",
    };
    return map[status] ?? status;
  };

  const isStepCompleted = (runStatus: string, stepStatus: string): boolean => {
    if (runStatus === "CONFIGURED") return false;
    return getStatusIndex(stepStatus) < getStatusIndex(runStatus) ||
      runStatus === "COMPLETED";
  };

  const isCurrentStep = (runStatus: string, stepStatus: string): boolean => {
    if (runStatus === "CONFIGURED") return stepStatus === "DESIGN";
    return runStatus === stepStatus;
  };

  const isRunActive = (status: string) =>
    status !== "COMPLETED" &&
    status !== "NOT_CONFIGURED" &&
    status !== "CONFIGURED";

  const canOpenRun = (status: string) =>
    status !== "NOT_CONFIGURED";

  const toggleProcessExpansion = (processId: string) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      next.has(processId) ? next.delete(processId) : next.add(processId);
      return next;
    });
  };

  const handleRunClick = (_processId: string, runId: string, runStatus: string) => {
    if (!canOpenRun(runStatus)) return;
    setActiveRunId(prev => (prev === runId ? null : runId));
  };

  /* =================================================
     UI GUARDS
     ================================================= */

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex items-center justify-center">
          <div className="text-gray-600">Loading order details…</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex items-center justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /* =================================================
     UI (UNCHANGED)
     ================================================= */

  return (
    /* ⬇️ JSX CONTENT UNCHANGED ⬇️ */
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl">
        {/* LEFT — ORDER DETAILS */}
        <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {order.id}
            </h2>
            <div className="text-sm text-gray-600 space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span>Customer:</span>
                <strong className="text-gray-800">{order.customer?.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Code:</span>
                <span className="font-medium">{order.customer?.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{order.quantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.status === "COMPLETED" 
                    ? "bg-green-100 text-green-800"
                    : order.status === "IN_PRODUCTION"
                    ? "bg-blue-100 text-blue-800"
                    : order.status === "PRODUCTION_READY"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {order.status}
                </span>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-gray-700 mb-3">Processes</h3>
              <div className="space-y-2">
                {order.processes.map(process => (
                  <div key={process.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleProcessExpansion(process.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-800">{process.name}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${
                        expandedProcesses.has(process.id) ? "rotate-90" : ""
                      }`} />
                    </button>
                    
                    {expandedProcesses.has(process.id) && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-200">
                        <div className="space-y-2">
                          {process.runs.map((run) => {
                            const isEditing = editingLocation === `${process.id}-${run.id}`;
                            
                            return (
                              <div key={run.id} className="text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600">Run {run.runNumber}</span>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    run.configStatus === "COMPLETED"
                                      ? "bg-green-100 text-green-800"
                                      : run.configStatus === "CONFIGURED"
                                      ? "bg-gray-100 text-gray-800"
                                      : run.configStatus === "NOT_CONFIGURED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {run.configStatus === "COMPLETED" 
                                      ? "Completed" 
                                      : run.configStatus === "CONFIGURED"
                                      ? "Configured"
                                      : run.configStatus === "NOT_CONFIGURED"
                                      ? "Not Configured"
                                      : "Active"
                                    }
                                  </span>
                                </div>
                                
                                {/* Location Display/Edit */}
                                {isEditing ? (
                                  <div className="mt-2 flex gap-1">
                                    <input
                                      type="text"
                                      value={locationInput[`${process.id}-${run.id}`] || ""}
                                      onChange={(e) => setLocationInput(prev => ({
                                        ...prev,
                                        [`${process.id}-${run.id}`]: e.target.value
                                      }))}
                                      placeholder="Enter location..."
                                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      disabled={updating}
                                    />
                                    <button
                                    //  onClick={() => handleLocationUpdate(process.id, run.id)}
                                      disabled={updating}
                                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {updating ? "..." : <Save className="w-3 h-3" />}
                                    </button>
                                    <button
                                    //  onClick={cancelEditingLocation}
                                      disabled={updating}
                                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      {/*{run.locationId ? (
                                        <>
                                          <MapPin className="w-3 h-3" />
                                          <span>{run.locationId}</span>CreateOrderModal.
                                        </>
                                      ) : (*/}
                                        <span className="text-gray-400">No location set</span>
                                      {/*)}*/}
                                    </div>
                                    <button
                                    //  onClick={() => startEditingLocation(process.id, run.id, run.locationId)}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={updating}
            className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {/* RIGHT — EXECUTION */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* NOT READY */}
          {order.status === "CONFIGURE" && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center text-gray-500 mb-6">
                <div className="text-lg font-medium mb-2">Order Not Ready</div>
                <p>Set configurations for this order to begin production</p>
              </div>
              
              {/* CONFIGURE RUNS BUTTON */}
              <button
                onClick={() => router.push(`/admin/orders/${order.id}`)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Configure Runs</span>
              </button>
            </div>
          )}

          {/* EXECUTION MODE */}
          {(order.status === "PRODUCTION_READY" ||
            order.status === "IN_PRODUCTION" ||
            order.status === "COMPLETED") &&
            order.processes.map(process => (
              <div key={process.id} className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">{process.name}</h3>
                  <span className="text-sm text-gray-500">
                    {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {process.runs.map((run) => {
                  const isOpen = activeRunId === run.id;
                  const canOpen = canOpenRun(run.configStatus);
                  const isActive = isRunActive(run.configStatus);
                  const isEditingLocation = editingLocation === `${process.id}-${run.id}`;

                  return (
                    <div
                      key={run.id}
                      className={`border rounded-xl overflow-hidden mb-4 shadow-sm transition-shadow ${
                        !canOpen 
                          ? 'border-gray-200 bg-gray-50' 
                          : 'border-gray-300 hover:shadow-md'
                      }`}
                    >
                      {/* HEADER */}
                      <button
                        onClick={() => handleRunClick(process.id, run.id, run.configStatus)}
                        disabled={!canOpen || updating}
                        className={`w-full p-4 flex items-center justify-between transition-colors ${
                          isOpen 
                            ? "bg-blue-50" 
                            : !canOpen
                            ? "bg-gray-50 cursor-not-allowed"
                            : "bg-gray-50 hover:bg-gray-100"
                        } ${updating ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded ${
                            run.configStatus === "COMPLETED" 
                              ? "bg-green-500" 
                              : isActive
                              ? "bg-blue-500" 
                              : "bg-gray-400"
                          }`} />
                          <div className="text-left">
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                              Run {run.runNumber}
                            </div>
                            <div className="text-sm text-gray-600">
                              Progress: {getStatusDisplayName(run.configStatus)}
                            </div>
                            {/*{run.locationId && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <MapPin className="w-3 h-3" />
                                <span>{run.locationId}</span>
                              </div>
                            )}*/}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            run.configStatus === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : isActive
                              ? "bg-blue-100 text-blue-800"
                              : run.configStatus === "CONFIGURED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {run.configStatus === "COMPLETED" 
                              ? "Completed" 
                              : run.configStatus === "CONFIGURED"
                              ? "Ready"
                              : isActive
                              ? "Active"
                              : "Not Configured"
                            }
                          </span>
                          {canOpen && (
                            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`} />
                          )}
                        </div>
                      </button>

                      {/* BODY - PROCESS TIMELINE */}
                      {isOpen && canOpen && (
                        <div className="p-6">
                          {/* LOCATION INPUT */}
                          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-gray-600" />
                              <span className="font-medium text-gray-700">Update Location</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                //value={locationInput[`${process.id}-${run.id}`] || run.locationId || ""}
                                onChange={(e) => setLocationInput(prev => ({
                                  ...prev,
                                  [`${process.id}-${run.id}`]: e.target.value
                                }))}
                                placeholder="Enter location (e.g., Line 1, Machine A)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={updating}
                              />
                              <button
                                //onClick={() => handleLocationUpdate(process.id, run.id)}
                                disabled={updating}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                {updating ? "Updating..." : "Update"}
                              </button>
                            </div>
                            {/*{run.locationId && !isEditingLocation && (
                              <div className="mt-2 text-sm text-gray-600">
                                Current: {run.locationId}
                              </div>
                            )}*/}
                          </div>

                          {/* VERTICAL TIMELINE */}
                          <div className="relative pl-8 space-y-6">
                            {/* VERTICAL LINE */}
                            <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-gray-300" />
                            
                            {PROCESS_MASTER_STATUSES.map((status) => {
                              const completed = isStepCompleted(run.configStatus, status);
                              const current = isCurrentStep(run.configStatus, status);
                            //  const nextButtonVisible = shouldShowNextButton(run, status);

                              return (
                                <div key={status} className="relative flex items-start gap-4">
                                  {/* TIMELINE DOT */}
                                  <div className={`absolute -left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    completed
                                      ? "bg-green-500 border-green-500"
                                      : current
                                      ? "bg-white border-blue-500"
                                      : "bg-white border-gray-300"
                                  }`}>
                                    {completed ? (
                                      <CheckCircle className="w-3 h-3 text-white" />
                                    ) : current ? (
                                      <Circle className="w-2 h-2 text-blue-500" />
                                    ) : null}
                                  </div>

                                  {/* CONTENT */}
                                  <div className={`flex-1 rounded-lg border ${
                                    current
                                      ? "border-blue-200 bg-blue-50"
                                      : completed
                                      ? "border-green-200 bg-green-50"
                                      : "border-gray-200 bg-white"
                                  }`}>
                                    <div className="p-4">
                                      <div className="flex items-start justify-between mb-1">
                                        <div>
                                          <span className={`font-medium block ${
                                            current ? "text-blue-700" : completed ? "text-green-700" : "text-gray-700"
                                          }`}>
                                            {getStatusDisplayName(status)}
                                          </span>
                                          <span className="text-xs text-gray-500 mt-1 block">
                                            Not started
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {current && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                              Current Step
                                            </span>
                                          )}
                                          {completed && (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* NEXT BUTTON - BELOW THE STATUS CONTENT */}
                                      {
                                    //  nextButtonVisible && 
                                      (
                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                          <button
                                            //onClick={() => advanceRunStatus(process.id, run.id)}
                                            disabled={updating}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                          >
                                            <span>
                                              {updating ? "Updating..." : 
                                                run.configStatus === "CONFIGURED" 
                                                  ? "Start Production - Move to Design" 
                                                  : "Completed. Move to Next Step"
                                              }
                                            </span>
                                            {!updating && <ChevronRight className="w-4 h-4" />}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* RUN COMPLETION STATUS */}
                          {run.configStatus === "COMPLETED" && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center justify-center gap-2 text-green-800">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">This run has been completed</span>
                              </div>
                              {/*{run.locationId && (
                                <div className="text-center text-green-700 text-sm mt-2">
                                  Location: {run.locationId}
                                </div>
                              )}*/}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}