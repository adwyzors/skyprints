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

  // State to store selected images for each run
  const [runImages, setRunImages] = useState<Record<string, File[]>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});

  // Get field configurations from run.fields array
  const getRunFieldConfigs = (run: ProcessRun) => run.fields ?? [];

  const areAllFieldsFilled = (run: ProcessRun) => {
    const fields = run.fields ?? [];
    return fields
      .filter((f) => f.required && f.key !== 'Estimated Amount') // Skip auto-calculated field
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

  /* ================= IMAGE HANDLING ================= */

  const handleImageSelect = (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const currentImages = runImages[runId] || [];

    // Restrict to 2 photos
    if (currentImages.length + fileArray.length > 2) {
      alert('Maximum 2 photos allowed per run');
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = fileArray.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      alert('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file sizes (max 5MB per file)
    const oversizedFiles = fileArray.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Each image must be less than 5MB');
      return;
    }

    // Update state
    setRunImages(prev => ({
      ...prev,
      [runId]: [...(prev[runId] || []), ...fileArray]
    }));

    // Create previews
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => ({
          ...prev,
          [runId]: [...(prev[runId] || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (runId: string, index: number) => {
    setRunImages(prev => ({
      ...prev,
      [runId]: (prev[runId] || []).filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => ({
      ...prev,
      [runId]: (prev[runId] || []).filter((_, i) => i !== index)
    }));
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

      // Build new values object
      const newValues = {
        ...run.values,
        [field]: typedValue,
      };

      // Auto-calculate estimated_amount when estimated_rate or quantity changes
      if (field === 'estimated_rate' || field === 'quantity') {
        const rate = field === 'estimated_rate' ? typedValue : run.values['estimated_rate'];
        const qty = field === 'quantity' ? typedValue : run.values['quantity'];

        if (typeof rate === 'number' && typeof qty === 'number') {
          newValues['estimated_amount'] = rate * qty;
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
                    values: newValues,
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
        return;
      }

      const fieldDef = fieldConfigs.find(f => f.key === key);
      const type = fieldDef?.type || 'null';

      if (type === 'number') {
        apiValues[key] = Number(value);
      } else if (type === 'boolean') {
        apiValues[key] = Boolean(value);
      } else if (type === 'string') {
        apiValues[key] = String(value);
      } else {
        apiValues[key] = value;
      }
    });

    // Calculate and add Estimated Amount (auto-calculated field)
    const rate = Number(run.values['Estimated Rate']) || 0;
    const qty = Number(run.values['Quantity']) || 0;
    if (rate > 0 && qty > 0) {
      apiValues['Estimated Amount'] = rate * qty;
    }

    setIsSaving(runId);
    setError(null);

    try {
      // Send the values object AND images to configureRun
      // Get images for this run if any
      const images = runImages[runId] || [];

      const response = await configureRun(localOrder.id, processId, runId, apiValues, images);

      // Check if API returned success
      if (response && response.success === true) {
        // Update local state immediately
        updateRunConfigStatus(processId, runId, "COMPLETE");

        // Clear images for this run from state
        setRunImages(prev => {
          const newState = { ...prev };
          delete newState[runId];
          return newState;
        });
        setImagePreviews(prev => {
          const newState = { ...prev };
          delete newState[runId];
          return newState;
        });

        // Notify parent component
        if (onSaveSuccess) {
          onSaveSuccess(processId, runId);
        }

        alert(`Run ${run.runNumber} configured successfully`);
        setOpenRunId(null); // Close the form after successful save

        // Refresh from server to get latest data including image URLs
        if (onRefresh) {
          await onRefresh();
        }
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
                const fieldConfigs = getRunFieldConfigs(run).filter(f => f.required === true);
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

            {/* DISPLAY IMAGES IF AVAILABLE (READ-ONLY) */}
            {run.values?.images && Array.isArray(run.values.images) && run.values.images.length > 0 && (
              <div className="mt-4 border border-gray-200 rounded p-3 bg-white">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Reference Images</h4>
                <div className="flex gap-2 overflow-x-auto">
                  {run.values.images.map((imgUrl: string, index: number) => (
                    <a
                      key={index}
                      href={imgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-16 h-16 border rounded overflow-hidden shrink-0 hover:border-blue-500 transition-colors"
                    >
                      <img
                        src={imgUrl}
                        alt={`Ref ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

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
      const currentImages = runImages[run.id] || [];
      const currentPreviews = imagePreviews[run.id] || [];

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
                const fieldConfigs = getRunFieldConfigs(run).filter(f => f.required === true);
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
                            {field === 'Estimated Amount' ? (
                              // Read-only calculated field
                              <div className="w-full text-sm border border-gray-200 bg-gray-100 rounded px-2 py-1 text-gray-700 font-medium">
                                {(() => {
                                  const rate = Number(run.values['Estimated Rate']) || 0;
                                  const qty = Number(run.values['Quantity']) || 0;
                                  return rate * qty || <span className="text-gray-400">Auto-calculated</span>;
                                })()}
                              </div>
                            ) : (
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
                                }}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder={`Enter ${prettyLabel(field).toLowerCase()}`}
                                min={isNumberField ? '0' : undefined}
                                step={isNumberField ? '1' : undefined}
                              />
                            )}
                            {isRequired && !run.values[field] && field !== 'estimated_amount' && (
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

            {/* IMAGE UPLOAD SECTION */}
            <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Reference Images (Max 2)
                </label>
                <div className="text-xs text-gray-500">
                  {currentImages.length}/2 uploaded
                </div>
              </div>

              <div className="flex gap-3 items-start">
                {/* UPLOAD BUTTON */}
                {currentImages.length < 2 && (
                  <div className="relative">
                    <input
                      type="file"
                      id={`img-upload-${run.id}`}
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={(e) => handleImageSelect(run.id, e)}
                    />
                    <label
                      htmlFor={`img-upload-${run.id}`}
                      className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <span className="text-gray-400 text-2xl">+</span>
                      <span className="text-[10px] text-gray-500 mt-1">Add Image</span>
                    </label>
                  </div>
                )}

                {/* PREVIEWS */}
                {currentPreviews.map((preview, idx) => (
                  <div key={idx} className="relative group w-20 h-20 border rounded-lg overflow-hidden">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(run.id, idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
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