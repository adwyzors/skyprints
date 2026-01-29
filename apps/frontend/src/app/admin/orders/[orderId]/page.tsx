'use client';

import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  ChevronDown,
  Edit2,
  FileText,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import ComingSoonConfig from '@/components/orders/ComingSoonConfig';
import ScreenPrintingConfig from '@/components/orders/ScreenPrintingConfig';
import { BillingSnapshot } from '@/domain/model/billing.model';
import { Order } from '@/domain/model/order.model';
import { getLatestBillingSnapshot } from '@/services/billing.service';
import { getOrderById, setProductionReady } from '@/services/orders.service';

export default function OrderConfigPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [billingData, setBillingData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [expandedBillingRuns, setExpandedBillingRuns] = useState<Set<string>>(new Set());

  const toggleBillingRunExpansion = (runId: string) => {
    setExpandedBillingRuns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(runId)) {
        newSet.delete(runId);
      } else {
        newSet.add(runId);
      }
      return newSet;
    });
  };

  const showBillingView = useMemo(() => {
    if (!order) return false;
    return ['BILLED', 'COMPLETE'].includes(order.status.toUpperCase());
  }, [order]);

  const fetchAllData = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch order data
      const orderData = await getOrderById(orderId);
      if (!orderData) throw new Error('Order not found');
      setOrder(orderData);

      // Fetch billing data for billed/completed orders
      if (['BILLED', 'COMPLETE'].includes(orderData.status.toUpperCase())) {
        const billingSnapshot = await getLatestBillingSnapshot(orderId);
        setBillingData(billingSnapshot);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load order data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      await fetchAllData();
    };

    if (!cancelled) {
      loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const refreshOrder = async () => {
    if (!orderId) return;
    try {
      const refreshed = await getOrderById(orderId);
      if (refreshed) setOrder(refreshed);
    } catch (err) {
      console.error('Failed to refresh order:', err);
    }
  };

  const handleEditBilling = (runId: string) => {
    if (!billingData) return;
    setEditingRunId(runId);
    setEditValues({ ...billingData.inputs[runId] });
  };

  const handleSaveBilling = async () => {
    if (!orderId || !editingRunId || !billingData) return;

    setIsSavingBilling(true);
    try {
      // Build payload matching the BillingModal format
      // Only include the new_rate for all runs
      const inputs: Record<string, { new_rate: number }> = {};

      Object.entries(billingData.inputs).forEach(([runId, values]) => {
        if (runId === editingRunId) {
          // Use the edited value
          inputs[runId] = { new_rate: editValues['new_rate'] ?? values['new_rate'] ?? 0 };
        } else {
          // Keep existing rate
          inputs[runId] = { new_rate: values['new_rate'] ?? 0 };
        }
      });

      const payload = { orderId, inputs };

      console.log('Saving billing data via finalize API:', payload);

      // Use the same API as BillingModal
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/finalize/order`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save billing');
      }

      setEditingRunId(null);
      await fetchAllData(); // Refresh to get recalculated totals
    } catch (err) {
      console.error('Failed to update billing:', err);
      alert('Failed to update billing data');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingRunId(null);
    setEditValues({});
  };

  const getRunById = (runId: string) => {
    if (!order) return null;
    for (const process of order.processes) {
      const run = process.runs.find((r) => r.id === runId);
      if (run) return { run, processName: process.name };
    }
    return null;
  };

  const allRuns = useMemo(() => {
    return order?.processes.flatMap((p) => p.runs) || [];
  }, [order]);

  const configuredRunsCount = useMemo(() => {
    return allRuns.filter((r) => r.configStatus === 'COMPLETE').length;
  }, [allRuns]);

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
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{error || 'Order not found'}</h2>
          <button
            onClick={() => router.push('/admin/orders')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const mainProcess = order.processes[0];
  const processName = mainProcess?.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => router.push('/admin/orders')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Orders</span>
                </button>
                <div className="h-6 w-px bg-gray-300 hidden md:block" />
                <h1 className="text-2xl font-bold text-gray-800">{order.code}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      order.status === 'BILLED'
                        ? 'bg-purple-500'
                        : order.status === 'COMPLETE'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {order.customer.name} ({order.customer.code})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-600">Quantity: {order.quantity}</span>
                </div>
                {order.jobCode && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-700">Job: {order.jobCode}</span>
                  </div>
                )}
                {billingData && (
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Total: {billingData.result} {billingData.currency}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  order.status === 'BILLED'
                    ? 'bg-purple-100 text-purple-800'
                    : order.status === 'COMPLETE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {order.status.replace('_', ' ')}
              </div>
              <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {order.processes.length} Process
                {order.processes.length !== 1 ? 'es' : ''}
              </div>
              {showBillingView && billingData && (
                <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Billing v{billingData.version}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`grid gap-6 ${showBillingView ? 'lg:grid-cols-2' : ''}`}>
          {/* LEFT COLUMN - Processes & Configuration */}
          <div className="space-y-6">
            {/* PROCESS NAVIGATION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Processes</h3>
              <div className="flex flex-wrap gap-3">
                {order.processes.map((process) => (
                  <div
                    key={process.id}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      processName === process.name
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="font-medium">{process.name}</span>
                      <span className="text-xs bg-white px-2 py-0.5 rounded-full">
                        {process.runs.length} run
                        {process.runs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONFIGURATION COMPONENT */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              {processName === 'Screen Printing' || processName === 'Embellishment' ? (
                <ScreenPrintingConfig
                  order={order}
                  onRefresh={refreshOrder}
                  onSaveSuccess={(processId, runId) => {
                    setOrder((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        processes: prev.processes.map((p) =>
                          p.id === processId
                            ? {
                                ...p,
                                runs: p.runs.map((r) =>
                                  r.id === runId ? { ...r, configStatus: 'COMPLETE' } : r,
                                ),
                              }
                            : p,
                        ),
                      };
                    });
                  }}
                />
              ) : (
                <ComingSoonConfig order={order} />
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Billing Information (only for billed/complete) */}
          {showBillingView && billingData && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Billing Summary</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Updated: {new Date(billingData.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    {billingData.calculationType}
                  </div>
                </div>

                {/* TOTAL AMOUNT */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="text-sm text-gray-600 mb-1">Total Amount</div>
                  <div className="text-3xl font-bold text-gray-800">
                    {billingData.result} {billingData.currency}
                  </div>
                  {billingData.version > 1 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Version {billingData.version} •{' '}
                      {billingData.isLatest ? 'Latest' : 'Historical'}
                    </div>
                  )}
                </div>

                {/* RUN-WISE BREAKDOWN */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 mb-3">Run-wise Breakdown</h4>
                  {Object.entries(billingData.inputs).map(([runId, values], index) => {
                    const runInfo = getRunById(runId);
                    const isExpanded = expandedBillingRuns.has(runId) || editingRunId === runId;
                    const newRate = values['new_rate'];

                    return (
                      <div
                        key={runId}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
                      >
                        {/* COLLAPSED HEADER - Always visible */}
                        <div
                          className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                          onClick={() => toggleBillingRunExpansion(runId)}
                        >
                          <div className="flex items-center gap-3">
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                            <div>
                              <div className="font-medium text-gray-800 text-sm">
                                {runInfo ? runInfo.run.displayName : `Run ${index + 1}`}
                              </div>
                              {runInfo && (
                                <div className="text-xs text-gray-500">{runInfo.processName}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {newRate !== undefined && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded">
                                ₹{newRate}/unit
                              </span>
                            )}
                            {editingRunId !== runId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditBilling(runId);
                                  setExpandedBillingRuns((prev) => new Set(prev).add(runId));
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>

                        {/* EXPANDED CONTENT */}
                        {isExpanded && (
                          <div className="p-4 border-t border-gray-200">
                            {editingRunId === runId ? (
                              <div className="space-y-4">
                                {/* EDIT CONTROLS */}
                                <div className="flex justify-end gap-2 mb-4">
                                  <button
                                    onClick={handleSaveBilling}
                                    disabled={isSavingBilling}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {isSavingBilling ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                    Cancel
                                  </button>
                                </div>

                                {/* NEW RATE INPUT */}
                                <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-green-600 rounded-lg">
                                      <Calculator className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-green-800">Billing Rate</div>
                                      <div className="text-xs text-green-600">
                                        Saved via Billing API
                                      </div>
                                    </div>
                                  </div>
                                  <input
                                    type="number"
                                    value={editValues['new_rate'] ?? 0}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({
                                        ...prev,
                                        new_rate: parseFloat(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-full px-4 py-2 border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-lg font-semibold"
                                  />
                                </div>

                                {/* OTHER VALUES - Read-only */}
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(editValues)
                                    .filter(([key]) => key !== 'new_rate')
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="text-center p-2 bg-gray-50 border border-gray-200 rounded"
                                      >
                                        <div className="text-xs text-gray-500">
                                          {key
                                            .replace(/_/g, ' ')
                                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                                        </div>
                                        <div className="font-medium text-gray-800 text-sm">
                                          {key.includes('rate') || key.includes('amount')
                                            ? `₹${value}`
                                            : String(value)}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {Object.entries(values).map(([key, value]) => (
                                  <div key={key} className="text-center p-2 bg-gray-50 rounded">
                                    <div className="text-xs text-gray-600 mb-1">
                                      {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="font-medium text-gray-800 text-sm">
                                      {key.includes('rate') || key.includes('amount')
                                        ? `₹${value}`
                                        : String(value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QUICK SUMMARY */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-700 mb-4">Order Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-700">{order.processes.length}</div>
                    <div className="text-sm text-blue-600">Processes</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-700">{allRuns.length}</div>
                    <div className="text-sm text-green-600">Total Runs</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-purple-700">{configuredRunsCount}</div>
                    <div className="text-sm text-purple-600">Configured</div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl">
                    <div className="text-2xl font-bold text-amber-700">
                      {allRuns.length - configuredRunsCount}
                    </div>
                    <div className="text-sm text-amber-600">Pending</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER (only for configure/production statuses) */}
        {!showBillingView && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <p className="font-medium">Order Configuration Summary</p>
                <p className="mt-1">
                  Configure all runs to move this order to{' '}
                  <span className="font-semibold text-green-600">PRODUCTION_READY</span>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Configured Runs</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {configuredRunsCount}
                    <span className="text-sm font-normal text-gray-400"> / {allRuns.length}</span>
                  </p>
                </div>

                {configuredRunsCount === allRuns.length && (
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await setProductionReady(order.id);
                        router.push(`/admin/orders?selectedOrder=${order.id}`);
                      } catch (err) {
                        console.error(err);
                        alert('Failed to transition order');
                        setLoading(false);
                      }
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-medium rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <span>Production Ready</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
