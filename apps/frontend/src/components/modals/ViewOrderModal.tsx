'use client';
// apps/frontend/src/components/modals/ViewOrderModal.tsx

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Order } from '@/domain/model/order.model';
import { getOrderById } from '@/services/orders.service';
import { CheckCircle, ChevronRight, Circle, FileText, Settings } from 'lucide-react';
import ConfigurationModal from './ConfigurationModal';

/* =================================================
   PROPS
   ================================================= */

export interface ViewOrderModalProps {
  orderId: string;
  onClose: () => void;
  onOrderUpdate?: () => void;
}

/* =================================================
   CONSTANTS (STATIC DOMAIN DATA)
   ================================================= */

/* =================================================
   CONSTANTS
   ================================================= */

// Process statuses are now dynamic from the backend via run.lifecycle

/* =================================================
   COMPONENT
   ================================================= */

import { transitionLifeCycle } from '@/services/run.service';

export default function ViewOrderModal({ orderId, onClose, onOrderUpdate }: ViewOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [locationInput, setLocationInput] = useState<Record<string, string>>({});
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [configModalRun, setConfigModalRun] = useState<{ run: any; processName: string } | null>(
    null,
  );

  const router = useRouter();
  const hasFetchedRef = useRef(false);

  /* =================================================
     FETCH ORDER (SAFE + ONCE)
     ================================================= */

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const fetched = await getOrderById(orderId);
      if (!fetched) return;

      setOrder(fetched);
      if (fetched.processes.length > 0 && expandedProcesses.size === 0) {
        setExpandedProcesses(new Set([fetched.processes[0].id]));
      }
      // Preselect first active run for execution views
      if (fetched.status === 'PRODUCTION_READY' || fetched.status === 'IN_PRODUCTION') {
        let firstActiveRun: string | null = null;

        outer: for (const process of fetched.processes) {
          for (const run of process.runs) {
            if (
              run.configStatus === 'COMPLETE' ||
              (run.configStatus !== 'COMPLETED' && run.configStatus !== 'NOT_CONFIGURED')
            ) {
              firstActiveRun = run.id;
              break outer;
            }
          }
        }

        // Only set if not already set or invalid
        if (!activeRunId) {
          setActiveRunId(firstActiveRun ?? fetched.processes[0]?.runs[0]?.id ?? null);
        }

        if (fetched.processes[0] && expandedProcesses.size === 0) {
          setExpandedProcesses(new Set([fetched.processes[0].id]));
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchOrder();
  }, [orderId]);

  /* =================================================
     DOMAIN HELPERS (PURE FUNCTIONS)
     ================================================= */

  const getStatusDisplayName = (status: string): string => {
    // Basic formatting for dynamic codes
    return status
      .replace(/_/g, ' ')
      .replace(/&/g, ' & ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isRunActive = (status: string) =>
    status !== 'COMPLETED' && status !== 'NOT_CONFIGURED' && status !== 'CONFIGURED'; // Assuming 'CONFIGURED' is just ready state, not active processing?

  const canOpenRun = (status: string) => status !== 'NOT_CONFIGURED';

  const toggleProcessExpansion = (processId: string) => {
    setExpandedProcesses((prev) => {
      const next = new Set(prev);
      next.has(processId) ? next.delete(processId) : next.add(processId);
      return next;
    });
  };

  const handleRunClick = (_processId: string, runId: string, runStatus: string) => {
    if (!canOpenRun(runStatus)) return;
    setActiveRunId((prev) => (prev === runId ? null : runId));
  };

  // Function to check if a lifecycle step is completed
  const isLifecycleStepCompleted = (run: any, stepCode: string): boolean => {
    const step = run.lifecycle?.find((s: any) => s.code === stepCode);
    return step ? step.completed : false;
  };

  // Function to check if a lifecycle step is the current step
  const isLifecycleStepCurrent = (run: any, stepCode: string): boolean => {
    return run.lifecycleStatus === stepCode && !isLifecycleStepCompleted(run, stepCode);
  };

  // Function to update lifecycle status locally after successful transition
  const updateLifecycleStatus = (processId: string, runId: string, newStatus: string) => {
    setOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        processes: prev.processes.map((process) => {
          if (process.id === processId) {
            return {
              ...process,
              runs: process.runs.map((run) => {
                if (run.id === runId) {
                  // Get current status before update
                  const currentStatus = run.lifecycleStatus;

                  // Update lifecycle: mark all steps UP TO (but not including) the new status as completed
                  const lifecycle = run.lifecycle?.map((step: any) => {
                    if (run.lifecycle) {
                      const stepIndex = run.lifecycle.findIndex((s: any) => s.code === step.code);
                      const newStatusIndex = run.lifecycle.findIndex(
                        (s: any) => s.code === newStatus,
                      );
                      // Mark all steps BEFORE the new status as completed
                      if (stepIndex < newStatusIndex) {
                        return { ...step, completed: true };
                      }
                    }
                    return step;
                  });

                  return {
                    ...run,
                    lifecycleStatus: newStatus,
                    lifecycle: lifecycle || run.lifecycle,
                  };
                }
                return run;
              }),
            };
          }
          return process;
        }),
      };
    });
  };

  /* =================================================
     ACTIONS
     ================================================= */

  const handleTransition = async (processId: string, runId: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      // Find the run to get its current values to pass to backend
      const process = order.processes.find((p) => p.id === processId);
      const run = process?.runs.find((r) => r.id === runId);

      if (!run) throw new Error('Run not found');

      // Get current lifecycle status and find next step
      const currentStatus = run.lifecycleStatus;
      const lifecycleSteps = run.lifecycle || [];
      const currentIndex = lifecycleSteps.findIndex((step: any) => step.code === currentStatus);

      if (currentIndex === -1 || currentIndex >= lifecycleSteps.length - 1) {
        throw new Error('No next step available');
      }

      const nextStep = lifecycleSteps[currentIndex + 1];
      const nextStatusCode = nextStep.code;

      const response = await transitionLifeCycle(order.id, processId, runId, {
        statusCode: nextStatusCode,
      });

      if (response.success) {
        if (nextStatusCode === 'COMPLETE' || nextStatusCode === 'COMPLETED') {
          // If the order is complete, we must refetch to get the final state
          await fetchOrder();
          // Notify parent to refresh the orders list
          if (onOrderUpdate) {
            onOrderUpdate();
          }
        } else {
          // Update local state immediately - no need to refetch from server
          updateLifecycleStatus(processId, runId, nextStatusCode);

          // If order was PRODUCTION_READY, it's now IN_PRODUCTION
          if (order.status === 'PRODUCTION_READY') {
            setOrder((prev) => (prev ? { ...prev, status: 'IN_PRODUCTION' } : null));
            // Notify parent for status change (optional, but good for keeping list in sync)
            if (onOrderUpdate) {
              onOrderUpdate();
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to transition:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  /* =================================================
     UI GUARDS
     ================================================= */

  if (loading && !order) {
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
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  /* =================================================
     UI
     ================================================= */

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl">
        {/* LEFT — ORDER DETAILS */}
        <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto min-h-0">
            <h2 className="text-xl font-bold text-gray-800 mb-2">{order.code}</h2>
            <div className="text-sm text-gray-600 space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span>Customer:</span>
                <strong className="text-gray-800">{order.customer?.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Code:</span>
                <span className="font-medium">{order.customer?.code}</span>
              </div>
              {order.jobCode && (
                <div className="flex items-center justify-between">
                  <span>Job Code:</span>
                  <span className="font-medium text-blue-700">{order.jobCode}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{order.quantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'IN_PRODUCTION'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'PRODUCTION_READY'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {order.status}
                </span>
              </div>

              {/* STATUS ACTION BUTTON */}
              {(order.status === 'COMPLETE' || order.status === 'COMPLETED') && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/admin/billing?selectedOrder=${order.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Rate Config
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-gray-700 mb-3">Processes</h3>
              <div className="space-y-2">
                {order.processes.map((process) => (
                  <div
                    key={process.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleProcessExpansion(process.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-800">{process.name}</span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          expandedProcesses.has(process.id) ? 'rotate-90' : ''
                        }`}
                      />
                    </button>

                    {expandedProcesses.has(process.id) && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-200">
                        <div className="space-y-2">
                          {process.runs.map((run) => {
                            // Get lifecycle steps for this run - filter out COMPLETE/BILLED
                            const lifecycleSteps = (run.lifecycle || []).filter(
                              (step: any) => step.code !== 'COMPLETE' && step.code !== 'BILLED',
                            );

                            // Find current step
                            const currentStepIndex = lifecycleSteps.findIndex(
                              (step: any) => step.code === run.lifecycleStatus,
                            );

                            // Calculate progress
                            const completedSteps = lifecycleSteps.filter(
                              (step: any) => step.completed,
                            ).length;
                            const totalSteps = lifecycleSteps.length;

                            return (
                              <div key={run.id} className="text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600">Run {run.runNumber}</span>
                                  </div>
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                      run.lifecycleStatus === 'COMPLETE' ||
                                      run.lifecycleStatus === 'BILLED'
                                        ? 'bg-green-100 text-green-800'
                                        : run.configStatus === 'COMPLETE'
                                          ? 'bg-blue-100 text-blue-800'
                                          : run.configStatus === 'CONFIGURED'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {run.lifecycleStatus === 'COMPLETE' ||
                                    run.lifecycleStatus === 'BILLED'
                                      ? 'Completed'
                                      : run.configStatus === 'COMPLETE'
                                        ? 'In Progress'
                                        : run.configStatus === 'CONFIGURED'
                                          ? 'Configured'
                                          : 'Not Configured'}
                                  </span>
                                </div>

                                {/* View Configuration Link */}
                                {run.configStatus === 'COMPLETE' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfigModalRun({ run, processName: process.name });
                                    }}
                                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    View Configuration →
                                  </button>
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

          <div className="pt-4 border-t border-gray-200 mt-4 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={updating}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* RIGHT — EXECUTION */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* NOT READY */}
          {order.status === 'CONFIGURE' && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center text-gray-500 mb-6">
                <div className="text-lg font-medium mb-2">Order Not Ready</div>
                <p>Set configurations for this order to begin production</p>
              </div>

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
          {(order.status === 'PRODUCTION_READY' ||
            order.status === 'IN_PRODUCTION' ||
            order.status === 'COMPLETED' ||
            order.status === 'COMPLETE') &&
            order.processes.map((process) => (
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
                  const isRunComplete = run.lifecycleStatus === 'BILLED';

                  // Dynamic lifecycle from run - use the lifecycle array from the run
                  // Filter out COMPLETE/BILLED steps from display
                  const lifecycleSteps = (run.lifecycle || []).filter(
                    (step: any) => step.code !== 'COMPLETE' && step.code !== 'BILLED',
                  );
                  const shouldShowTimeline =
                    run.configStatus === 'COMPLETE' && lifecycleSteps.length > 0;

                  return (
                    <div
                      key={run.id}
                      className={`border rounded-xl overflow-hidden mb-4 shadow-sm transition-shadow ${
                        !canOpen ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:shadow-md'
                      }`}
                    >
                      {/* HEADER */}
                      <button
                        onClick={() => handleRunClick(process.id, run.id, run.configStatus)}
                        disabled={!canOpen || updating}
                        className={`w-full p-4 flex items-center justify-between transition-colors ${
                          isOpen
                            ? 'bg-blue-50'
                            : !canOpen
                              ? 'bg-gray-50 cursor-not-allowed'
                              : 'bg-gray-50 hover:bg-gray-100'
                        } ${updating ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-8 rounded ${
                              isRunComplete
                                ? 'bg-green-500' // Completed
                                : run.configStatus === 'COMPLETE'
                                  ? 'bg-blue-500' // Active
                                  : 'bg-gray-400'
                            }`}
                          />
                          <div className="text-left">
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                              Run {run.runNumber}
                            </div>
                            <div className="text-sm text-gray-600">
                              {isRunComplete
                                ? 'Completed (Billed)'
                                : run.configStatus === 'COMPLETE'
                                  ? `Current: ${getStatusDisplayName(run.lifecycleStatus || 'Pending')}`
                                  : 'Configured'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              isRunComplete
                                ? 'bg-green-100 text-green-800'
                                : run.configStatus === 'COMPLETE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100'
                            }`}
                          >
                            {isRunComplete
                              ? 'Completed'
                              : run.configStatus === 'COMPLETE'
                                ? 'Active'
                                : 'Ready'}
                          </span>
                          {canOpen && (
                            <ChevronRight
                              className={`w-5 h-5 text-gray-500 transition-transform ${
                                isOpen ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </div>
                      </button>

                      {/* BODY - PROCESS TIMELINE */}
                      {isOpen && canOpen && (
                        <div className="p-6">
                          {/* Show timeline if run is COMPLETE and has lifecycle steps */}
                          {shouldShowTimeline ? (
                            <div className="relative pl-8 space-y-6">
                              {/* VERTICAL LINE */}
                              <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-gray-300" />

                              {lifecycleSteps.map((step, index) => {
                                const isCompleted =
                                  step.completed ||
                                  isLifecycleStepCompleted(run, step.code) ||
                                  (run.lifecycleStatus &&
                                    index <
                                      lifecycleSteps.findIndex(
                                        (s: any) => s.code === run.lifecycleStatus,
                                      ));
                                const isCurrent = isLifecycleStepCurrent(run, step.code);

                                return (
                                  <div key={step.code} className="relative flex items-start gap-4">
                                    {/* DOT */}
                                    <div
                                      className={`absolute -left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        isCompleted
                                          ? 'bg-green-500 border-green-500'
                                          : isCurrent
                                            ? 'bg-white border-blue-500'
                                            : 'bg-white border-gray-300'
                                      }`}
                                    >
                                      {isCompleted ? (
                                        <CheckCircle className="w-3 h-3 text-white" />
                                      ) : isCurrent ? (
                                        <Circle className="w-2 h-2 text-blue-500" />
                                      ) : null}
                                    </div>

                                    {/* CARD */}
                                    <div
                                      className={`flex-1 rounded-lg border ${
                                        isCurrent
                                          ? 'border-blue-200 bg-blue-50'
                                          : isCompleted
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-gray-200 bg-white'
                                      }`}
                                    >
                                      <div className="p-4">
                                        <div className="flex items-start justify-between mb-1">
                                          <div>
                                            <span
                                              className={`font-medium block ${
                                                isCurrent
                                                  ? 'text-blue-700'
                                                  : isCompleted
                                                    ? 'text-green-700'
                                                    : 'text-gray-700'
                                              }`}
                                            >
                                              {getStatusDisplayName(step.code)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {isCurrent && (
                                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                Current Step
                                              </span>
                                            )}
                                            {isCompleted && (
                                              <CheckCircle className="w-4 h-4 text-green-600" />
                                            )}
                                          </div>
                                        </div>

                                        {/* NEXT BUTTON */}
                                        {isCurrent && !isCompleted && !isRunComplete && (
                                          <div className="mt-4 pt-4 border-t border-blue-200">
                                            <button
                                              onClick={() => handleTransition(process.id, run.id)}
                                              disabled={updating}
                                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                            >
                                              <span>
                                                {updating
                                                  ? 'Updating...'
                                                  : 'Mark Completed & Continue'}
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
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              {run.configStatus === 'COMPLETE'
                                ? lifecycleSteps.length === 0
                                  ? 'No lifecycle steps defined.'
                                  : 'Configured. Ready to start production.'
                                : 'Configured. Ready to start production.'}
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

      {/* CONFIGURATION MODAL */}
      {configModalRun && order && (
        <ConfigurationModal
          run={configModalRun.run}
          processName={configModalRun.processName}
          orderCode={order.code}
          customerName={order.customer?.name || ''}
          onClose={() => setConfigModalRun(null)}
        />
      )}
    </div>
  );
}
