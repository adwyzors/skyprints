'use client';

import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronRight,
    DollarSign,
    Edit,
    Eye,
    FileText,
    Grid,
    Hash,
    Package,
    Palette,
    Ruler,
    Save,
    Type,
    User,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Order } from '@/domain/model/order.model';
import { ProcessRun } from '@/domain/model/process.run.model';
import { getOrderById } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';

interface ScreenPrintingConfigProps {
  order: Order;
  onRefresh?: () => Promise<void>;
}

// Field icon mapping for compact view
const getFieldIcon = (fieldName: string) => {
  const lowerField = fieldName.toLowerCase();

  if (lowerField.includes('date')) return <Calendar className="w-3 h-3" />;
  if (lowerField.includes('job') || lowerField.includes('number'))
    return <Hash className="w-3 h-3" />;
  if (lowerField.includes('party') || lowerField.includes('customer'))
    return <User className="w-3 h-3" />;
  if (lowerField.includes('particular') || lowerField.includes('design'))
    return <FileText className="w-3 h-3" />;
  if (lowerField.includes('color')) return <Palette className="w-3 h-3" />;
  if (lowerField.includes('size') || lowerField.includes('area') || lowerField.includes('farma'))
    return <Ruler className="w-3 h-3" />;
  if (lowerField.includes('quantity')) return <Package className="w-3 h-3" />;
  if (lowerField.includes('amount') || lowerField.includes('rate') || lowerField.includes('price'))
    return <DollarSign className="w-3 h-3" />;
  if (lowerField.includes('type')) return <Type className="w-3 h-3" />;
  return <Grid className="w-3 h-3" />;
};

