import {
    Calendar,
    ChevronDown,
    Edit,
    FileText,
    Grid,
    IndianRupee,
    Loader2,
    MapPin,
    Package,
    Palette,
    Plus,
    Ruler,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import SearchableLocationSelect from '../common/SearchableLocationSelect';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { ProcessRun, SpangleRunValues } from '@/domain/model/run.model';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface SpangleConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onSaveSuccess?: (processId: string, runId: string) => void;
    onRefresh?: () => Promise<void>;
}

// Default fields if not provided by backend
const SPANGLE_FIELDS = [
    { key: 'design', label: 'Design', type: 'string', required: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'dotSize', label: 'Dot Size', type: 'number', required: true },
    { key: 'cd', label: 'CD', type: 'number', required: true },
    { key: 'dotsReq', label: 'Dots Req', type: 'number', required: true },
    { key: 'rate', label: 'Rate', type: 'number', required: false }, // Calced
    { key: 'amount', label: 'Amount', type: 'number', required: false } // Calced
];

const getFieldIcon = (fieldName: string) => {
    const lowerField = fieldName.toLowerCase();
    if (lowerField.includes('date')) return <Calendar className="w-3 h-3" />;
    if (lowerField.includes('quantity')) return <Package className="w-3 h-3" />;
    if (lowerField.includes('rate') || lowerField.includes('amount')) return <IndianRupee className="w-3 h-3" />;
    if (lowerField.includes('design')) return <FileText className="w-3 h-3" />;
    if (lowerField.includes('size')) return <Ruler className="w-3 h-3" />;
    return <Grid className="w-3 h-3" />;
};

