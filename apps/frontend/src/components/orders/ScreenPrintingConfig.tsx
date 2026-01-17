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
import { ProcessRun } from '@/domain/model/run.model';
import { configureRun } from '@/services/run.service';

interface ScreenPrintingConfigProps {
  order: Order;
  onRefresh?: () => Promise<void>;
  onSaveSuccess?: (processId: string, runId: string) => void; // Add this prop
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

export default function ScreenPrintingConfig({ order, onRefresh, onSaveSuccess }: ScreenPrintingConfigProps) {
  const [localOrder, setLocalOrder] = useState<Order>(order);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Update local order when parent order changes
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  // Get field configurations from run.fields array
  const getRunFieldConfigs = (run: ProcessRun) => run.fields ?? [];

  const areAllFieldsFilled = (run: ProcessRun) => {
    const fields = run.fields ?? [];
    return fields
      .filter((f) => f.required)
      .every((f) => {
        const value = run.values[f.key];
        return value !== null && value !== undefined && value !== '';
      });
  };

  const prettyLabel = (field: string) =>
    field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase());

  const getRunProgress = (run: ProcessRun) => {
    const fields = run.fields ?? [];
    if (fields.length === 0) return 100;

    const filled = fields.filter((f) => {
      const value = run.values[f.key];
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((filled.length / fields.length) * 100);
  };

  const updateRunField = (processId: string, runId: string, field: string, value: string) => {
    setLocalOrder((prev) => {
      if (!prev) return prev;
      const process = prev.processes.find(p => p.id === processId);
      const run = process?.runs.find(r => r.id === runId);

      if (!run) return prev;

      // Find the field definition to get the type
      const fieldDef = run.fields.find(f => f.key === field);
      let typedValue: string | number | null = value;

      // Convert to number if field type is number
      if (fieldDef?.type === 'number' && value !== '') {
        typedValue = Number(value);
        // If conversion fails, keep as string but log error
        if (isNaN(typedValue as number)) {
          console.error(`Failed to convert ${field} to number: ${value}`);
          typedValue = value; // Fallback to string
        }
      }
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
                    values: {
                      ...r.values,
                      [field]: typedValue,
                    },
                  },
              ),
            },
        ),
      };

      return updatedOrder;
    });
  };

  // Function to update run configStatus locally
  const updateRunConfigStatus = (processId: string, runId: string, newStatus: string) => {
    setLocalOrder((prev) => {
      if (!prev) return prev;

      const updatedOrder = {
        ...prev,
        processes: prev.processes.map((process) => {
          if (process.id === processId) {
            return {
              ...process,
              runs: process.runs.map((run) => {
                if (run.id === runId) {
                  return {
                    ...run,
                    configStatus: newStatus
                  };
                }
                return run;
              })
            };
          }
          return process;
        })
      };

      // Check if ALL runs in ALL processes are complete
      const allRunsComplete = updatedOrder.processes.every(process =>
        process.runs.every(run => run.configStatus === 'COMPLETE')
      );

      if (allRunsComplete) {
        return {
          ...updatedOrder,
          status: 'Production_Ready'
        };
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

    // Prepare values for API - preserve types based on field definitions
    const apiValues: Record<string, string | number | boolean> = {};
    const fieldConfigs = getRunFieldConfigs(run);

    Object.entries(run.values).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        // Skip empty optional values or send as null depending on backend requirments
        // Since the validator checks required fields, and we filtered them above, 
        // we might just want to skip sending empty non-required fields?
        // But the original code sent '' for everything.
        // Let's look at the field definition.

        // Actually, let's keep it simple: if it's empty, send as empty string if backend accepts it, or don't send?
        // The validator checks `value === undefined` to skip optional checks. 
        // If we send nothing, it's undefined.
        // If we send '', and it expects number, it fails "must be number".
        // So for number fields, if it's empty/optional, we probably shouldn't send it, or send null?
        // The previous code sent '' for everything.

        // Let's check what the validator does:
        // switch (def.type) { case 'number': if (typeof value !== 'number') throw...
        // So sending '' will fail validation if the key exists.

        // So we should NOT send the key if the value is empty/null/undefined.
        return;
      }

      const fieldDef = fieldConfigs.find(f => f.key === key);
      const type = fieldDef?.type || 'string';

      if (type === 'number') {
        apiValues[key] = Number(value);
      } else if (type === 'boolean') {
        apiValues[key] = Boolean(value);
      } else {
        apiValues[key] = String(value);
      }
    });

    setIsSaving(runId);
    setError(null);

    try {
      // Send the values object to configureRun
      const response = await configureRun(localOrder.id, processId, runId, apiValues);

      // Check if API returned success
      if (response && response.success === true) {
        // Update local state immediately
        updateRunConfigStatus(processId, runId, "COMPLETE");

        // Notify parent component
        if (onSaveSuccess) {
          onSaveSuccess(processId, runId);
        }

        alert(`Run ${run.runNumber} configured successfully`);
        setOpenRunId(null); // Close the form after successful save

        // Optionally refresh from server to get latest data
        // if (onRefresh) {
        //   await onRefresh();
        // }
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(null);
    }
  };

  // Group fields into pairs for table-like layout
  const groupFieldsIntoPairs = (fields: any[]) => {
    const pairs = [];
    for (let i = 0; i < fields.length; i += 2) {
      pairs.push([fields[i], fields[i + 1]]);
    }
    return pairs;
  };

  // Function to render form or view based on run status
  const renderRunFormOrView = (process: any, run: ProcessRun) => {
    const isConfigured = run.configStatus === 'COMPLETE';

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
                      const type = fieldConfig.type || 'string';
                      const isNumberField = type === 'number';
                      const currentValue = run.values[field];
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
                              {run.values[field] || <span className="text-gray-400">Not set</span>}
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
                      const isNumberField = type === 'number';

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
                            <input
                              type={isNumberField ? 'number' : 'text'}
                              value={run.values[field] ?? ''}
                              onChange={(e) => {
                                let value = e.target.value;

                                // For number fields, ensure we're sending valid numbers
                                if (isNumberField) {
                                  // Allow empty, but validate it's a number if not empty
                                  if (value !== '') {
                                    // Remove any non-numeric characters except decimal point
                                    value = value.replace(/[^0-9.]/g, '');
                                    // Ensure only one decimal point
                                    const parts = value.split('.');
                                    if (parts.length > 2) {
                                      value = parts[0] + '.' + parts.slice(1).join('');
                                    }
                                  }
                                }

                                updateRunField(process.id, run.id, field, value);
                              }

                              }

                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              placeholder={`Enter ${prettyLabel(field).toLowerCase()}`}
                              min={isNumberField ? '0' : undefined}
                              step={isNumberField ? '1' : undefined}
                            />
                            {isRequired && !run.values[field] && (
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
                  className={`px-4 py-1 text-sm font-medium rounded transition-colors flex items-center gap-1 ${areAllFieldsFilled(run)
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
            const isConfigured = run.configStatus === 'COMPLETE'; // Check for COMPLETE status
            const filledFields = Object.values(run.values).filter((v) => v && v !== '').length;
            const totalFields = run.fields?.length || 0;

            return (
              <div key={run.id} className="space-y-1">
                {/* RUN HEADER - COMPACT */}
                <div
                  onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}
                  className={`border rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors ${isConfigured
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
                      <div className="flex items-center gap-1">
                        {isConfigured ? (
                          <Eye className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Edit className="w-4 h-4 text-gray-500" />
                        )}
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform ${openRunId === run.id ? 'rotate-90' : ''
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