export default function ScreenPrintingConfig({ order, onRefresh }: ScreenPrintingConfigProps) {
  const [localOrder, setLocalOrder] = useState<Order>(order);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Update local order when parent order changes
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  const getRunFieldConfigs = (run: ProcessRun) => run.runTemplate?.fields ?? [];

  const areAllFieldsFilled = (run: ProcessRun) => {
    const fields = run.runTemplate?.fields ?? [];
    return fields
      .filter((f) => f.required)
      .every((f) => {
        const value = run.fields[f.key];
        return value !== null && value !== undefined && value !== '';
      });
  };

  const prettyLabel = (field: string) =>
    field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase());

  const getRunProgress = (run: ProcessRun) => {
    const fields = run.runTemplate?.fields ?? [];
    if (fields.length === 0) return 100;

    const filled = fields.filter((f) => {
      const value = run.fields[f.key];
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((filled.length / fields.length) * 100);
  };

  const updateRunField = (processId: string, runId: string, field: string, value: string) => {
    setLocalOrder((prev) => {
      if (!prev) return prev;

      const updatedOrder = {
        ...prev,
        processes: prev.processes.map((p) =>
          p.id !== processId
            ? p
            : {
                ...p,
                runs: p.runs.map((r) =>
                  r.id !== runId
                    ? r
                    : {
                        ...r,
                        fields: {
                          ...r.fields,
                          [field]: value,
                        },
                      },
                ),
              },
        ),
      };

      // If we're updating quantity or rate, calculate and update total amount
      if (field === 'Quantity' || field === 'Rate') {
        const process = updatedOrder.processes.find((p) => p.id === processId);
        const run = process?.runs.find((r) => r.id === runId);

        if (run) {
          const quantity = Number(run.fields['Quantity'] || 0);
          const rate = Number(run.fields['Rate'] || 0);

          if (quantity && rate) {
            const totalAmount = (quantity * rate).toString();

            return {
              ...updatedOrder,
              processes: updatedOrder.processes.map((p) =>
                p.id !== processId
                  ? p
                  : {
                      ...p,
                      runs: p.runs.map((r) =>
                        r.id !== runId
                          ? r
                          : {
                              ...r,
                              fields: {
                                ...r.fields,
                                'Total Amount': totalAmount,
                              },
                            },
                      ),
                    },
              ),
            };
          } else {
            // If either quantity or rate is empty, clear total amount
            return {
              ...updatedOrder,
              processes: updatedOrder.processes.map((p) =>
                p.id !== processId
                  ? p
                  : {
                      ...p,
                      runs: p.runs.map((r) =>
                        r.id !== runId
                          ? r
                          : {
                              ...r,
                              fields: {
                                ...r.fields,
                                'Total Amount': '',
                              },
                            },
                      ),
                    },
              ),
            };
          }
        }
      }

      return updatedOrder;
    });
  };

  const saveRun = async (processId: string, runId: string) => {
    const process = localOrder.processes.find((p) => p.id === processId);
    const run = process?.runs.find((r) => r.id === runId);
    if (!process || !run) return;

    if (!areAllFieldsFilled(run)) {
      alert('Please fill all required fields before saving.');
      return;
    }

    // Ensure all values are strings before sending to API
    const stringFields: Record<string, string> = {};
    Object.entries(run.fields).forEach(([key, value]) => {
      stringFields[key] = value === null || value === undefined ? '' : String(value);
    });

    setIsSaving(runId);
    setError(null);

    try {
      await configureRun(localOrder.id, processId, runId, stringFields);

      // Refresh the order data from API
      const refreshed = await getOrderById(localOrder.id);
      if (!refreshed) throw new Error('Order not found');
      setLocalOrder(refreshed);

      // Also refresh parent component
      if (onRefresh) {
        await onRefresh();
      }

      alert(`Run ${run.runNumber} configured successfully`);
      setOpenRunId(null); // Close the form after successful save
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(null);
    }
  };

  // Calculate total amount if quantity and rate are filled
  const calculateTotalAmount = (run: ProcessRun) => {
    const quantity = Number(run.fields['Quantity'] || 0);
    const rate = Number(run.fields['Rate'] || 0);
    if (quantity && rate) {
      return quantity * rate;
    }
    return null;
  };

  // Get total amount as string for display
  const getTotalAmountDisplay = (run: ProcessRun) => {
    const totalAmount = calculateTotalAmount(run);
    return totalAmount ? `₹${totalAmount.toLocaleString('en-IN')}` : '₹0';
  };

  // Group fields into pairs for table-like layout
  const groupFieldsIntoPairs = (fields: any[]) => {
    const pairs = [];
    for (let i = 0; i < fields.length; i += 2) {
      pairs.push([fields[i], fields[i + 1]]);
    }
    return pairs;
  };

  // Initialize total amount when component loads
  useEffect(() => {
    const initializeTotalAmounts = () => {
      localOrder.processes.forEach((process) => {
        process.runs.forEach((run) => {
          const quantity = Number(run.fields['Quantity'] || 0);
          const rate = Number(run.fields['Rate'] || 0);

          if (quantity && rate && !run.fields['Total Amount']) {
            const totalAmount = (quantity * rate).toString();

            setLocalOrder((prev) => {
              if (!prev) return prev;

              return {
                ...prev,
                processes: prev.processes.map((p) =>
                  p.id !== process.id
                    ? p
                    : {
                        ...p,
                        runs: p.runs.map((r) =>
                          r.id !== run.id
                            ? r
                            : {
                                ...r,
                                fields: {
                                  ...r.fields,
                                  'Total Amount': totalAmount,
                                },
                              },
                        ),
                      },
                ),
              };
            });
          }
        });
      });
    };

    initializeTotalAmounts();
  }, []);

  // Function to render form or view based on run status
  const renderRunFormOrView = (process: any, run: ProcessRun) => {
    const isConfigured = run.statusCode === 'CONFIGURED';

    if (isConfigured) {
      // Show READ-ONLY view for configured runs
      return (
        <div className="bg-gray-50 border border-gray-300 rounded p-3">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <h3 className="font-semibold text-sm">View Run {run.runNumber} Configuration</h3>
              </div>
              <button
                onClick={() => setOpenRunId(null)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* READ-ONLY COMPACT TABLE */}
            <div className="border border-gray-300 rounded overflow-hidden bg-white">
              {(() => {
                const fieldConfigs = getRunFieldConfigs(run);
                const pairs = groupFieldsIntoPairs(fieldConfigs);

                return pairs.map((pair, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300"
                  >
                    {pair.map((fieldConfig: any, cellIndex: number) => {
                      if (!fieldConfig) return null;

                      const field = fieldConfig.key;
                      const isRequired = fieldConfig.required === true;

                      return (
                        <React.Fragment key={field}>
                          {/* LABEL CELL */}
                          <div className="bg-gray-50 p-1.5">
                            <div className="flex items-center gap-1">
                              {getFieldIcon(field)}
                              <label className="text-xs font-medium text-gray-700">
                                {prettyLabel(field)}
                                {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                            </div>
                          </div>

                          {/* VALUE CELL (READ-ONLY) */}
                          <div className="p-1.5 bg-white">
                            <div className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 font-medium text-gray-700">
                              {run.fields[field] || <span className="text-gray-400">Not set</span>}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Fill empty cells if odd number of fields */}
                    {pair.length === 1 && (
                      <>
                        <div className="bg-gray-50 p-1.5"></div>
                        <div className="p-1.5 bg-white"></div>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* TOTAL AMOUNT INFO */}
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Total Amount:</span>
                <span className="font-bold text-green-700">{getTotalAmountDisplay(run)}</span>
              </div>
            </div>

            {/* CLOSE BUTTON FOR VIEW MODE */}
            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={() => setOpenRunId(null)}
                className="px-4 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Close
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      // Show EDITABLE form for unconfigured runs
      return (
        <div className="bg-gray-50 border border-gray-300 rounded p-3">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <h3 className="font-semibold text-sm">Configure Run {run.runNumber}</h3>
              </div>
              <button
                onClick={() => setOpenRunId(null)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* EDITABLE COMPACT FORM TABLE */}
            <div className="border border-gray-300 rounded overflow-hidden bg-white">
              {(() => {
                const fieldConfigs = getRunFieldConfigs(run);
                const pairs = groupFieldsIntoPairs(fieldConfigs);

                return pairs.map((pair, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300"
                  >
                    {pair.map((fieldConfig: any, cellIndex: number) => {
                      if (!fieldConfig) return null;

                      const field = fieldConfig.key;
                      const isRequired = fieldConfig.required === true;
                      const type = fieldConfig.type || 'string';
                      const isNumberField =
                        field.toLowerCase().includes('quantity') ||
                        field.toLowerCase().includes('amount') ||
                        field.toLowerCase().includes('rate');

                      return (
                        <React.Fragment key={field}>
                          {/* LABEL CELL */}
                          <div className="bg-gray-50 p-1.5">
                            <div className="flex items-center gap-1">
                              {getFieldIcon(field)}
                              <label className="text-xs font-medium text-gray-700">
                                {prettyLabel(field)}
                                {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                            </div>
                          </div>

                          {/* INPUT CELL */}
                          <div className="p-1.5 bg-white">
                            {field === 'Total Amount' ? (
                              // Display-only field for Total Amount
                              <div className="w-full text-sm border border-green-300 bg-green-50 rounded px-2 py-1 font-medium text-green-700">
                                {getTotalAmountDisplay(run)}
                              </div>
                            ) : (
                              // Editable field
                              <input
                                type={isNumberField ? 'number' : 'text'}
                                value={run.fields[field] ?? ''}
                                onChange={(e) =>
                                  updateRunField(process.id, run.id, field, e.target.value)
                                }
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder={`Enter ${prettyLabel(field).toLowerCase()}`}
                                min={isNumberField ? '0' : undefined}
                                step={isNumberField ? '1' : undefined}
                              />
                            )}
                            {isRequired && !run.fields[field] && (
                              <p className="text-xs text-red-500 mt-0.5">Required</p>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Fill empty cells if odd number of fields */}
                    {pair.length === 1 && (
                      <>
                        <div className="bg-gray-50 p-1.5"></div>
                        <div className="p-1.5 bg-white"></div>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* TOTAL AMOUNT INFO */}
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Total Amount (Calculated):</span>
                <span className="font-bold text-green-700">{getTotalAmountDisplay(run)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Calculated automatically as: Quantity × Rate
              </p>
            </div>

            {/* ACTION BUTTONS - COMPACT */}
            <div className="mt-4 flex items-center justify-between">
              <div>
                {!areAllFieldsFilled(run) && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Fill all required fields (*) to save</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenRunId(null)}
                  disabled={isSaving === run.id}
                  className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveRun(process.id, run.id)}
                  disabled={!areAllFieldsFilled(run) || isSaving === run.id}
                  className={`px-4 py-1 text-sm font-medium rounded transition-colors flex items-center gap-1 ${
                    areAllFieldsFilled(run)
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSaving === run.id ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      {/* ERROR MESSAGE */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-800 mb-4">Screen Printing Configuration</h3>

      {/* RUN CARDS - COMPACT VIEW */}
      <div className="space-y-3">
        {localOrder.processes.flatMap((process) =>
          process.runs.map((run) => {
            const progress = getRunProgress(run);
            const isConfigured = run.statusCode === 'CONFIGURED';
            const totalAmountDisplay = getTotalAmountDisplay(run);
            const filledFields = Object.values(run.fields).filter((v) => v && v !== '').length;
            const totalFields = run.runTemplate?.fields?.length || 0;

            return (
              <div key={run.id} className="space-y-1">
                {/* RUN HEADER - COMPACT */}
                <div
                  onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}
                  className={`border rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isConfigured
                      ? 'bg-green-50 border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}
                      />
                      <span className="font-medium text-sm">Run {run.runNumber}</span>
                      <span className="text-xs text-gray-500">
                        ({filledFields}/{totalFields} fields)
                      </span>
                      {isConfigured && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Configured
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-green-700">{totalAmountDisplay}</span>
                      <div className="flex items-center gap-1">
                        {isConfigured ? (
                          <Eye className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Edit className="w-4 h-4 text-gray-500" />
                        )}
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            openRunId === run.id ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXPANDED FORM OR VIEW */}
                {openRunId === run.id && renderRunFormOrView(process, run)}
              </div>
            );
          }),
        )}
      </div>
    </>
  );
}