export default function SpangleConfig({
    order,
    locations,
    managers,
    onSaveSuccess,
    onRefresh,
}: SpangleConfigProps) {
    const { hasPermission } = useAuth();
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);


    // Run Operations State
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);

    // Editing State
    const [editingRunId, setEditingRunId] = useState<string | null>(null);
    const [openRunId, setOpenRunId] = useState<string | null>(null);

    // UI State
    const [runManagers, setRunManagers] = useState<Record<string, { executorId?: string; reviewerId?: string }>>({});
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
    // Pre-existing image URLs from run.values.images (shown in edit form)
    const [existingRunImages, setExistingRunImages] = useState<Record<string, string[]>>(
        () => {
            const init: Record<string, string[]> = {};
            order.processes.forEach(p => p.runs.forEach(r => {
                if (r.values?.images && Array.isArray(r.values.images) && r.values.images.length > 0) {
                    init[r.id] = r.values.images as string[];
                }
            }));
            return init;
        }
    );

    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId



    useEffect(() => {
        setLocalOrder(order);
    }, [order]);



    const getRunFieldConfigs = (run: ProcessRun) => {
        // Use injected fields if available, otherwise default
        return (run.fields && run.fields.length > 0) ? run.fields : SPANGLE_FIELDS;
    };

    const groupFieldsIntoPairs = (fields: any[]) => {
        const pairs = [];
        for (let i = 0; i < fields.length; i += 2) {
            pairs.push([fields[i], fields[i + 1]]);
        }
        return pairs;
    };

    const prettyLabel = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const handleAddRun = async (processId: string) => {
        setIsAddingRun(true);
        setError(null);
        try {
            await addRunToProcess(localOrder.id, processId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to add run');
        } finally {
            setIsAddingRun(false);
        }
    };

    const handleDeleteRun = async (processId: string, runId: string) => {
        if (!confirm('Delete this run?')) return;
        setIsDeletingRun(runId);
        try {
            await deleteRunFromProcess(localOrder.id, processId, runId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to delete run');
        } finally {
            setIsDeletingRun(null);
        }
    };

    const handleManagerSelect = (runId: string, type: 'executorId' | 'reviewerId', value: string) => {
        setRunManagers(prev => ({
            ...prev,
            [runId]: { ...prev[runId], [type]: value }
        }));
    };

    const handleImageSelect = (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setRunImages(prev => ({ ...prev, [runId]: [...(prev[runId] || []), ...files] }));
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => ({ ...prev, [runId]: [...(prev[runId] || []), ...newPreviews] }));
        }
    };

    const removeImage = (runId: string, index: number) => {
        setRunImages(prev => {
            const newFiles = [...(prev[runId] || [])];
            newFiles.splice(index, 1);
            return { ...prev, [runId]: newFiles };
        });
        setImagePreviews(prev => {
            const newPreviews = [...(prev[runId] || [])];
            URL.revokeObjectURL(newPreviews[index]);
            newPreviews.splice(index, 1);
            return { ...prev, [runId]: newPreviews };
        });
    };

    const updateRunField = (processId: string, runId: string, field: string, value: string) => {
        setLocalOrder(prev => {
            if (!prev) return prev;
            const process = prev.processes.find(p => p.id === processId);
            const run = process?.runs.find(r => r.id === runId);
            if (!run) return prev;

            const fieldDef = getRunFieldConfigs(run).find(f => f.key === field);
            let typedValue: string | number = value;

            if (fieldDef?.type === 'number' && value !== '') {
                typedValue = Number(value);
            }

            const newValues = { ...run.values, [field]: typedValue };

            // Calculations
            // Rate = dotsReq / 100
            // Amount = Rate * Quantity
            if (field === 'dotsReq') {
                const dotsReq = Number(typedValue) || 0;
                const rate = dotsReq / 100;
                newValues['rate'] = rate;

                const qty = Number(newValues['quantity']) || 0;
                newValues['amount'] = rate * qty;
            } else if (field === 'quantity') {
                const qty = Number(typedValue) || 0;
                const rate = Number(newValues['rate']) || 0;
                newValues['amount'] = rate * qty;
            } else if (field === 'rate') {
                // If user manually edits rate? Maybe allow it.
                const rate = Number(typedValue) || 0;
                const qty = Number(newValues['quantity']) || 0;
                newValues['amount'] = rate * qty;
            }

            return {
                ...prev,
                processes: prev.processes.map(p => p.id !== processId ? p : {
                    ...p,
                    runs: p.runs.map(r => r.id !== runId ? r : { ...r, values: newValues })
                })
            };
        });
    };

    const updateRunState = (processId: string, runId: string, updates: any) => {
        setLocalOrder(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                processes: prev.processes.map(p => p.id !== processId ? p : {
                    ...p,
                    runs: p.runs.map(r => r.id !== runId ? r : { ...r, ...updates })
                })
            };
        });
    };

    const saveRun = async (processId: string, runId: string) => {
        const process = localOrder.processes.find(p => p.id === processId);
        const run = process?.runs.find(r => r.id === runId);
        if (!run) return;

        setIsSaving(runId);
        setError(null);

        try {
            // Standard Image Upload
            const images = runImages[runId] || [];
            const imageUrls: string[] = [];

            if (images.length > 0) {
                const { apiRequest } = await import('@/services/api.service');
                const uploadPromises = images.map(async (file) => {
                    const { uploadUrl, publicUrl } = await apiRequest<{
                        uploadUrl: string;
                        publicUrl: string;
                    }>(`/orders/upload-url?filename=${encodeURIComponent(file.name)}`);
                    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                    return publicUrl;
                });
                imageUrls.push(...(await Promise.all(uploadPromises)));
            }

            const managerSelection = runManagers[runId];

            // Find current run executor/reviewer if not changed
            let currentExecutorId: string | undefined;
            let currentReviewerId: string | undefined;

            // Find the run
            for (const p of localOrder.processes) {
                const r = p.runs.find(r => r.id === runId);
                if (r) {
                    currentExecutorId = r.executor?.id;
                    currentReviewerId = r.reviewer?.id;
                    break;
                }
            }


            // Only send defined fields
            const apiValues: any = {};
            // Copy keys from values that match field configs or are custom
            Object.keys(run.values).forEach(key => {
                apiValues[key] = run.values[key];
            });

            const res = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                managerSelection?.executorId ?? currentExecutorId,
                managerSelection?.reviewerId ?? currentReviewerId,
                runLocations[runId] ?? run?.location?.id
            );

            if (res.success) {
                const selectedExecutor = (managerSelection?.executorId) ? managers.find(u => u.id === managerSelection.executorId) || run.executor : run.executor;
                const selectedReviewer = (managerSelection?.reviewerId) ? managers.find(u => u.id === managerSelection.reviewerId) || run.reviewer : run.reviewer;

                updateRunState(processId, runId, {
                    configStatus: 'COMPLETE',
                    executor: selectedExecutor ? { id: selectedExecutor.id, name: selectedExecutor.name } : null,
                    reviewer: selectedReviewer ? { id: selectedReviewer.id, name: selectedReviewer.name } : null
                });

                setRunImages(prev => { const n = { ...prev }; delete n[runId]; return n; });
                setImagePreviews(prev => { const n = { ...prev }; delete n[runId]; return n; });

                setOpenRunId(null);
                setEditingRunId(null);
                if (onSaveSuccess) onSaveSuccess(processId, runId);
                if (onRefresh) await onRefresh();
            } else {
                throw new Error('Save failed');
            }

        } catch (err: any) {
            setError(err.message || 'Save failed');
        } finally {
            setIsSaving(null);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SearchableManagerSelect = ({ label, valueId, onChange, users }: any) => (
        <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
            <select className="w-full text-sm border border-gray-300 rounded px-2 py-1" value={valueId || ''} onChange={e => onChange(e.target.value)}>
                <option value="">Select {label}...</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
        </div>
    );

    const toggleRunOpen = (run: ProcessRun) => {
        if (openRunId === run.id) {
            setOpenRunId(null);
            if (editingRunId === run.id) setEditingRunId(null);
        } else {
            setOpenRunId(run.id);
            if (run.configStatus !== 'COMPLETE') setEditingRunId(run.id);
        }
    };

    const renderRun = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;

        // Compact Form Render similar to ScreenPrintingConfig
        const fieldConfigs = getRunFieldConfigs(run);
        const pairs = groupFieldsIntoPairs(fieldConfigs);

        // Read One View vs Edit Form
        // Since we are just mirroring logic, let's keep it simple: 
        // If configured and not editing => Read Only View
        // Else => Edit Form

        const isViewMode = isConfigured && !isEditing;

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isEditing ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <h3 className="font-semibold text-sm">{isEditing ? `Edit Run ${run.runNumber}` : `Spangle Run ${run.runNumber}`}</h3>
                        {isViewMode && run.location && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {run.location.code}
                            </span>
                        )}
                    </div>
                    {isViewMode && hasPermission(Permission.RUNS_UPDATE) && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setEditingRunId(run.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                            >
                                <Edit className="w-3 h-3" />
                                Edit
                            </button>
                            <button onClick={() => setOpenRunId(null)} className="text-gray-500 hover:text-gray-700 text-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {!isViewMode && <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }}><X className="w-4 h-4 text-gray-500" /></button>}
                </div>

                <div className="bg-white border border-gray-200 rounded p-4 space-y-6">
                    {/* Manager Selection (Only in Edit Mode) */}
                    {!isViewMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SearchableManagerSelect
                                label="Executor"
                                users={managers}
                                valueId={runManagers[run.id]?.executorId ?? run.executor?.id}
                                onChange={(id: string) => handleManagerSelect(run.id, 'executorId', id)}
                            />
                            <SearchableManagerSelect
                                label="Reviewer"
                                users={managers}
                                valueId={runManagers[run.id]?.reviewerId ?? run.reviewer?.id}
                                onChange={(id: string) => handleManagerSelect(run.id, 'reviewerId', id)}
                            />
                            <SearchableLocationSelect
                                label="Location"
                                locations={locations}
                                valueId={runLocations[run.id] ?? run.location?.id}
                                onChange={(id) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                            />
                        </div>
                    )}

                    {/* Fields Grid */}
                    <div className="border border-gray-300 rounded overflow-hidden bg-white">
                        {pairs.map((pair, rowIndex) => (
                            <div key={rowIndex} className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300">
                                {pair.map((fieldConfig: any) => {
                                    const field = fieldConfig.key;
                                    const type = fieldConfig.type || 'string';
                                    const isNumber = type === 'number';
                                    const val = (run.values as SpangleRunValues)[field];
                                    const isAuto = field === 'rate' || field === 'amount';

                                    return (
                                        <React.Fragment key={field}>
                                            <div className="bg-gray-50 p-1.5 flex items-center gap-1">
                                                {getFieldIcon(field)}
                                                <label className="text-xs font-medium text-gray-700">{prettyLabel(field)}</label>
                                            </div>
                                            <div className="p-1.5 bg-white">
                                                {isViewMode || isAuto ? (
                                                    <div className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 font-medium text-gray-700">
                                                        {/* Show 0 for auto fields if undefined, or just - */}
                                                        {isAuto ? ((val === undefined || val === null) ? '0.00' : Number(val).toFixed(2)) : (val || '-')}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={isNumber ? 'number' : 'text'}
                                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                                        value={val ?? ''}
                                                        onChange={e => updateRunField(process.id, run.id, field, e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                                {pair.length === 1 && (
                                    <>
                                        <div className="bg-gray-50 p-1.5"></div>
                                        <div className="p-1.5 bg-white"></div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Image Upload */}
                    {!isViewMode && (
                        <div className="border border-gray-300 rounded p-3">
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-gray-700">Reference Images</label>
                                <span className="text-xs text-gray-500">{(runImages[run.id] || []).length}/2</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="file" id={`img-${run.id}`} className="hidden" multiple accept="image/*" onChange={e => handleImageSelect(run.id, e)} />
                                <label htmlFor={`img-${run.id}`} className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-gray-50">
                                    <Plus className="w-4 h-4 text-gray-400" />
                                </label>
                                {(imagePreviews[run.id] || []).map((src, i) => (
                                    <div key={i} className="relative w-16 h-16 border rounded overflow-hidden group">
                                        <img src={src} className="w-full h-full object-cover" />
                                        <button onClick={() => removeImage(run.id, i)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    {!isViewMode && (
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }} className="px-3 py-1 text-sm border rounded">Cancel</button>
                            <button onClick={() => saveRun(process.id, run.id)} disabled={isSaving === run.id} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
                                {isSaving === run.id ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            {localOrder.processes.map(p => (
                <div key={p.id} className="space-y-3">
                    {p.runs.map(run => (
                        <div key={run.id} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                            <div className={`w-full bg-gray-50 p-4 flex justify-between cursor-pointer ${run.configStatus === 'COMPLETE' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'}`} onClick={() => toggleRunOpen(run)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${run.configStatus === 'COMPLETE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        <Palette className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Run {run.runNumber}</h3>
                                        <div className="text-xs text-gray-500">{run.configStatus === 'COMPLETE' ? 'Configured' : 'Pending'} • {run.lifecycleStatus}</div>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transform ${openRunId === run.id ? 'rotate-180' : ''}`} />
                            </div>
                            {openRunId === run.id && <div className="p-4 bg-white border-t">{renderRun(p, run)}</div>}
                        </div>
                    ))}
                    {hasPermission(Permission.RUNS_CREATE) && (
                        <button onClick={() => handleAddRun(p.id)} disabled={isAddingRun} className="w-full py-3 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-500 hover:text-blue-600 flex justify-center items-center gap-2">
                            {isAddingRun ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            Add Spangle Run
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
