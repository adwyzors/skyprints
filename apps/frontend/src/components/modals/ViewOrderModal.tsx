"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Order, ProcessRun } from "@/types/domain";
import {
  getOrderById,
  updateRunStatus,
  updateRunLocation,
  canStartRun,
} from "@/services/orders.service";
import processesData from "@/data/processes.json";
import { CheckCircle, ChevronRight, Circle, Settings, Lock, MapPin } from "lucide-react";

/* =================================================
   PROPS
   ================================================= */

export interface ViewOrderModalProps {
  orderId: string;
  onClose: () => void;
}

/* =================================================
   COMPONENT
   ================================================= */

export default function ViewOrderModal({
  orderId,
  onClose,
}: ViewOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [locationInput, setLocationInput] = useState<{[key: string]: string}>({});
  const router = useRouter();

  const processMaster = processesData.processes[0];

  /* =================================================
     INIT
     ================================================= */

  useEffect(() => {
    const fetched = getOrderById(orderId);
    if (!fetched) return;

    setOrder(fetched);

    // Auto-open first run if order is ready for execution
    if (
      fetched.status === "PRODUCTION_READY" ||
      fetched.status === "IN_PRODUCTION"
    ) {
      // Find first configured but not completed run
      let firstActiveRunId: string | null = null;
      outer: for (const p of fetched.processes) {
        for (const r of p.runs) {
          if (r.status === "CONFIGURED" || (r.status !== "COMPLETED" && r.status !== "NOT_CONFIGURED")) {
            firstActiveRunId = r.id;
            break outer;
          }
        }
      }
      setActiveRunId(firstActiveRunId ?? fetched.processes[0]?.runs[0]?.id ?? null);
      
      // Expand first process by default
      setExpandedProcesses(new Set([fetched.processes[0]?.id]));
    }
  }, [orderId]);

  if (!order) return null;

  /* =================================================
     HELPERS
     ================================================= */

  const getNextStatus = (run: ProcessRun) => {
    if (run.status === "CONFIGURED") {
      return "DESIGN"; // First step after configuration
    }
    
    const idx = processMaster.statuses.indexOf(run.status);
    return idx < processMaster.statuses.length - 1 ? processMaster.statuses[idx + 1] : null;
  };

  const getStatusIndex = (status: string): number => {
    if (status === "CONFIGURED") return -1;
    return processMaster.statuses.indexOf(status);
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
    const stepIndex = processMaster.statuses.indexOf(stepStatus);
    
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

  const advanceRunStatus = (processId: string, runId: string) => {
    const process = order.processes.find(p => p.id === processId);
    const run = process?.runs.find(r => r.id === runId);
    
    if (!process || !run) return;

    const nextStatus = getNextStatus(run);
    
    if (!nextStatus) return;

    // Update run status through service
    const updatedOrder = updateRunStatus(order.id, processId, runId, nextStatus);
    if (updatedOrder) {
      setOrder(updatedOrder);
    }

    // Stay on same run
    setActiveRunId(runId);
  };

  const handleLocationUpdate = (processId: string, runId: string) => {
    const locationKey = `${processId}-${runId}`;
    const newLocation = locationInput[locationKey];
    
    if (!newLocation?.trim()) return;

    // Update run location through service
    const updatedOrder = updateRunLocation(order.id, processId, runId, newLocation);
    if (updatedOrder) {
      setOrder(updatedOrder);
      // Clear input
      setLocationInput(prev => ({ ...prev, [locationKey]: "" }));
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
    const isCurrent = isCurrentStep(run.status, stepStatus);
    const isNotCompleted = run.status !== "COMPLETED";
    return isCurrent && isNotCompleted;
  };

  const isRunActive = (runStatus: string): boolean => {
    return runStatus !== "COMPLETED" && runStatus !== "NOT_CONFIGURED" && runStatus !== "CONFIGURED";
  };

  const canOpenRun = (runStatus: string): boolean => {
    // Can open any run that is not "NOT_CONFIGURED"
    return runStatus !== "NOT_CONFIGURED";
  };

  /* =================================================
     UI
     ================================================= */

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
                <strong className="text-gray-800">{order.customerName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Code:</span>
                <span className="font-medium">{order.customerCode}</span>
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
                  {order.status.replace("_", " ")}
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
                          {process.runs.map((run) => (
                            <div key={run.id} className="text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">Run {run.runNumber}</span>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  run.status === "COMPLETED"
                                    ? "bg-green-100 text-green-800"
                                    : run.status === "CONFIGURED"
                                    ? "bg-gray-100 text-gray-800"
                                    : run.status === "NOT_CONFIGURED"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}>
                                  {run.status === "COMPLETED" 
                                    ? "Completed" 
                                    : run.status === "CONFIGURED"
                                    ? "Configured"
                                    : run.status === "NOT_CONFIGURED"
                                    ? "Not Configured"
                                    : "Active"
                                  }
                                </span>
                              </div>
                              {run.location && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>Location: {run.location}</span>
                                </div>
                              )}
                            </div>
                          ))}
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
            className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
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
                  const canOpen = canOpenRun(run.status);
                  const isActive = isRunActive(run.status);

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
                        onClick={() => handleRunClick(process.id, run.id, run.status)}
                        disabled={!canOpen}
                        className={`w-full p-4 flex items-center justify-between transition-colors ${
                          isOpen 
                            ? "bg-blue-50" 
                            : !canOpen
                            ? "bg-gray-50 cursor-not-allowed"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded ${
                            run.status === "COMPLETED" 
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
                              Progress: {getStatusDisplayName(run.status)}
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
                            run.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : isActive
                              ? "bg-blue-100 text-blue-800"
                              : run.status === "CONFIGURED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {run.status === "COMPLETED" 
                              ? "Completed" 
                              : run.status === "CONFIGURED"
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
                                value={locationInput[`${process.id}-${run.id}`] || ""}
                                onChange={(e) => setLocationInput(prev => ({
                                  ...prev,
                                  [`${process.id}-${run.id}`]: e.target.value
                                }))}
                                placeholder="Enter location (e.g., Line 1, Machine A)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleLocationUpdate(process.id, run.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Update
                              </button>
                            </div>
                            {run.location && (
                              <div className="mt-2 text-sm text-gray-600">
                                Current: {run.location}
                              </div>
                            )}
                          </div>

                          {/* VERTICAL TIMELINE */}
                          <div className="relative pl-8 space-y-6">
                            {/* VERTICAL LINE */}
                            <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-gray-300" />
                            
                            {processMaster.statuses.map((status) => {
                              const completed = isStepCompleted(run.status, status);
                              const current = isCurrentStep(run.status, status);
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
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                                          >
                                            <span>
                                              {run.status === "CONFIGURED" 
                                                ? "Start Production - Move to Design" 
                                                : "Completed. Move to Next Step"
                                              }
                                            </span>
                                            <ChevronRight className="w-4 h-4" />
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
                          {run.status === "COMPLETED" && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center justify-center gap-2 text-green-800">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">This run has been completed</span>
                              </div>
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