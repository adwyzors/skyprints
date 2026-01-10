"use client";
//apps\frontend\src\components\modals\ViewOrderModal.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Order, ProcessRun } from "@/types/domain";
import {
  getOrderById,
  updateRunStatus,
  updateRunLocation,
  canStartRun,
  configureRun,
} from "@/services/orders.service";
import { Process } from "@/types/domain";
import { CheckCircle, ChevronRight, Circle, MapPin, Save, Settings } from "lucide-react";

/* =================================================
   PROPS
   ================================================= */

export interface ViewOrderModalProps {
  orderId: string;
  onClose: () => void;
}

// Define process master statuses locally since we're not using JSON file
const PROCESS_MASTER_STATUSES = [
  "DESIGN",
  "SIZE_COLOR", 
  "TRACING",
  "EXPOSING",
  "SAMPLE",
  "PRODUCTION",
  "FUSING",
  "CARTING",
  "COMPLETED"
];

/* =================================================
   COMPONENT
   ================================================= */

export default function ViewOrderModal({
  orderId,
  onClose,
}: ViewOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [locationInput, setLocationInput] = useState<{[key: string]: string}>({});
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  /* =================================================
     INIT
     ================================================= */

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const fetched = await getOrderById(orderId);
        if (!fetched) {
          console.error("Order not found");
          return;
        }

        setOrder(fetched);

        // Auto-open first run if order is ready for execution
        if (
          fetched.statusCode === "PRODUCTION_READY" ||
          fetched.statusCode === "IN_PRODUCTION"
        ) {
          // Find first configured but not completed run
          let firstActiveRunId: string | null = null;
          outer: for (const p of fetched.processes) {
            for (const r of p.runs) {
              if (r.statusCode === "CONFIGURED" || (r.statusCode !== "COMPLETED" && r.statusCode !== "NOT_CONFIGURED")) {
                firstActiveRunId = r.id;
                break outer;
              }
            }
          }
          setActiveRunId(firstActiveRunId ?? fetched.processes[0]?.runs[0]?.id ?? null);
          
          // Expand first process by default
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
     HELPERS
     ================================================= */

  const getNextStatus = (run: ProcessRun) => {
    if (run.statusCode === "CONFIGURED") {
      return "DESIGN"; // First step after configuration
    }
    
    const idx = PROCESS_MASTER_STATUSES.indexOf(run.statusCode);
    return idx < PROCESS_MASTER_STATUSES.length - 1 ? PROCESS_MASTER_STATUSES[idx + 1] : null;
  };

  const getStatusIndex = (status: string): number => {
    if (status === "CONFIGURED") return -1;
    return PROCESS_MASTER_STATUSES.indexOf(status);
  };

  const getStatusDisplayName = (status: string): string => {
    const statusMap: Record<string, string> = {
      "CONFIGURED": "Configured",
      "DESIGN": "Design",
      "SIZE_COLOR": "Size & Color",
      "TRACING": "Tracing",
      "EXPOSING": "Exposing",
      "SAMPLE": "Sample",
      "PRODUCTION": "Production",
      "FUSING": "Fusing",
      "CARTING": "Carting",
      "COMPLETED": "Completed"
    };
    return statusMap[status] || status;
  };

  const isStepCompleted = (runStatus: string, stepStatus: string): boolean => {
    const runIndex = getStatusIndex(runStatus);
    const stepIndex = PROCESS_MASTER_STATUSES.indexOf(stepStatus);
    
    // If run is CONFIGURED, no steps are completed
    if (runStatus === "CONFIGURED") return false;
    
    return stepIndex < runIndex || runStatus === "COMPLETED";
  };

  const isCurrentStep = (runStatus: string, stepStatus: string): boolean => {
    // If run is CONFIGURED, DESIGN is the first step
    if (runStatus === "CONFIGURED") {
      return stepStatus === "DESIGN";
    }
    
    return runStatus === stepStatus;
  };

  const formatDateTime = (date?: Date): string => {
    if (!date) return "Not started";
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const advanceRunStatus = async (processId: string, runId: string) => {
    if (!order) return;
    
    const process = order.processes.find(p => p.id === processId);
    const run = process?.runs.find(r => r.id === runId);
    
    if (!process || !run) return;

    const nextStatus = getNextStatus(run);
    
    if (!nextStatus) return;

    setUpdating(true);
    try {
      // Update run status through API
      const updatedOrder = await updateRunStatus(order.id, processId, runId, nextStatus);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    } catch (error) {
      console.error("Error updating run status:", error);
      alert("Failed to update run status. Please try again.");
    } finally {
      setUpdating(false);
    }

    // Stay on same run
    setActiveRunId(runId);
  };

  const handleLocationUpdate = async (processId: string, runId: string) => {
    if (!order) return;
    
    const locationKey = `${processId}-${runId}`;
    const newLocation = locationInput[locationKey];
    
    if (!newLocation?.trim()) return;

    setUpdating(true);
    try {
      // Update run location through API
      const updatedOrder = await updateRunLocation(order.id, processId, runId, newLocation);
      if (updatedOrder) {
        setOrder(updatedOrder);
        // Clear input and exit edit mode
        setLocationInput(prev => ({ ...prev, [locationKey]: "" }));
        setEditingLocation(null);
      }
    } catch (error) {
      console.error("Error updating location:", error);
      alert("Failed to update location. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const toggleProcessExpansion = (processId: string) => {
    const newExpanded = new Set(expandedProcesses);
    if (newExpanded.has(processId)) {
      newExpanded.delete(processId);
    } else {
      newExpanded.add(processId);
    }
    setExpandedProcesses(newExpanded);
  };

  const handleRunClick = (processId: string, runId: string, runStatus: string) => {
    // Allow opening any run that is not "NOT_CONFIGURED"
    const canOpen = runStatus !== "NOT_CONFIGURED";
    
    if (!canOpen) {
      return; // Don't open not configured runs
    }
    
    // Toggle the run accordion
    setActiveRunId(activeRunId === runId ? null : runId);
  };

  const shouldShowNextButton = (run: ProcessRun, stepStatus: string): boolean => {
    // Show Next button if this step is current and run is not completed
    const isCurrent = isCurrentStep(run.statusCode, stepStatus);
    const isNotCompleted = run.statusCode !== "COMPLETED";
    return isCurrent && isNotCompleted;
  };

  const isRunActive = (runStatus: string): boolean => {
    return runStatus !== "COMPLETED" && runStatus !== "NOT_CONFIGURED" && runStatus !== "CONFIGURED";
  };

  const canOpenRun = (runStatus: string): boolean => {
    // Can open any run that is not "NOT_CONFIGURED"
    return runStatus !== "NOT_CONFIGURED";
  };

  const startEditingLocation = (processId: string, runId: string, currentLocation?: string) => {
    setEditingLocation(`${processId}-${runId}`);
    setLocationInput(prev => ({ 
      ...prev, 
      [`${processId}-${runId}`]: currentLocation || "" 
    }));
  };

  const cancelEditingLocation = () => {
    setEditingLocation(null);
  };

  /* =================================================
     UI
     ================================================= */

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600">Order not found</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl">
        {/* LEFT — ORDER DETAILS */}
        <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {order.orderCode}
            </h2>
            <div className="text-sm text-gray-600 space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span>Customer:</span>
                <strong className="text-gray-800">{order.customer.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Code:</span>
                <span className="font-medium">{order.customer.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{order.quantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.statusCode === "COMPLETED" 
                    ? "bg-green-100 text-green-800"
                    : order.statusCode === "IN_PRODUCTION"
                    ? "bg-blue-100 text-blue-800"
                    : order.statusCode === "PRODUCTION_READY"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {order.statusCode}
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
                      <span className="font-medium text-gray-800">{process.process.name}</span>
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
                                    run.statusCode === "COMPLETED"
                                      ? "bg-green-100 text-green-800"
                                      : run.statusCode === "CONFIGURED"
                                      ? "bg-gray-100 text-gray-800"
                                      : run.statusCode === "NOT_CONFIGURED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {run.statusCode === "COMPLETED" 
                                      ? "Completed" 
                                      : run.statusCode === "CONFIGURED"
                                      ? "Configured"
                                      : run.statusCode === "NOT_CONFIGURED"
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
                                      onClick={() => handleLocationUpdate(process.id, run.id)}
                                      disabled={updating}
                                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {updating ? "..." : <Save className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={cancelEditingLocation}
                                      disabled={updating}
                                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      {run.location ? (
                                        <>
                                          <MapPin className="w-3 h-3" />
                                          <span>{run.location}</span>
                                        </>
                                      ) : (
                                        <span className="text-gray-400">No location set</span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => startEditingLocation(process.id, run.id, run.location)}
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
          {order.statusCode === "CONFIGURE" && (
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
          {(order.statusCode === "PRODUCTION_READY" ||
            order.statusCode === "IN_PRODUCTION" ||
            order.statusCode === "COMPLETED") &&
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
                  const canOpen = canOpenRun(run.statusCode);
                  const isActive = isRunActive(run.statusCode);
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
                        onClick={() => handleRunClick(process.id, run.id, run.statusCode)}
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
                            run.statusCode === "COMPLETED" 
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
                              Progress: {getStatusDisplayName(run.statusCode)}
                            </div>
                            {run.location && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <MapPin className="w-3 h-3" />
                                <span>{run.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            run.statusCode === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : isActive
                              ? "bg-blue-100 text-blue-800"
                              : run.statusCode === "CONFIGURED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {run.statusCode === "COMPLETED" 
                              ? "Completed" 
                              : run.statusCode === "CONFIGURED"
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
                                value={locationInput[`${process.id}-${run.id}`] || run.location || ""}
                                onChange={(e) => setLocationInput(prev => ({
                                  ...prev,
                                  [`${process.id}-${run.id}`]: e.target.value
                                }))}
                                placeholder="Enter location (e.g., Line 1, Machine A)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={updating}
                              />
                              <button
                                onClick={() => handleLocationUpdate(process.id, run.id)}
                                disabled={updating}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                {updating ? "Updating..." : "Update"}
                              </button>
                            </div>
                            {run.location && !isEditingLocation && (
                              <div className="mt-2 text-sm text-gray-600">
                                Current: {run.location}
                              </div>
                            )}
                          </div>

                          {/* VERTICAL TIMELINE */}
                          <div className="relative pl-8 space-y-6">
                            {/* VERTICAL LINE */}
                            <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-gray-300" />
                            
                            {PROCESS_MASTER_STATUSES.map((status) => {
                              const completed = isStepCompleted(run.statusCode, status);
                              const current = isCurrentStep(run.statusCode, status);
                              const nextButtonVisible = shouldShowNextButton(run, status);

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
                                      {nextButtonVisible && (
                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                          <button
                                            onClick={() => advanceRunStatus(process.id, run.id)}
                                            disabled={updating}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                          >
                                            <span>
                                              {updating ? "Updating..." : 
                                                run.statusCode === "CONFIGURED" 
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
                          {run.statusCode === "COMPLETED" && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center justify-center gap-2 text-green-800">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">This run has been completed</span>
                              </div>
                              {run.location && (
                                <div className="text-center text-green-700 text-sm mt-2">
                                  Location: {run.location}
                                </div>
                              )}
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