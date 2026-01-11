'use client';

import { Customer } from '@/model/customer.model';
import { Process } from '@/model/process.model';
import { getCustomers } from '@/services/customer.service';
import { createOrder, getOrders } from '@/services/orders.service';

import { getProcesses } from '@/services/process.service';
import { NewOrderPayload } from '@/types/planning';
import { useEffect, useMemo, useState } from 'react';

/* ================= TYPES ================= */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: NewOrderPayload) => void;
}

interface ProcessRow {
  processId: string;
  runs: number;
}

/* ================= COMPONENT ================= */

export default function CreateOrderModal({ open, onClose, onCreate }: Props) {
  /* ================= STATE (ALWAYS CALLED) ================= */

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        setDataLoading(true);
        const [customersData, processesData] = await Promise.all([getCustomers(), getProcesses()]);

        if (!cancelled) {
          setCustomers(customersData);
          setProcesses(processesData);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load data';

          setError(message);
          console.error(error);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* ================= DERIVED ================= */

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    if (!s) return [];
    return customers.filter(
      (c) => c.name.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s),
    );
  }, [customerSearch, customers]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId],
  );

  /* ================= CREATE ================= */

  const handleCreate = async () => {
    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    setLoading(true);
    try {
      const payload: NewOrderPayload = {
        customerId: selectedCustomer.id,
        quantity,
        processes: processRows.map((r) => ({
          processId: r.processId,
          count: r.runs,
        })),
      };

      await createOrder(payload);
      onCreate(payload);
      onClose();
      getOrders();
    } catch {
      setError('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  /* ================= PROCESS ROWS ================= */
  const addProcessRow = () => {
    setProcessRows((prev) => [...prev, { processId: '', runs: 1 }]);
  };

  const updateProcessRow = (index: number, patch: Partial<ProcessRow>) => {
    setProcessRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeProcessRow = (index: number) => {
    setProcessRows((prev) => prev.filter((_, i) => i !== index));
  };

  /* ================= RENDER ================= */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Create New Order</h2>
              <p className="text-sm text-gray-600 mt-1">Add order details and processes</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ERROR MESSAGE */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* LOADING DATA */}
          {dataLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading data...</span>
            </div>
          )}

          {!dataLoading && (
            <>
              {/* ORDER INFO */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Order Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CUSTOMER SEARCH */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Customer</label>
                    <div className="relative">
                      <input
                        placeholder="Search by name or code..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setSelectedCustomerId(null);
                          setError(null);
                        }}
                        disabled={loading}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                      />
                      {customerSearch &&
                        !selectedCustomer &&
                        filteredCustomers?.length &&
                        filteredCustomers.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredCustomers?.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setCustomerSearch(c.name);
                                  setError(null);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="font-medium">{c.name}</div>
                                <div className="text-sm text-gray-500">Code: {c.code}</div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* CUSTOMER CODE */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Customer Code</label>
                    <div className="relative">
                      <input
                        placeholder="Customer Code"
                        value={selectedCustomer?.code ?? ''}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-700"
                      />
                      {selectedCustomer && (
                        <div className="absolute right-3 top-3">
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            ✓
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QUANTITY */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      placeholder="Enter quantity..."
                      value={quantity || ''}
                      onChange={(e) => {
                        setQuantity(Number(e.target.value));
                        setError(null);
                      }}
                      disabled={loading}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                      min="1"
                    />
                  </div>

                  {/* ORDER ID (AUTO) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Order ID</label>
                    <div className="relative">
                      <input
                        placeholder="Auto Generated"
                        value="Auto Generated"
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-600 italic"
                      />
                      <div className="absolute right-3 top-3">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Auto
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROCESSES */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Processes
                  </h3>
                  <button
                    onClick={addProcessRow}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-lg">+</span>
                    Add Process
                  </button>
                </div>

                {processRows.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="w-12 h-12 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No processes added yet</p>
                    <p className="text-gray-400 text-xs mt-1">Add your first process to continue</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processRows.map((row, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </div>
                            <span className="text-sm text-gray-600">Process {i + 1}</span>
                          </div>
                          <button
                            onClick={() => removeProcessRow(i)}
                            disabled={loading}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Process</label>
                            <select
                              value={row.processId}
                              onChange={(e) => {
                                updateProcessRow(i, { processId: e.target.value });
                                setError(null);
                              }}
                              disabled={loading}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <option value="">Select process...</option>
                              {processes.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Runs</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={row.runs}
                                onChange={(e) =>
                                  updateProcessRow(i, { runs: Number(e.target.value) })
                                }
                                disabled={loading}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                              />
                              <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                                runs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                loading ||
                dataLoading ||
                !selectedCustomer ||
                quantity <= 0 ||
                processRows.length === 0
              }
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
